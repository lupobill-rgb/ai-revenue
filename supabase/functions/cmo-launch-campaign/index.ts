import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignInput {
  tenant_id: string;
  funnel_id?: string;
  plan_id?: string;
  campaign_name: string;
  campaign_type: string;
  objective?: string;
  description?: string;
  target_icp?: string;
  target_offer?: string;
  funnel_stage?: string;
  start_date?: string;
  end_date?: string;
  budget_allocation?: number;
  primary_kpi?: any;
  secondary_kpis?: any[];
  success_criteria?: string;
  channels?: ChannelInput[];
}

interface ChannelInput {
  channel_name: string;
  channel_type?: string;
  priority?: string;
  budget_percentage?: number;
  content_types?: any[];
  posting_frequency?: string;
  targeting_notes?: string;
  expected_metrics?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const input: CampaignInput = await req.json();
    
    if (!input.tenant_id || !input.campaign_name || !input.campaign_type) {
      return new Response(JSON.stringify({ error: 'tenant_id, campaign_name, and campaign_type are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('cmo_campaigns')
      .insert({
        tenant_id: input.tenant_id,
        tenant_id: input.tenant_id,
        funnel_id: input.funnel_id,
        plan_id: input.plan_id,
        campaign_name: input.campaign_name,
        campaign_type: input.campaign_type,
        objective: input.objective,
        description: input.description,
        target_icp: input.target_icp,
        target_offer: input.target_offer,
        funnel_stage: input.funnel_stage,
        start_date: input.start_date,
        end_date: input.end_date,
        budget_allocation: input.budget_allocation || 0,
        primary_kpi: input.primary_kpi || {},
        secondary_kpis: input.secondary_kpis || [],
        success_criteria: input.success_criteria,
        created_by: user.id,
        status: 'draft'
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Error creating campaign:', campaignError);
      return new Response(JSON.stringify({ error: campaignError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert channels if provided
    let channels: any[] = [];
    if (input.channels && input.channels.length > 0) {
      const channelInserts = input.channels.map(channel => ({
        campaign_id: campaign.id,
        channel_name: channel.channel_name,
        channel_type: channel.channel_type,
        priority: channel.priority || 'secondary',
        budget_percentage: channel.budget_percentage || 0,
        content_types: channel.content_types || [],
        posting_frequency: channel.posting_frequency,
        targeting_notes: channel.targeting_notes,
        expected_metrics: channel.expected_metrics || {}
      }));

      const { data: channelsData, error: channelsError } = await supabase
        .from('cmo_campaign_channels')
        .insert(channelInserts)
        .select();

      if (channelsError) {
        console.error('Error creating channels:', channelsError);
      } else {
        channels = channelsData || [];
      }
    }

    // Log agent run
    await supabase.from('agent_runs').insert({
      tenant_id: input.tenant_id,
      tenant_id: input.tenant_id,
      agent: 'cmo-launch-campaign',
      mode: 'launch',
      input: input,
      output: { campaign, channels },
      status: 'completed'
    });

    console.log('Campaign launched:', campaign.id, 'with', channels.length, 'channels');

    return new Response(JSON.stringify({ success: true, campaign, channels }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('cmo-launch-campaign error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
