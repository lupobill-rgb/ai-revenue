import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySvixSignature } from "../_shared/svix-verify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

// Map Resend event types to our canonical types
const EVENT_TYPE_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "open",
  "email.clicked": "click",
  "email.bounced": "bounce",
  "email.complained": "complaint",
  "email.delivery_delayed": "delayed",
  // Inbound/reply events
  "inbound": "reply",
};

// Map event types to stat fields
const STAT_FIELD_MAP: Record<string, string> = {
  "sent": "sends",
  "delivered": "deliveries",
  "open": "opens",
  "click": "clicks",
  "reply": "replies",
  "bounce": "bounces",
};

// Map event types to crm_activities types
const ACTIVITY_TYPE_MAP: Record<string, string> = {
  "reply": "email_reply",
  "open": "email_open",
  "click": "email_click",
  "bounce": "email_bounce",
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

    // Verify Resend/Svix webhook signature if configured
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (webhookSecret) {
      const isValid = await verifySvixSignature({
        req,
        rawBody,
        secretEnv: "RESEND_WEBHOOK_SECRET",
      });

      if (!isValid) {
        console.error("[email-webhook] Invalid webhook signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = JSON.parse(rawBody);
    const providerEventType = payload.type || "inbound";
    const eventType = EVENT_TYPE_MAP[providerEventType] || providerEventType;
    
    console.log(`[email-webhook] Received ${providerEventType} -> ${eventType}`);

    // Parse provider payload
    const parsed = parseProviderPayload(payload, eventType);
    
    if (!parsed.email) {
      console.log("[email-webhook] No email address found in payload");
      return new Response(JSON.stringify({ status: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to get campaign_id from tags first (for outbound emails)
    let tagCampaignId = payload.data?.tags?.find(
      (tag: any) => tag.name === "campaign_id"
    )?.value;

    // Resolve context: tenant, campaign, lead, contact
    const context = await resolveContext(supabase, parsed, tagCampaignId);
    
    if (!context.tenantId) {
      console.log(`[email-webhook] No tenant found for email: ${parsed.email}`);
      // Still try to update campaign_metrics if we have campaign_id from tags
      if (tagCampaignId) {
        await updateLegacyCampaignMetrics(supabase, tagCampaignId, eventType, payload);
      }
      return new Response(JSON.stringify({ status: "no_tenant", email: parsed.email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Insert raw email_events row
    const { error: eventError } = await supabase.from("email_events").insert({
      tenant_id: context.tenantId,
      provider: "resend",
      event_type: eventType,
      provider_message_id: parsed.messageId,
      provider_thread_id: parsed.threadId,
      email_address: parsed.email,
      campaign_id: context.campaignId,
      lead_id: context.leadId,
      contact_id: context.contactId,
      sequence_run_id: context.sequenceRunId,
      meta: {
        subject: parsed.subject,
        snippet: parsed.textPreview,
        link: parsed.clickedLink,
        raw_type: providerEventType,
      },
      occurred_at: parsed.occurredAt,
    });

    if (eventError) {
      console.error("[email-webhook] Error inserting email_event:", eventError);
    } else {
      console.log(`[email-webhook] Logged ${eventType} event for ${parsed.email}`);
    }

    // 2) Insert crm_activities row (for meaningful events)
    const activityType = ACTIVITY_TYPE_MAP[eventType];
    if (activityType && context.contactId) {
      await supabase.from("crm_activities").insert({
        tenant_id: context.tenantId,
        contact_id: context.contactId,
        lead_id: context.leadId,
        activity_type: activityType,
        meta: {
          subject: parsed.subject,
          snippet: parsed.textPreview,
          provider_message_id: parsed.messageId,
          link: parsed.clickedLink,
          campaign_id: context.campaignId,
        },
      });
      console.log(`[email-webhook] Logged ${activityType} activity`);
    }

    // 3) Update lead on reply
    if (eventType === "reply" && context.leadId) {
      await updateLeadOnReply(supabase, context);
    }

    // 4) Increment campaign_channel_stats_daily
    if (context.campaignId && STAT_FIELD_MAP[eventType]) {
      const day = parsed.occurredAt.toISOString().split("T")[0];
      const { error: statsError } = await supabase.rpc("upsert_campaign_daily_stat", {
        p_tenant_id: context.tenantId,
        p_campaign_id: context.campaignId,
        p_channel: "email",
        p_day: day,
        p_stat_type: STAT_FIELD_MAP[eventType],
        p_increment: 1,
      });
      if (statsError) {
        console.error("[email-webhook] Error upserting daily stat:", statsError);
      } else {
        console.log(`[email-webhook] Incremented ${STAT_FIELD_MAP[eventType]} for campaign ${context.campaignId}`);
      }
    }

    // 5) Update legacy campaign_metrics table
    if (context.campaignId) {
      await updateLegacyCampaignMetrics(supabase, context.campaignId, eventType, payload);
    }

    // 6) For replies: increment reply_count and record snapshot
    if (eventType === "reply" && context.campaignId && context.workspaceId) {
      await supabase.rpc("increment_campaign_reply_count", {
        p_campaign_id: context.campaignId,
        p_workspace_id: context.workspaceId,
      });
      
      await supabase.rpc("record_reply_metric_snapshot", {
        p_workspace_id: context.workspaceId,
        p_campaign_id: context.campaignId,
        p_tenant_id: context.tenantId,
      });
      console.log(`[email-webhook] Recorded reply metrics for optimizer`);
    }

    // 7) Pause outbound sequence on reply
    if (eventType === "reply" && context.sequenceRunId) {
      await supabase
        .from("outbound_sequence_runs")
        .update({ status: "paused" })
        .eq("id", context.sequenceRunId);
      
      // Log to outbound_message_events
      if (context.lastStepId) {
        await supabase.from("outbound_message_events").insert({
          tenant_id: context.tenantId,
          sequence_run_id: context.sequenceRunId,
          step_id: context.lastStepId,
          event_type: "replied",
          channel: "email",
          metadata: {
            from: parsed.email,
            subject: parsed.subject,
            text_preview: parsed.textPreview,
          },
          occurred_at: parsed.occurredAt.toISOString(),
          replied_at: parsed.occurredAt.toISOString(),
        });
      }
      console.log(`[email-webhook] Paused sequence run ${context.sequenceRunId}`);
    }

    return new Response(JSON.stringify({
      status: "ok",
      event_type: eventType,
      email: parsed.email,
      tenant_id: context.tenantId,
      campaign_id: context.campaignId,
      lead_id: context.leadId,
      logged: {
        email_events: !eventError,
        crm_activities: !!activityType && !!context.contactId,
        daily_stats: !!context.campaignId && !!STAT_FIELD_MAP[eventType],
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[email-webhook] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Parse provider payload into canonical format
 */
function parseProviderPayload(payload: any, eventType: string) {
  const data = payload.data || payload;
  
  // For inbound/reply events
  if (eventType === "reply") {
    return {
      email: (data.from || payload.from || "").toLowerCase().trim(),
      messageId: data.message_id || payload.message_id,
      threadId: data.thread_id || payload.thread_id,
      subject: data.subject || payload.subject || "",
      textPreview: (data.text || payload.text || "").substring(0, 200),
      clickedLink: null,
      occurredAt: new Date(data.created_at || payload.created_at || Date.now()),
    };
  }
  
  // For outbound events (sent, delivered, open, click, bounce)
  return {
    email: (data.to?.[0] || data.email || payload.to?.[0] || "").toLowerCase().trim(),
    messageId: data.email_id || data.message_id || payload.email_id,
    threadId: null,
    subject: data.subject || "",
    textPreview: null,
    clickedLink: data.click?.link || null,
    occurredAt: new Date(data.created_at || payload.created_at || Date.now()),
  };
}

/**
 * Resolve tenant, campaign, lead, contact from email and message context
 */
async function resolveContext(supabase: any, parsed: any, tagCampaignId?: string) {
  const context: any = {
    tenantId: null,
    campaignId: tagCampaignId || null,
    leadId: null,
    contactId: null,
    sequenceRunId: null,
    workspaceId: null,
    lastStepId: null,
  };

  // Try to find contact by email
  const { data: contact } = await supabase
    .from("crm_contacts")
    .select("id, tenant_id")
    .ilike("email", parsed.email)
    .limit(1)
    .maybeSingle();

  if (contact) {
    context.tenantId = contact.tenant_id;
    context.contactId = contact.id;

    // Find most recent lead for this contact
    const { data: lead } = await supabase
      .from("crm_leads")
      .select("id, campaign_id")
      .eq("contact_id", contact.id)
      .eq("tenant_id", contact.tenant_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lead) {
      context.leadId = lead.id;
      if (!context.campaignId) {
        context.campaignId = lead.campaign_id;
      }
    }
  }

  // Try to find prospect (for Outbound OS)
  if (!context.tenantId) {
    const { data: prospect } = await supabase
      .from("prospects")
      .select("id, tenant_id")
      .ilike("email", parsed.email)
      .limit(1)
      .maybeSingle();

    if (prospect) {
      context.tenantId = prospect.tenant_id;

      // Find active sequence run
      const { data: seqRun } = await supabase
        .from("outbound_sequence_runs")
        .select("id, sequence_id, last_step_sent")
        .eq("prospect_id", prospect.id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (seqRun) {
        context.sequenceRunId = seqRun.id;

        // Get campaign from sequence
        const { data: seq } = await supabase
          .from("outbound_sequences")
          .select("campaign_id")
          .eq("id", seqRun.sequence_id)
          .maybeSingle();

        if (seq?.campaign_id && !context.campaignId) {
          context.campaignId = seq.campaign_id;
        }

        // Get last step id
        const { data: lastStep } = await supabase
          .from("outbound_sequence_steps")
          .select("id")
          .eq("sequence_id", seqRun.sequence_id)
          .eq("step_order", seqRun.last_step_sent)
          .maybeSingle();

        if (lastStep) {
          context.lastStepId = lastStep.id;
        }
      }
    }
  }

  // Get workspace_id if we have a campaign
  if (context.campaignId) {
    const { data: campaign } = await supabase
      .from("cmo_campaigns")
      .select("workspace_id")
      .eq("id", context.campaignId)
      .maybeSingle();

    if (campaign?.workspace_id) {
      context.workspaceId = campaign.workspace_id;
    }
  }

  return context;
}

/**
 * Update lead status on reply
 */
async function updateLeadOnReply(supabase: any, context: any) {
  if (!context.leadId) return;

  const { data: lead } = await supabase
    .from("crm_leads")
    .select("status")
    .eq("id", context.leadId)
    .maybeSingle();

  if (!lead) return;

  if (lead.status === "new") {
    await supabase
      .from("crm_leads")
      .update({ 
        status: "working",
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.leadId);

    await supabase.from("crm_activities").insert({
      tenant_id: context.tenantId,
      contact_id: context.contactId,
      lead_id: context.leadId,
      activity_type: "status_change",
      meta: {
        old_status: "new",
        new_status: "working",
        triggered_by: "email_reply",
      },
    });

    console.log(`[email-webhook] Updated lead ${context.leadId} status to 'working'`);
  }
}

/**
 * Update legacy campaign_metrics table for backward compatibility
 */
async function updateLegacyCampaignMetrics(supabase: any, campaignId: string, eventType: string, payload: any) {
  const { data: metrics } = await supabase
    .from("campaign_metrics")
    .select("*")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (!metrics) return;

  const updates: Record<string, unknown> = {
    last_synced_at: new Date().toISOString(),
  };

  switch (eventType) {
    case "delivered":
      updates.delivered_count = (metrics.delivered_count || 0) + 1;
      break;
    case "open":
      updates.open_count = (metrics.open_count || 0) + 1;
      break;
    case "click":
      updates.clicks = (metrics.clicks || 0) + 1;
      break;
    case "bounce":
      updates.bounce_count = (metrics.bounce_count || 0) + 1;
      break;
    case "complaint":
      updates.unsubscribe_count = (metrics.unsubscribe_count || 0) + 1;
      break;
    case "reply":
      updates.reply_count = (metrics.reply_count || 0) + 1;
      break;
  }

  // Calculate engagement rate
  const delivered = (updates.delivered_count as number) || metrics.delivered_count || 0;
  if (delivered > 0) {
    const opened = (updates.open_count as number) || metrics.open_count || 0;
    const clicked = (updates.clicks as number) || metrics.clicks || 0;
    updates.engagement_rate = Number((((opened + clicked) / delivered) * 100).toFixed(2));
  }

  await supabase
    .from("campaign_metrics")
    .update(updates)
    .eq("campaign_id", campaignId);

  console.log(`[email-webhook] Updated legacy campaign_metrics for ${campaignId}`);
}
