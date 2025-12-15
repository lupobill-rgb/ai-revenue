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

        // Fetch metrics snapshots for this campaign
        const { data: metricsSnapshots } = await supabase
          .from("cmo_metrics_snapshots")
          .select("impressions, clicks, conversions, cost, revenue, metric_type, custom_metrics")
          .eq("campaign_id", campaign.id)
          .order("snapshot_date", { ascending: false })
          .limit(30);

        // Fetch reply count from campaign_metrics table
        const { data: campaignMetrics } = await supabase
          .from("campaign_metrics")
          .select("reply_count, open_count, clicks")
          .eq("campaign_id", campaign.id)
          .maybeSingle();

        // Aggregate metrics from snapshots
        const snapshotMetrics = (metricsSnapshots || []).reduce(
          (acc, m) => ({
            opens: acc.opens + (m.impressions || 0),
            clicks: acc.clicks + (m.clicks || 0),
            // Count email_reply metric_type entries as replies
            replies: acc.replies + (m.metric_type === 'email_reply' ? (m.conversions || 0) : 0),
            conversions: acc.conversions + (m.metric_type !== 'email_reply' ? (m.conversions || 0) : 0),
          }),
          { opens: 0, clicks: 0, replies: 0, conversions: 0 }
        );

        // Combine with campaign_metrics reply_count (prefer campaign_metrics as authoritative)
        const metrics = {
          opens: campaignMetrics?.open_count || snapshotMetrics.opens,
          clicks: campaignMetrics?.clicks || snapshotMetrics.clicks,
          replies: campaignMetrics?.reply_count || snapshotMetrics.replies,
          booked_meetings: 0, // Will be populated from other sources
        };

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
