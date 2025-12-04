import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlanInput {
  tenant_id: string;
  plan_name: string;
  plan_type?: string;
  executive_summary?: string;
  primary_objectives?: any[];
  key_metrics?: any[];
  start_date?: string;
  end_date?: string;
  budget_allocation?: any;
  channel_mix?: any[];
  month_1_plan?: any;
  month_2_plan?: any;
  month_3_plan?: any;
  campaign_themes?: any[];
  content_calendar_outline?: any[];
  resource_requirements?: any[];
  dependencies?: any[];
  risks_mitigations?: any[];
  target_icp_segments?: any[];
  target_offers?: any[];
  generation_context?: any;
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

    const planInput: PlanInput = await req.json();
    
    if (!planInput.tenant_id || !planInput.plan_name) {
      return new Response(JSON.stringify({ error: 'tenant_id and plan_name are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert plan with all fields
    const { data: plan, error: planError } = await supabase
      .from('cmo_marketing_plans')
      .insert({
        workspace_id: planInput.tenant_id,
        tenant_id: planInput.tenant_id,
        plan_name: planInput.plan_name,
        plan_type: planInput.plan_type || '90-day',
        executive_summary: planInput.executive_summary,
        primary_objectives: planInput.primary_objectives || [],
        key_metrics: planInput.key_metrics || [],
        start_date: planInput.start_date,
        end_date: planInput.end_date,
        budget_allocation: planInput.budget_allocation || {},
        channel_mix: planInput.channel_mix || [],
        month_1_plan: planInput.month_1_plan || {},
        month_2_plan: planInput.month_2_plan || {},
        month_3_plan: planInput.month_3_plan || {},
        campaign_themes: planInput.campaign_themes || [],
        content_calendar_outline: planInput.content_calendar_outline || [],
        resource_requirements: planInput.resource_requirements || [],
        dependencies: planInput.dependencies || [],
        risks_mitigations: planInput.risks_mitigations || [],
        target_icp_segments: planInput.target_icp_segments || [],
        target_offers: planInput.target_offers || [],
        generation_context: planInput.generation_context || {},
        created_by: user.id,
        status: 'draft'
      })
      .select()
      .single();

    if (planError) {
      console.error('Error creating plan:', planError);
      return new Response(JSON.stringify({ error: planError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log agent run
    await supabase.from('agent_runs').insert({
      workspace_id: planInput.tenant_id,
      tenant_id: planInput.tenant_id,
      agent: 'cmo-create-plan',
      mode: 'create',
      input: planInput,
      output: plan,
      status: 'completed'
    });

    console.log('Plan created:', plan.id);

    return new Response(JSON.stringify({ success: true, plan }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('cmo-create-plan error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
