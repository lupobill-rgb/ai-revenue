import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get auth header and extract JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract user ID from JWT (verify_jwt=true means Supabase already validated the token)
    const jwt = authHeader.replace('Bearer ', '');
    let userId: string;
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      userId = payload.sub;
      if (!userId) throw new Error('No user ID in token');
    } catch (e) {
      console.error('Failed to parse JWT:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's JWT for RLS enforcement
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    console.log(`[sync-campaign-metrics] User ${userId} syncing campaign metrics...`);

    // RLS will automatically filter to only campaigns the user has access to
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*, assets!inner(created_by), campaign_metrics(*)')
      .eq('status', 'active');

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError);
      throw campaignsError;
    }

    console.log(`Found ${campaigns?.length || 0} active campaigns to sync`);

    const syncResults = [];

    for (const campaign of campaigns || []) {
      try {
        // Check for existing metrics
        const existingMetrics = campaign.campaign_metrics?.[0];
        
        if (!existingMetrics) {
          console.log(`No metrics found for campaign ${campaign.id}, skipping`);
          continue;
        }

        // Calculate time since deployment
        const deployedAt = new Date(campaign.deployed_at || campaign.created_at);
        const now = new Date();
        const hoursActive = Math.max(1, (now.getTime() - deployedAt.getTime()) / (1000 * 60 * 60));

        // Channel-specific growth multipliers
        const channelMultipliers: Record<string, { impressions: number; clicks: number; conversions: number }> = {
          email: { impressions: 50, clicks: 5, conversions: 0.5 },
          social: { impressions: 200, clicks: 15, conversions: 1 },
          video: { impressions: 500, clicks: 25, conversions: 2 },
          voice: { impressions: 30, clicks: 3, conversions: 0.3 },
        };

        const multiplier = channelMultipliers[campaign.channel] || channelMultipliers.social;

        // Simulate realistic growth with some randomness
        const growthFactor = Math.random() * 0.5 + 0.75; // 0.75 to 1.25
        const newImpressions = Math.floor(existingMetrics.impressions + (multiplier.impressions * hoursActive * growthFactor));
        const newClicks = Math.floor(existingMetrics.clicks + (multiplier.clicks * hoursActive * growthFactor));
        const newConversions = Math.floor(existingMetrics.conversions + (multiplier.conversions * hoursActive * growthFactor));

        // Calculate revenue based on channel
        let estimatedRevenue = 0;
        if (campaign.channel === 'video') {
          estimatedRevenue = newImpressions * 0.05;
        } else if (campaign.channel === 'social') {
          estimatedRevenue = newClicks * 2.5;
        } else if (campaign.channel === 'email') {
          estimatedRevenue = newConversions * 50;
        } else if (campaign.channel === 'voice') {
          estimatedRevenue = newConversions * 100;
        }

        const budgetAllocated = campaign.budget_allocated || 1000;
        const costIncrement = budgetAllocated * 0.05 * hoursActive;
        const newCost = Math.min(existingMetrics.cost + costIncrement, budgetAllocated);

        // Update metrics - RLS will enforce workspace access
        const { error: updateError } = await supabase
          .from('campaign_metrics')
          .update({
            impressions: newImpressions,
            clicks: newClicks,
            conversions: newConversions,
            revenue: estimatedRevenue,
            cost: newCost,
            engagement_rate: newImpressions > 0 ? ((newClicks / newImpressions) * 100) : 0,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', existingMetrics.id);

        if (updateError) {
          console.error(`Error updating metrics for campaign ${campaign.id}:`, updateError);
        } else {
          syncResults.push({
            campaignId: campaign.id,
            channel: campaign.channel,
            success: true,
            metrics: {
              impressions: newImpressions,
              clicks: newClicks,
              conversions: newConversions,
              revenue: estimatedRevenue,
              cost: newCost,
            },
          });
        }
      } catch (error) {
        console.error(`Error syncing campaign ${campaign.id}:`, error);
        syncResults.push({
          campaignId: campaign.id,
          channel: campaign.channel,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaignsSynced: syncResults.filter(r => r.success).length,
        results: syncResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-campaign-metrics:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
