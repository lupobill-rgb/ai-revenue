import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CMOMode = 
  | 'brand-intake' 
  | 'plan-90day' 
  | 'funnel-architect' 
  | 'campaign-designer' 
  | 'content-engine' 
  | 'optimization-analyst'
  | 'create-plan'
  | 'generate-funnel'
  | 'launch-campaign'
  | 'generate-content'
  | 'record-metrics'
  | 'summarize-weekly'
  | 'campaign-builder'
  | 'voice-agent-builder'
  | 'optimizer';

interface KernelRequest {
  mode: CMOMode;
  tenant_id: string;
  payload: any;
}

const MODE_TO_FUNCTION: Record<CMOMode, string> = {
  'brand-intake': 'cmo-brand-intake',
  'plan-90day': 'cmo-plan-90day',
  'funnel-architect': 'cmo-funnel-architect',
  'campaign-designer': 'cmo-campaign-designer',
  'content-engine': 'cmo-content-engine',
  'optimization-analyst': 'cmo-optimization-analyst',
  'create-plan': 'cmo-create-plan',
  'generate-funnel': 'cmo-generate-funnel',
  'launch-campaign': 'cmo-launch-campaign',
  'generate-content': 'cmo-generate-content',
  'record-metrics': 'cmo-record-metrics',
  'summarize-weekly': 'cmo-summarize-weekly',
  'campaign-builder': 'cmo-campaign-builder',
  'voice-agent-builder': 'cmo-voice-agent-builder',
  'optimizer': 'cmo-optimizer',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

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

    const { mode, tenant_id, payload }: KernelRequest = await req.json();

    if (!mode || !tenant_id) {
      return new Response(JSON.stringify({ error: 'mode and tenant_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const functionName = MODE_TO_FUNCTION[mode];
    if (!functionName) {
      return new Response(JSON.stringify({ 
        error: `Invalid mode: ${mode}`,
        validModes: Object.keys(MODE_TO_FUNCTION)
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`CMO Kernel routing: mode=${mode} -> function=${functionName}`);

    // Log the kernel run
    const { data: agentRun } = await supabase
      .from('agent_runs')
      .insert({
        workspace_id: tenant_id,
        tenant_id: tenant_id,
        agent: 'cmo-kernel',
        mode: mode,
        input: { payload },
        status: 'running'
      })
      .select()
      .single();

    // Route to the appropriate function
    const functionUrl = `${SUPABASE_URL}/functions/v1/${functionName}`;
    
    const functionResponse = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        // Include apikey when calling another Edge Function through the gateway.
        // Without it, the gateway can reject otherwise-valid JWTs depending on project config.
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id,
        ...payload
      }),
    });

    const duration = Date.now() - startTime;

    // Check if streaming response
    const contentType = functionResponse.headers.get('Content-Type');
    if (contentType?.includes('text/event-stream')) {
      // Update agent run status
      if (agentRun) {
        await supabase
          .from('agent_runs')
          .update({ 
            status: 'streaming',
            duration_ms: duration
          })
          .eq('id', agentRun.id);
      }

      // Pass through streaming response
      return new Response(functionResponse.body, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/event-stream',
          'X-CMO-Mode': mode,
          'X-CMO-Duration': duration.toString()
        },
      });
    }

    // Handle JSON response
    const result = await functionResponse.json();

    // Update agent run
    if (agentRun) {
      await supabase
        .from('agent_runs')
        .update({
          status: functionResponse.ok ? 'completed' : 'failed',
          output: result,
          duration_ms: duration,
          completed_at: new Date().toISOString(),
          error_message: !functionResponse.ok ? result.error : null
        })
        .eq('id', agentRun.id);
    }

    return new Response(JSON.stringify({
      success: functionResponse.ok,
      mode,
      duration_ms: duration,
      result
    }), {
      status: functionResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('CMO Kernel error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
