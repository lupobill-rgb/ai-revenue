import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
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
    const rawBody = await req.text();

    // Verify Resend/Svix webhook signature
    const isValid = await verifySvixSignature({
      req,
      rawBody,
      secretEnv: "RESEND_WEBHOOK_SECRET",
    });

    if (!isValid) {
      console.error("[email-webhook] Invalid webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const event = JSON.parse(rawBody);
    console.log("[email-webhook] Event received:", event.type);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Extract campaign_id from tags
    const campaignId = event.data?.tags?.find(
      (tag: any) => tag.name === "campaign_id"
    )?.value;

    if (!campaignId) {
      console.log("[email-webhook] No campaign_id found in event");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch current metrics
    const { data: metrics, error: metricsError } = await supabaseClient
      .from("campaign_metrics")
      .select("*")
      .eq("campaign_id", campaignId)
      .single();

    if (metricsError || !metrics) {
      console.error("[email-webhook] Metrics not found for campaign:", campaignId);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update metrics based on event type
    let updates: Record<string, unknown> = {
      last_synced_at: new Date().toISOString(),
    };

    switch (event.type) {
      case "email.delivered":
        updates.delivered_count = (metrics.delivered_count || 0) + 1;
        break;
      case "email.opened":
        updates.open_count = (metrics.open_count || 0) + 1;
        break;
      case "email.clicked":
        updates.clicks = (metrics.clicks || 0) + 1;
        break;
      case "email.bounced":
        updates.bounce_count = (metrics.bounce_count || 0) + 1;
        break;
      case "email.complained":
        updates.unsubscribe_count = (metrics.unsubscribe_count || 0) + 1;
        break;
    }

    // Calculate engagement rate
    const delivered = (updates.delivered_count as number) || metrics.delivered_count || 0;
    if (delivered > 0) {
      const opened = (updates.open_count as number) || metrics.open_count || 0;
      const clicked = (updates.clicks as number) || metrics.clicks || 0;
      updates.engagement_rate = Number((((opened + clicked) / delivered) * 100).toFixed(2));
    }

    // Update metrics
    const { error: updateError } = await supabaseClient
      .from("campaign_metrics")
      .update(updates)
      .eq("campaign_id", campaignId);

    if (updateError) {
      console.error("[email-webhook] Error updating metrics:", updateError);
    }

    console.log(`[email-webhook] Updated metrics for campaign ${campaignId}:`, updates);

    return new Response(JSON.stringify({ received: true, updated: updates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[email-webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
