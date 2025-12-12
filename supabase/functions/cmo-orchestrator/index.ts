import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * AI CMO Orchestrator
 * 
 * Single source of truth for all AI CMO operations.
 * All CMO agent calls route through this orchestrator.
 * 
 * Architecture: One brain, many hands
 * - Orchestrator coordinates and sequences agents
 * - Specialized agents handle specific tasks
 * - All actions are tenant-scoped and CRM-integrated
 */

interface OrchestratorRequest {
  tenant_id: string;
  workspace_id: string;
  action: string;
  context?: {
    campaign_id?: string;
    lead_id?: string;
    trigger_source?: string;
  };
  payload: Record<string, unknown>;
  system_prompt?: string;
  config?: {
    model: string;
    temperature: number;
    max_tokens: number;
    timeout_ms: number;
  };
  run_id?: string;
}

// Agent routing map - orchestrator delegates to specialized agents
const AGENT_FUNCTIONS: Record<string, string> = {
  'campaign_builder': 'cmo-campaign-builder',
  'landing_page_generator': 'ai-cmo-landing-pages-generate',
  'content_humanizer': 'ai-cmo-humanize',
  'email_reply_analyzer': 'cmo-email-reply-analyzer',
  'campaign_optimizer': 'cmo-optimizer',
  'voice_orchestrator': 'cmo-voice-agent-builder',
};

// Action to agent mapping
const ACTION_TO_AGENTS: Record<string, string[]> = {
  'create_campaign': ['campaign_builder', 'landing_page_generator', 'content_humanizer'],
  'optimize_campaign': ['campaign_optimizer'],
  'handle_reply': ['email_reply_analyzer'],
  'deploy_voice': ['voice_orchestrator'],
  'regenerate_content': ['content_humanizer'],
  'generate_landing_page': ['landing_page_generator'],
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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

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

    const request: OrchestratorRequest = await req.json();
    const { tenant_id, workspace_id, action, context, payload, system_prompt, config, run_id } = request;

    // === GUARDRAIL: Validate tenant_id ===
    if (!tenant_id) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'tenant_id is required',
        action_taken: 'validation_failed',
        agents_invoked: []
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[CMO Orchestrator] Action: ${action}, Tenant: ${tenant_id}, Run: ${run_id}`);

    // Get agents to invoke for this action
    const agentsToInvoke = ACTION_TO_AGENTS[action] || [];
    if (agentsToInvoke.length === 0) {
      console.log(`[CMO Orchestrator] Unknown action: ${action}, treating as direct agent call`);
    }

    const agentsInvoked: Array<{
      agent_name: string;
      input_summary: string;
      output_summary: string;
      duration_ms: number;
    }> = [];

    const assetsCreated: Array<{
      asset_type: string;
      asset_id: string;
      status: string;
    }> = [];

    const crmUpdates: Array<{
      entity_type: string;
      entity_id: string;
      action: string;
    }> = [];

    const errors: Array<{
      agent: string;
      error_code: string;
      message: string;
    }> = [];

    // If this is an AI-driven orchestration decision, use LLM to determine flow
    if (LOVABLE_API_KEY && system_prompt) {
      // Use orchestrator LLM to determine optimal agent sequence
      const orchestratorPrompt = `
${system_prompt}

## Current Request

Action: ${action}
Tenant: ${tenant_id}
Context: ${JSON.stringify(context || {})}
Payload: ${JSON.stringify(payload)}

## Task

Determine the optimal sequence of agents to invoke for this request.
Return a JSON object with:
- agents_to_invoke: array of agent names in order
- reasoning: brief explanation of the sequence
- skip_agents: any agents to skip and why
`;

      try {
        const llmResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config?.model || 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: system_prompt },
              { role: 'user', content: `Action: ${action}\nPayload: ${JSON.stringify(payload)}` }
            ],
            temperature: config?.temperature || 0.2,
            max_tokens: config?.max_tokens || 2000,
          }),
        });

        if (llmResponse.ok) {
          const llmData = await llmResponse.json();
          const orchestratorDecision = llmData.choices?.[0]?.message?.content;
          console.log(`[CMO Orchestrator] LLM decision: ${orchestratorDecision?.substring(0, 200)}...`);
        }
      } catch (llmError) {
        console.warn('[CMO Orchestrator] LLM orchestration failed, using default flow:', llmError);
      }
    }

    // Execute agents in sequence
    for (const agentName of agentsToInvoke) {
      const functionName = AGENT_FUNCTIONS[agentName];
      if (!functionName) {
        console.warn(`[CMO Orchestrator] Unknown agent: ${agentName}`);
        continue;
      }

      const agentStartTime = Date.now();

      try {
        const functionUrl = `${SUPABASE_URL}/functions/v1/${functionName}`;
        
        const agentResponse = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_id,
            workspace_id,
            ...payload,
            context,
            orchestrator_run_id: run_id,
          }),
        });

        const agentDuration = Date.now() - agentStartTime;
        const agentResult = await agentResponse.json();

        agentsInvoked.push({
          agent_name: agentName,
          input_summary: `${action} with ${Object.keys(payload).length} payload keys`,
          output_summary: agentResponse.ok ? 'success' : agentResult.error || 'failed',
          duration_ms: agentDuration,
        });

        // Collect assets created by agent
        if (agentResult.assets) {
          for (const asset of agentResult.assets) {
            assetsCreated.push({
              asset_type: asset.type || agentName,
              asset_id: asset.id,
              status: 'created',
            });
          }
        }

        // Collect CRM updates
        if (agentResult.crm_updates) {
          crmUpdates.push(...agentResult.crm_updates);
        }

        if (!agentResponse.ok) {
          errors.push({
            agent: agentName,
            error_code: 'AGENT_ERROR',
            message: agentResult.error || 'Agent execution failed',
          });
        }

      } catch (agentError) {
        const agentDuration = Date.now() - agentStartTime;
        console.error(`[CMO Orchestrator] Agent ${agentName} error:`, agentError);
        
        agentsInvoked.push({
          agent_name: agentName,
          input_summary: `${action} with ${Object.keys(payload).length} payload keys`,
          output_summary: 'exception',
          duration_ms: agentDuration,
        });

        errors.push({
          agent: agentName,
          error_code: 'EXCEPTION',
          message: agentError instanceof Error ? agentError.message : 'Unknown error',
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const hasErrors = errors.length > 0;

    console.log(`[CMO Orchestrator] Completed: ${agentsInvoked.length} agents, ${errors.length} errors, ${totalDuration}ms`);

    return new Response(JSON.stringify({
      success: !hasErrors || agentsInvoked.some(a => a.output_summary === 'success'),
      action_taken: action,
      agents_invoked: agentsInvoked,
      assets_created: assetsCreated.length > 0 ? assetsCreated : undefined,
      crm_updates: crmUpdates.length > 0 ? crmUpdates : undefined,
      next_actions: [],
      errors: hasErrors ? errors : undefined,
      duration_ms: totalDuration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[CMO Orchestrator] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      action_taken: 'exception',
      agents_invoked: [],
      errors: [{
        agent: 'orchestrator',
        error_code: 'FATAL',
        message: error instanceof Error ? error.message : 'Unknown error',
      }],
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
