/**
 * Channel Outbox Webhook
 * Handles Resend webhook callbacks to update channel_outbox delivery status
 * Tracks: delivered, bounced, opened, clicked, complained, unsubscribed
 * Also updates campaign_metrics aggregates for analytics
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySvixSignature } from "../_shared/svix-verify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

// Resend webhook event types
type ResendEventType = 
  | "email.sent" 
  | "email.delivered" 
  | "email.opened" 
  | "email.clicked" 
  | "email.bounced" 
  | "email.complained"
  | "email.unsubscribed";

interface ResendWebhookPayload {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
    created_at: string;
    click?: { link: string };
  };
}

// Map Resend events to our status values
const STATUS_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.unsubscribed": "unsubscribed",
};

// Map events to campaign_metrics column names for incrementing
const METRIC_COLUMN_MAP: Record<string, string> = {
  "email.delivered": "delivered_count",
  "email.opened": "open_count",
  "email.clicked": "clicks",
  "email.bounced": "bounce_count",
  "email.unsubscribed": "unsubscribe_count",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();

    // Verify Resend/Svix webhook signature
    const isValid = await verifySvixSignature({
      req,
      rawBody,
      secretEnv: "RESEND_WEBHOOK_SECRET",
    });

    if (!isValid) {
      console.error("[channel-outbox-webhook] Invalid webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload: ResendWebhookPayload = JSON.parse(rawBody);
    console.log(`[channel-outbox-webhook] Event: ${payload.type}, email_id: ${payload.data?.email_id}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const newStatus = STATUS_MAP[payload.type];
    if (!newStatus) {
      console.log(`[channel-outbox-webhook] Ignoring event type: ${payload.type}`);
      return new Response(JSON.stringify({ status: "ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailId = payload.data?.email_id;
    if (!emailId) {
      console.log("[channel-outbox-webhook] No email_id in payload");
      return new Response(JSON.stringify({ error: "Missing email_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find matching channel_outbox record by provider_message_id
    const { data: outboxRecord, error: findError } = await supabase
      .from("channel_outbox")
      .select("id, status, tenant_id, workspace_id, run_id, recipient_email")
      .eq("provider_message_id", emailId)
      .eq("channel", "email")
      .maybeSingle();

    if (findError) {
      console.error("[channel-outbox-webhook] Error finding outbox record:", findError);
      throw findError;
    }

    if (!outboxRecord) {
      console.log(`[channel-outbox-webhook] No outbox record found for email_id: ${emailId}`);
      return new Response(JSON.stringify({ status: "no_match", email_id: emailId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the outbox record with new status and provider response
    const { error: updateError } = await supabase
      .from("channel_outbox")
      .update({
        status: newStatus,
        provider_response: {
          event_type: payload.type,
          occurred_at: payload.created_at,
          click_link: payload.data?.click?.link,
        },
      })
      .eq("id", outboxRecord.id);

    if (updateError) {
      console.error("[channel-outbox-webhook] Error updating outbox:", updateError);
      throw updateError;
    }

    // Log to campaign audit
    await supabase.from("campaign_audit_log").insert({
      tenant_id: outboxRecord.tenant_id,
      workspace_id: outboxRecord.workspace_id,
      run_id: outboxRecord.run_id,
      event_type: `email_${newStatus}`,
      actor_type: "webhook",
      details: {
        provider_message_id: emailId,
        recipient: outboxRecord.recipient_email,
        resend_event: payload.type,
        occurred_at: payload.created_at,
      },
    } as never);

    // Update campaign_metrics if this event type has a corresponding metric column
    const metricColumn = METRIC_COLUMN_MAP[payload.type];
    if (metricColumn && outboxRecord.run_id) {
      // Get campaign_id from campaign_runs
      const { data: runData } = await supabase
        .from("campaign_runs")
        .select("campaign_id")
        .eq("id", outboxRecord.run_id)
        .maybeSingle();

      if (runData?.campaign_id) {
        // Increment the appropriate metric column
        const { error: metricsError } = await supabase.rpc("increment_campaign_metric", {
          p_campaign_id: runData.campaign_id,
          p_column_name: metricColumn,
          p_increment_by: 1,
        });

        if (metricsError) {
          console.error("[channel-outbox-webhook] Error updating campaign_metrics:", metricsError);
          // Don't throw - main webhook processing succeeded
        } else {
          console.log(`[channel-outbox-webhook] Incremented ${metricColumn} for campaign ${runData.campaign_id}`);
        }
      }
    }

    console.log(`[channel-outbox-webhook] Updated outbox ${outboxRecord.id} to status: ${newStatus}`);

    return new Response(JSON.stringify({ 
      status: "ok",
      outbox_id: outboxRecord.id,
      new_status: newStatus,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[channel-outbox-webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
