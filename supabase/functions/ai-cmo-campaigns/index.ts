import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant context
    const { data: userTenant } = await supabase
      .from("user_tenants")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const tenantId = userTenant?.tenant_id || user.id;

    // Parse URL to determine route
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Route: GET /ai-cmo-campaigns/:id/optimizations
    if (req.method === "GET" && pathParts.length >= 2 && pathParts[pathParts.length - 1] === "optimizations") {
      const campaignId = pathParts[pathParts.length - 2];
      
      if (!campaignId || campaignId === "ai-cmo-campaigns") {
        return new Response(
          JSON.stringify({ error: "Campaign ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Fetching optimizations for campaign: ${campaignId}`);

      const { data: optimizations, error: optError } = await supabase
        .from("campaign_optimizations")
        .select("id, created_at, summary")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });

      if (optError) {
        console.error("Error fetching optimizations:", optError);
        return new Response(
          JSON.stringify({ error: optError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = (optimizations || []).map(opt => ({
        id: opt.id,
        createdAt: opt.created_at,
        summary: opt.summary || "No summary available",
      }));

      console.log(`Found ${response.length} optimizations for campaign ${campaignId}`);

      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default route: GET /ai-cmo-campaigns - List all campaigns
    // Fetch campaigns with channels
    const { data: campaigns, error: campaignsError } = await supabase
      .from("cmo_campaigns")
      .select(`
        id,
        campaign_name,
        status,
        autopilot_enabled,
        goal,
        last_optimization_at,
        last_optimization_note,
        created_at,
        channels:cmo_campaign_channels(channel_name)
      `)
      .eq("workspace_id", tenantId)
      .order("created_at", { ascending: false });

    if (campaignsError) {
      console.error("Error fetching campaigns:", campaignsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch campaigns" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get workspace for leads/meetings aggregation
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    const workspaceId = workspace?.id;

    // Aggregate leads count per campaign (if leads table exists)
    let leadsCountMap: Record<string, number> = {};
    let meetingsCountMap: Record<string, number> = {};

    if (workspaceId) {
      // Try to get leads counts - campaigns may be linked to leads via tags or other mechanisms
      const { data: leads } = await supabase
        .from("leads")
        .select("id, tags")
        .eq("workspace_id", workspaceId);

      // For now, return 0 - real implementation would join on campaign_id or tags
      // This is a placeholder for actual lead-campaign relationship

      // Try to get meetings/bookings count from outbound data
      const { data: sequenceRuns } = await supabase
        .from("outbound_sequence_runs")
        .select("id, campaign_id, status")
        .eq("status", "booked");

      if (sequenceRuns) {
        sequenceRuns.forEach((run: any) => {
          if (run.campaign_id) {
            meetingsCountMap[run.campaign_id] = (meetingsCountMap[run.campaign_id] || 0) + 1;
          }
        });
      }
    }

    // Format response
    const response = (campaigns || []).map((campaign: any) => ({
      id: campaign.id,
      name: campaign.campaign_name,
      status: campaign.status || "draft",
      channels: campaign.channels?.map((c: any) => c.channel_name) || [],
      leadsCount: leadsCountMap[campaign.id] || 0,
      meetingsCount: meetingsCountMap[campaign.id] || 0,
      autopilotEnabled: campaign.autopilot_enabled || false,
      goal: campaign.goal || null,
      lastOptimizationAt: campaign.last_optimization_at || null,
      lastOptimizationNote: campaign.last_optimization_note || null,
    }));

    console.log(`Fetched ${response.length} campaigns for tenant ${tenantId}`);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("ai-cmo-campaigns error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
