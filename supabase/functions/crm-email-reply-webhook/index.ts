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
    // Resend sends inbound emails with from, to, subject, text, html
    const senderEmail = payload.from?.toLowerCase() || payload.data?.from?.toLowerCase();
    const subject = payload.subject || payload.data?.subject || "";
    const textContent = payload.text || payload.data?.text || "";
    const htmlContent = payload.html || payload.data?.html || "";

    if (!senderEmail) {
      console.log("[crm-email-reply-webhook] No sender email found");
      return new Response(JSON.stringify({ status: "no_sender" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[crm-email-reply-webhook] Processing reply from: ${senderEmail}`);

    // Find lead by email in CRM
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, workspace_id, first_name, last_name, email, status")
      .ilike("email", senderEmail)
      .maybeSingle();

    if (leadError) {
      console.error("[crm-email-reply-webhook] Error finding lead:", leadError);
    }

    if (lead) {
      console.log(`[crm-email-reply-webhook] Found CRM lead: ${lead.first_name} ${lead.last_name}`);

      // Log reply as lead activity
      const { error: activityError } = await supabase.from("lead_activities").insert({
        lead_id: lead.id,
        workspace_id: lead.workspace_id,
        activity_type: "email_replied",
        description: `Lead replied to email: "${subject.substring(0, 100)}"`,
        metadata: {
          from: senderEmail,
          subject: subject,
          text_preview: textContent.substring(0, 500),
          received_at: new Date().toISOString(),
        },
      });

      if (activityError) {
        console.error("[crm-email-reply-webhook] Error logging activity:", activityError);
      }

      // Update lead status to 'contacted' if currently 'new'
      if (lead.status === "new") {
        await supabase
          .from("leads")
          .update({ status: "contacted", updated_at: new Date().toISOString() })
          .eq("id", lead.id);
        console.log(`[crm-email-reply-webhook] Updated lead status to 'contacted'`);
      }

      // Trigger lead scoring for engagement
      try {
        await supabase.functions.invoke("auto-score-lead", {
          body: { leadId: lead.id },
        });
        console.log(`[crm-email-reply-webhook] Triggered auto-scoring for lead ${lead.id}`);
      } catch (scoreError) {
        console.error("[crm-email-reply-webhook] Error triggering auto-score:", scoreError);
      }

      return new Response(JSON.stringify({
        status: "ok",
        lead_id: lead.id,
        action: "reply_logged",
        lead_name: `${lead.first_name} ${lead.last_name}`,
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

      return new Response(JSON.stringify({
        status: "ok",
        prospect_id: prospect.id,
        action: "prospect_reply_logged",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[crm-email-reply-webhook] No lead or prospect found for: ${senderEmail}`);
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
