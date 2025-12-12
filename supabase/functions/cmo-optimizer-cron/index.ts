import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");

    // Verify internal secret for cron calls
    const headerSecret = req.headers.get("x-internal-secret");
    const body = await req.json().catch(() => ({}));
    
    if (!headerSecret && !body.cron) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - internal use only" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (headerSecret && headerSecret !== internalSecret) {
      return new Response(
        JSON.stringify({ error: "Invalid internal secret" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("CMO Optimizer Cron: Starting daily optimization run...");

    // Query all autopilot-enabled campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from("cmo_campaigns")
      .select("id, tenant_id, workspace_id, campaign_name, goal")
      .eq("autopilot_enabled", true)
      .eq("status", "active");

    if (campaignsError) {
      console.error("Error fetching campaigns:", campaignsError);
      throw new Error(`Failed to fetch campaigns: ${campaignsError.message}`);
    }

    console.log(`Found ${campaigns?.length || 0} autopilot campaigns to optimize`);

    const results: any[] = [];

    for (const campaign of campaigns || []) {
      try {
        console.log(`Triggering optimizer for: ${campaign.campaign_name} (${campaign.id})`);

        // Fetch aggregated metrics from campaign_channel_stats_daily (primary source)
        const { data: dailyStats } = await supabase
          .from("campaign_channel_stats_daily")
          .select("sends, deliveries, opens, clicks, replies, bounces, meetings_booked, channel")
          .eq("campaign_id", campaign.id)
          .eq("tenant_id", campaign.tenant_id);

        // Aggregate all channel stats
        const aggregatedStats = (dailyStats || []).reduce(
          (acc, s) => ({
            sends: acc.sends + (s.sends || 0),
            deliveries: acc.deliveries + (s.deliveries || 0),
            opens: acc.opens + (s.opens || 0),
            clicks: acc.clicks + (s.clicks || 0),
            replies: acc.replies + (s.replies || 0),
            bounces: acc.bounces + (s.bounces || 0),
            meetings_booked: acc.meetings_booked + (s.meetings_booked || 0),
          }),
          { sends: 0, deliveries: 0, opens: 0, clicks: 0, replies: 0, bounces: 0, meetings_booked: 0 }
        );

        // Fallback to legacy metrics if daily stats empty
        let metrics;
        if (aggregatedStats.sends > 0 || aggregatedStats.opens > 0) {
          metrics = {
            sends: aggregatedStats.sends,
            deliveries: aggregatedStats.deliveries,
            opens: aggregatedStats.opens,
            clicks: aggregatedStats.clicks,
            replies: aggregatedStats.replies,
            bounces: aggregatedStats.bounces,
            booked_meetings: aggregatedStats.meetings_booked,
          };
        } else {
          // Fallback to campaign_metrics table
          const { data: campaignMetrics } = await supabase
            .from("campaign_metrics")
            .select("sent_count, delivered_count, open_count, clicks, reply_count, bounce_count")
            .eq("campaign_id", campaign.id)
            .maybeSingle();

          metrics = {
            sends: campaignMetrics?.sent_count || 0,
            deliveries: campaignMetrics?.delivered_count || 0,
            opens: campaignMetrics?.open_count || 0,
            clicks: campaignMetrics?.clicks || 0,
            replies: campaignMetrics?.reply_count || 0,
            bounces: campaignMetrics?.bounce_count || 0,
            booked_meetings: 0,
          };
        }

        // Calculate rates for context
        const openRate = metrics.deliveries > 0 ? (metrics.opens / metrics.deliveries * 100).toFixed(1) : 0;
        const clickRate = metrics.opens > 0 ? (metrics.clicks / metrics.opens * 100).toFixed(1) : 0;
        const replyRate = metrics.sends > 0 ? (metrics.replies / metrics.sends * 100).toFixed(1) : 0;

        console.log(`Campaign ${campaign.id} metrics: sends=${metrics.sends}, opens=${metrics.opens}, clicks=${metrics.clicks}, replies=${metrics.replies}, meetings=${metrics.booked_meetings}`);

        // Call the optimizer function
        const optimizerResponse = await fetch(
          `${supabaseUrl}/functions/v1/cmo-optimizer`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-secret": internalSecret || "",
            },
            body: JSON.stringify({
              tenant_id: campaign.tenant_id,
              workspace_id: campaign.workspace_id,
              campaign_id: campaign.id,
              goal: campaign.goal || "leads",
              metrics,
              constraints: [
                "Do not change brand voice or tone",
                "Keep within existing budget allocation",
              ],
            }),
          }
        );

        if (optimizerResponse.ok) {
          const optimizerResult = await optimizerResponse.json();
          results.push({
            campaignId: campaign.id,
            campaignName: campaign.campaign_name,
            status: "optimized",
            changesApplied: optimizerResult.applied_changes?.length || 0,
            summary: optimizerResult.summary,
          });
        } else {
          const errorText = await optimizerResponse.text();
          console.error(`Optimizer failed for ${campaign.id}:`, errorText);
          results.push({
            campaignId: campaign.id,
            campaignName: campaign.campaign_name,
            status: "error",
            error: errorText,
          });
        }
      } catch (campaignError) {
        console.error(`Error optimizing campaign ${campaign.id}:`, campaignError);
        results.push({
          campaignId: campaign.id,
          campaignName: campaign.campaign_name,
          status: "error",
          error: campaignError instanceof Error ? campaignError.message : "Unknown error",
        });
      }
    }

    console.log(`CMO Optimizer Cron: Completed. Processed ${results.length} campaigns`);

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("CMO Optimizer Cron error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
