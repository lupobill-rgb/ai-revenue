import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FunnelInput {
  tenant_id: string;
  plan_id?: string;
  funnel_name: string;
  funnel_type?: string;
  description?: string;
  target_icp_segments?: any[];
  target_offers?: any[];
  total_budget?: number;
  expected_conversion_rate?: number;
  expected_revenue?: number;
  stages?: StageInput[];
}

interface StageInput {
  stage_name: string;
  stage_type: string;
  stage_order: number;
  description?: string;
  objective?: string;
  entry_criteria?: string;
  exit_criteria?: string;
  kpis?: any[];
  campaign_types?: any[];
  channels?: any[];
  content_assets?: any[];
  target_icps?: any[];
  linked_offers?: any[];
  budget_allocation?: number;
  conversion_rate_target?: number;
  expected_volume?: number;
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

    const input: FunnelInput = await req.json();
    
    if (!input.tenant_id || !input.funnel_name) {
      return new Response(JSON.stringify({ error: 'tenant_id and funnel_name are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert funnel
    const { data: funnel, error: funnelError } = await supabase
      .from('cmo_funnels')
      .insert({
        tenant_id: input.tenant_id,
        tenant_id: input.tenant_id,
        plan_id: input.plan_id,
        funnel_name: input.funnel_name,
        funnel_type: input.funnel_type || 'marketing',
        description: input.description,
        target_icp_segments: input.target_icp_segments || [],
        target_offers: input.target_offers || [],
        total_budget: input.total_budget || 0,
        expected_conversion_rate: input.expected_conversion_rate || 0,
        expected_revenue: input.expected_revenue || 0,
        created_by: user.id,
        status: 'draft'
      })
      .select()
      .single();

    if (funnelError) {
      console.error('Error creating funnel:', funnelError);
      return new Response(JSON.stringify({ error: funnelError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert stages if provided
    let stages: any[] = [];
    if (input.stages && input.stages.length > 0) {
      const stageInserts = input.stages.map((stage, index) => ({
        funnel_id: funnel.id,
        stage_name: stage.stage_name,
        stage_type: stage.stage_type,
        stage_order: stage.stage_order ?? index,
        description: stage.description,
        objective: stage.objective,
        entry_criteria: stage.entry_criteria,
        exit_criteria: stage.exit_criteria,
        kpis: stage.kpis || [],
        campaign_types: stage.campaign_types || [],
        channels: stage.channels || [],
        content_assets: stage.content_assets || [],
        target_icps: stage.target_icps || [],
        linked_offers: stage.linked_offers || [],
        budget_allocation: stage.budget_allocation || 0,
        conversion_rate_target: stage.conversion_rate_target || 0,
        expected_volume: stage.expected_volume || 0
      }));

      const { data: stagesData, error: stagesError } = await supabase
        .from('cmo_funnel_stages')
        .insert(stageInserts)
        .select();

      if (stagesError) {
        console.error('Error creating stages:', stagesError);
      } else {
        stages = stagesData || [];
      }
    }

    // Log agent run
    await supabase.from('agent_runs').insert({
      tenant_id: input.tenant_id,
      tenant_id: input.tenant_id,
      agent: 'cmo-generate-funnel',
      mode: 'generate',
      input: input,
      output: { funnel, stages },
      status: 'completed'
    });

    console.log('Funnel created:', funnel.id, 'with', stages.length, 'stages');

    return new Response(JSON.stringify({ success: true, funnel, stages }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('cmo-generate-funnel error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
