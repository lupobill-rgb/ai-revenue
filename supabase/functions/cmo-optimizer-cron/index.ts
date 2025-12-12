import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

// Execution loop modes
type CronMode = 'optimize' | 'summarize' | 'full';

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

    const mode: CronMode = body.mode || 'optimize';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`CMO Orchestration Cron: Starting ${mode} run at ${new Date().toISOString()}`);

    // Get all unique tenant IDs that have autopilot campaigns
    const { data: tenants, error: tenantsError } = await supabase
      .from("cmo_campaigns")
      .select("tenant_id")
      .eq("autopilot_enabled", true)
      .eq("status", "active");

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    // Deduplicate tenant IDs
    const uniqueTenantIds = [...new Set(tenants?.map(t => t.tenant_id) || [])];
    console.log(`Found ${uniqueTenantIds.length} tenants with autopilot campaigns`);

    const tenantResults: any[] = [];

    for (const tenantId of uniqueTenantIds) {
      try {
        console.log(`Processing tenant: ${tenantId}`);

        // Route through orchestrator for unified execution
        const orchestratorResponse = await fetch(
          `${supabaseUrl}/functions/v1/cmo-orchestrator`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-secret": internalSecret || "",
            },
            body: JSON.stringify({
              tenant_id: tenantId,
              action: mode === 'full' ? 'run_daily_loop' : 
                      mode === 'summarize' ? 'generate_weekly_summary' :
                      'optimize_all_autopilot_campaigns',
              context: {
                triggered_by: 'cron',
                run_time: new Date().toISOString(),
              },
            }),
          }
        );

        if (orchestratorResponse.ok) {
          const result = await orchestratorResponse.json();
          tenantResults.push({
            tenantId,
            status: "success",
            agentsInvoked: result.agents_invoked || [],
            assetsUpdated: result.assets_updated || 0,
            summary: result.summary,
          });
        } else {
          const errorText = await orchestratorResponse.text();
          console.error(`Orchestrator failed for tenant ${tenantId}:`, errorText);
          tenantResults.push({
            tenantId,
            status: "error",
            error: errorText,
          });
        }

        // Log agent run for audit trail
        await supabase.from("agent_runs").insert({
          tenant_id: tenantId,
          workspace_id: tenantId,
          agent: "cmo_orchestrator_cron",
          mode: mode,
          input: { triggered_by: 'cron', mode },
          output: tenantResults[tenantResults.length - 1],
          status: tenantResults[tenantResults.length - 1].status === "success" ? "completed" : "failed",
        });

      } catch (tenantError) {
        console.error(`Error processing tenant ${tenantId}:`, tenantError);
        tenantResults.push({
          tenantId,
          status: "error",
          error: tenantError instanceof Error ? tenantError.message : "Unknown error",
        });
      }
    }

    // If mode is 'full', also run individual campaign optimizations
    if (mode === 'full' || mode === 'optimize') {
      const campaignResults = await optimizeAllCampaigns(supabase, supabaseUrl, internalSecret || '');
      
      console.log(`CMO Optimizer Cron: Completed. Processed ${campaignResults.length} campaigns`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          mode,
          tenants_processed: tenantResults.length,
          campaigns_processed: campaignResults.length,
          tenant_results: tenantResults,
          campaign_results: campaignResults,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        mode,
        tenants_processed: tenantResults.length,
        tenant_results: tenantResults,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("CMO Orchestration Cron error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to optimize all campaigns
async function optimizeAllCampaigns(
  supabase: any, 
  supabaseUrl: string, 
  internalSecret: string
): Promise<any[]> {
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
      console.log(`Optimizing campaign: ${campaign.campaign_name} (${campaign.id})`);

      // Fetch aggregated metrics from campaign_channel_stats_daily
      const { data: dailyStats } = await supabase
        .from("campaign_channel_stats_daily")
        .select("sends, deliveries, opens, clicks, replies, bounces, meetings_booked, channel")
        .eq("campaign_id", campaign.id)
        .eq("tenant_id", campaign.tenant_id);

      // Aggregate all channel stats
      const aggregatedStats = (dailyStats || []).reduce(
        (acc: any, s: any) => ({
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
        metrics = aggregatedStats;
      } else {
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

      console.log(`Campaign ${campaign.id} metrics:`, metrics);

      // Call the optimizer function
      const optimizerResponse = await fetch(
        `${supabaseUrl}/functions/v1/cmo-optimizer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": internalSecret,
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

        // Update campaign with last optimization timestamp
        await supabase
          .from("cmo_campaigns")
          .update({
            last_optimization_at: new Date().toISOString(),
            last_optimization_note: optimizerResult.summary?.substring(0, 500),
          })
          .eq("id", campaign.id);

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

  return results;
}
