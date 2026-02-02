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

      // Find the most recent lead for this contact (with campaign info)
      const { data: crmLead } = await supabase
        .from("crm_leads")
        .select("id, status, campaign_id")
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
          campaign_id: crmLead?.campaign_id || null,
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

      // --- ANALYTICS: Record reply in campaign metrics ---
      if (crmLead?.campaign_id) {
        await recordReplyAnalytics(supabase, crmContact.tenant_id, crmLead.campaign_id);
      }

      return new Response(JSON.stringify({
        status: "ok",
        contact_id: crmContact.id,
        lead_id: crmLead?.id,
        campaign_id: crmLead?.campaign_id,
        action: "crm_reply_logged",
        contact_name: `${crmContact.first_name} ${crmContact.last_name}`,
        analytics_recorded: !!crmLead?.campaign_id,
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

      let campaignId: string | null = null;

      if (sequenceRun) {
        // Get sequence to find campaign_id
        const { data: sequence } = await supabase
          .from("outbound_sequences")
          .select("id, campaign_id")
          .eq("id", sequenceRun.sequence_id)
          .maybeSingle();

        campaignId = sequence?.campaign_id || null;

        // Get last step
        const { data: lastStep } = await supabase
          .from("outbound_sequence_steps")
          .select("id")
          .eq("sequence_id", sequenceRun.sequence_id)
          .eq("step_order", sequenceRun.last_step_sent)
          .maybeSingle();

        // Log reply event to outbound_message_events
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
          replied_at: new Date().toISOString(),
        });

        // Pause sequence
        await supabase
          .from("outbound_sequence_runs")
          .update({ status: "paused" })
          .eq("id", sequenceRun.id);

        console.log(`[crm-email-reply-webhook] Prospect reply logged, sequence paused`);
      }

      // Also log to crm_activities for unified timeline
      await supabase.from("crm_activities").insert({
        tenant_id: prospect.tenant_id,
        contact_id: null,
        lead_id: null,
        activity_type: "email_reply",
        meta: {
          from: senderEmail,
          subject: subject,
          text_preview: textContent.substring(0, 500),
          prospect_id: prospect.id,
          source: "outbound_os",
          campaign_id: campaignId,
        },
      });

      // --- ANALYTICS: Record reply in campaign metrics for Outbound campaigns ---
      if (campaignId) {
        // Get campaign to find tenant_id for CMO campaigns
        const { data: cmoCampaign } = await supabase
          .from("cmo_campaigns")
          .select("id, tenant_id")
          .eq("id", campaignId)
          .maybeSingle();

        if (cmoCampaign?.tenant_id) {
          await recordReplyAnalytics(supabase, prospect.tenant_id, campaignId, cmoCampaign.tenant_id);
        }

        // Also check outbound_campaigns
        const { data: outboundCampaign } = await supabase
          .from("outbound_campaigns")
          .select("id, tenant_id")
          .eq("id", campaignId)
          .maybeSingle();

        if (outboundCampaign) {
          // Record in outbound analytics
          console.log(`[crm-email-reply-webhook] Reply recorded for outbound campaign: ${campaignId}`);
        }
      }

      return new Response(JSON.stringify({
        status: "ok",
        prospect_id: prospect.id,
        campaign_id: campaignId,
        action: "prospect_reply_logged",
        analytics_recorded: !!campaignId,
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

/**
 * Record reply in campaign analytics tables
 * - Increments reply_count in campaign_metrics
 * - Records snapshot in cmo_metrics_snapshots for optimizer
 */
async function recordReplyAnalytics(
  supabase: any,
  tenantId: string,
  campaignId: string,
  tenantId?: string
) {
  try {
    // Get tenant_id if not provided
    let wsId = tenantId;
    if (!wsId) {
      const { data: campaign } = await supabase
        .from("cmo_campaigns")
        .select("tenant_id")
        .eq("id", campaignId)
        .maybeSingle();
      wsId = campaign?.tenant_id;
    }

    if (!wsId) {
      console.log(`[crm-email-reply-webhook] No tenant_id found for campaign ${campaignId}`);
      return;
    }

    // Call RPC to increment reply count atomically
    const { error: incError } = await supabase.rpc("increment_campaign_reply_count", {
      p_campaign_id: campaignId,
      p_tenant_id: wsId,
    });

    if (incError) {
      console.error("[crm-email-reply-webhook] Error incrementing reply count:", incError);
    } else {
      console.log(`[crm-email-reply-webhook] Incremented reply_count for campaign ${campaignId}`);
    }

    // Record in metrics snapshot for optimizer
    const { error: snapError } = await supabase.rpc("record_reply_metric_snapshot", {
      p_tenant_id: wsId,
      p_campaign_id: campaignId,
      p_tenant_id: tenantId,
    });

    if (snapError) {
      console.error("[crm-email-reply-webhook] Error recording metrics snapshot:", snapError);
    } else {
      console.log(`[crm-email-reply-webhook] Recorded metrics snapshot for campaign ${campaignId}`);
    }

  } catch (err) {
    console.error("[crm-email-reply-webhook] Analytics recording error:", err);
  }
}
