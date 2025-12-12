import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChannelMetrics {
  sends: number;
  deliveries: number;
  opens: number;
  clicks: number;
  replies: number;
  bounces: number;
  meetingsBooked: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

interface CampaignMetricsResponse {
  campaignId: string;
  campaignName: string;
  email: ChannelMetrics;
  sms: ChannelMetrics;
  voice: ChannelMetrics;
  landing: ChannelMetrics;
  totals: ChannelMetrics;
}

function calculateRates(metrics: Omit<ChannelMetrics, 'openRate' | 'clickRate' | 'replyRate' | 'bounceRate'>): ChannelMetrics {
  return {
    ...metrics,
    openRate: metrics.deliveries > 0 ? metrics.opens / metrics.deliveries : 0,
    clickRate: metrics.opens > 0 ? metrics.clicks / metrics.opens : 0,
    replyRate: metrics.sends > 0 ? metrics.replies / metrics.sends : 0,
    bounceRate: metrics.sends > 0 ? metrics.bounces / metrics.sends : 0,
  };
}

function emptyMetrics(): ChannelMetrics {
  return {
    sends: 0,
    deliveries: 0,
    opens: 0,
    clicks: 0,
    replies: 0,
    bounces: 0,
    meetingsBooked: 0,
    openRate: 0,
    clickRate: 0,
    replyRate: 0,
    bounceRate: 0,
  };
}

serve(async (req) => {
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

    // Parse URL for campaign ID
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Extract campaign ID from path: /ai-cmo-campaign-metrics/:campaignId
    let campaignId: string | null = null;
    const metricsIndex = pathParts.findIndex(p => p === "ai-cmo-campaign-metrics");
    if (metricsIndex >= 0 && pathParts.length > metricsIndex + 1) {
      campaignId = pathParts[metricsIndex + 1];
    }

    // Also check query param
    if (!campaignId) {
      campaignId = url.searchParams.get("campaignId");
    }

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "Campaign ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching metrics for campaign: ${campaignId}, tenant: ${tenantId}`);

    // Verify campaign belongs to tenant
    const { data: campaign, error: campaignError } = await supabase
      .from("cmo_campaigns")
      .select("id, campaign_name")
      .eq("id", campaignId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch daily stats aggregated by channel
    const { data: dailyStats, error: statsError } = await supabase
      .from("campaign_channel_stats_daily")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("tenant_id", tenantId);

    if (statsError) {
      console.error("Error fetching daily stats:", statsError);
    }

    // Aggregate by channel
    const channelAggregates: Record<string, Omit<ChannelMetrics, 'openRate' | 'clickRate' | 'replyRate' | 'bounceRate'>> = {
      email: { sends: 0, deliveries: 0, opens: 0, clicks: 0, replies: 0, bounces: 0, meetingsBooked: 0 },
      sms: { sends: 0, deliveries: 0, opens: 0, clicks: 0, replies: 0, bounces: 0, meetingsBooked: 0 },
      voice: { sends: 0, deliveries: 0, opens: 0, clicks: 0, replies: 0, bounces: 0, meetingsBooked: 0 },
      landing: { sends: 0, deliveries: 0, opens: 0, clicks: 0, replies: 0, bounces: 0, meetingsBooked: 0 },
    };

    if (dailyStats) {
      for (const stat of dailyStats) {
        const channel = stat.channel?.toLowerCase() || 'email';
        if (channelAggregates[channel]) {
          channelAggregates[channel].sends += stat.sends || 0;
          channelAggregates[channel].deliveries += stat.deliveries || 0;
          channelAggregates[channel].opens += stat.opens || 0;
          channelAggregates[channel].clicks += stat.clicks || 0;
          channelAggregates[channel].replies += stat.replies || 0;
          channelAggregates[channel].bounces += stat.bounces || 0;
          channelAggregates[channel].meetingsBooked += stat.meetings_booked || 0;
        }
      }
    }

    // Calculate totals
    const totals = {
      sends: Object.values(channelAggregates).reduce((acc, c) => acc + c.sends, 0),
      deliveries: Object.values(channelAggregates).reduce((acc, c) => acc + c.deliveries, 0),
      opens: Object.values(channelAggregates).reduce((acc, c) => acc + c.opens, 0),
      clicks: Object.values(channelAggregates).reduce((acc, c) => acc + c.clicks, 0),
      replies: Object.values(channelAggregates).reduce((acc, c) => acc + c.replies, 0),
      bounces: Object.values(channelAggregates).reduce((acc, c) => acc + c.bounces, 0),
      meetingsBooked: Object.values(channelAggregates).reduce((acc, c) => acc + c.meetingsBooked, 0),
    };

    const response: CampaignMetricsResponse = {
      campaignId: campaign.id,
      campaignName: campaign.campaign_name,
      email: calculateRates(channelAggregates.email),
      sms: calculateRates(channelAggregates.sms),
      voice: calculateRates(channelAggregates.voice),
      landing: calculateRates(channelAggregates.landing),
      totals: calculateRates(totals),
    };

    console.log(`Campaign ${campaignId} metrics:`, JSON.stringify(response.totals));

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("ai-cmo-campaign-metrics error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
