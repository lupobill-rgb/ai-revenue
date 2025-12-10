import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySvixSignature } from "../_shared/svix-verify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.text();
    
    // Verify Resend/Svix webhook signature if secret is configured
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (webhookSecret) {
      const isValid = await verifySvixSignature({
        req,
        rawBody,
        secretEnv: "RESEND_WEBHOOK_SECRET",
      });

      if (!isValid) {
        console.error("[crm-email-reply-webhook] Invalid webhook signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = JSON.parse(rawBody);
    console.log("[crm-email-reply-webhook] Received event:", payload.type || "inbound");

    // Handle Resend inbound email (reply detection)
    const senderEmail = (payload.from?.toLowerCase() || payload.data?.from?.toLowerCase() || "").trim();
    const subject = payload.subject || payload.data?.subject || "";
    const textContent = payload.text || payload.data?.text || "";

    if (!senderEmail) {
      console.log("[crm-email-reply-webhook] No sender email found");
      return new Response(JSON.stringify({ status: "no_sender" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[crm-email-reply-webhook] Processing reply from: ${senderEmail}`);

    // First check CRM contacts (unified CRM spine)
    const { data: crmContact, error: crmError } = await supabase
      .from("crm_contacts")
      .select("id, tenant_id, first_name, last_name, email, status")
      .ilike("email", senderEmail)
      .maybeSingle();

    if (crmContact) {
      console.log(`[crm-email-reply-webhook] Found CRM contact: ${crmContact.first_name} ${crmContact.last_name}`);

      // Find the most recent lead for this contact
      const { data: crmLead } = await supabase
        .from("crm_leads")
        .select("id, status")
        .eq("contact_id", crmContact.id)
        .eq("tenant_id", crmContact.tenant_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Log reply to crm_activities (unified CRM spine)
      const { error: activityError } = await supabase.from("crm_activities").insert({
        tenant_id: crmContact.tenant_id,
        contact_id: crmContact.id,
        lead_id: crmLead?.id || null,
        activity_type: "email_reply",
        meta: {
          from: senderEmail,
          subject: subject,
          text_preview: textContent.substring(0, 500),
          received_at: new Date().toISOString(),
        },
      });

      if (activityError) {
        console.error("[crm-email-reply-webhook] Error logging CRM activity:", activityError);
      } else {
        console.log(`[crm-email-reply-webhook] Logged email_reply activity for contact: ${crmContact.id}`);
      }

      // Update lead status to 'working' if currently 'new'
      if (crmLead && crmLead.status === "new") {
        await supabase
          .from("crm_leads")
          .update({ status: "working", updated_at: new Date().toISOString() })
          .eq("id", crmLead.id);
        console.log(`[crm-email-reply-webhook] Updated CRM lead status to 'working'`);

        // Log status change activity
        await supabase.from("crm_activities").insert({
          tenant_id: crmContact.tenant_id,
          contact_id: crmContact.id,
          lead_id: crmLead.id,
          activity_type: "status_change",
          meta: {
            old_status: "new",
            new_status: "working",
            triggered_by: "email_reply",
          },
        });
      }

      return new Response(JSON.stringify({
        status: "ok",
        contact_id: crmContact.id,
        lead_id: crmLead?.id,
        action: "crm_reply_logged",
        contact_name: `${crmContact.first_name} ${crmContact.last_name}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also check prospects table (Outbound OS)
    const { data: prospect, error: prospectError } = await supabase
      .from("prospects")
      .select("id, tenant_id, first_name, last_name")
      .ilike("email", senderEmail)
      .maybeSingle();

    if (prospect) {
      console.log(`[crm-email-reply-webhook] Found Outbound prospect: ${prospect.first_name} ${prospect.last_name}`);

      // Find active sequence run
      const { data: sequenceRun } = await supabase
        .from("outbound_sequence_runs")
        .select("id, sequence_id, last_step_sent")
        .eq("prospect_id", prospect.id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sequenceRun) {
        // Get last step
        const { data: lastStep } = await supabase
          .from("outbound_sequence_steps")
          .select("id")
          .eq("sequence_id", sequenceRun.sequence_id)
          .eq("step_order", sequenceRun.last_step_sent)
          .maybeSingle();

        // Log reply event
        await supabase.from("outbound_message_events").insert({
          tenant_id: prospect.tenant_id,
          sequence_run_id: sequenceRun.id,
          step_id: lastStep?.id,
          event_type: "replied",
          channel: "email",
          metadata: {
            from: senderEmail,
            subject: subject,
            text_preview: textContent.substring(0, 500),
          },
          occurred_at: new Date().toISOString(),
        });

        // Pause sequence
        await supabase
          .from("outbound_sequence_runs")
          .update({ status: "paused" })
          .eq("id", sequenceRun.id);

        console.log(`[crm-email-reply-webhook] Prospect reply logged, sequence paused`);
      }

      // Also log to crm_activities if prospect has a linked CRM contact
      await supabase.from("crm_activities").insert({
        tenant_id: prospect.tenant_id,
        contact_id: null, // Will be linked if prospect has contact_id
        lead_id: null,
        activity_type: "email_reply",
        meta: {
          from: senderEmail,
          subject: subject,
          text_preview: textContent.substring(0, 500),
          prospect_id: prospect.id,
          source: "outbound_os",
        },
      });

      return new Response(JSON.stringify({
        status: "ok",
        prospect_id: prospect.id,
        action: "prospect_reply_logged",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[crm-email-reply-webhook] No CRM contact or prospect found for: ${senderEmail}`);
    return new Response(JSON.stringify({ status: "no_match", email: senderEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[crm-email-reply-webhook] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
