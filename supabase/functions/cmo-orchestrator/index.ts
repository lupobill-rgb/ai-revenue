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
 * - Specialized agents are invoked via the internal routing table
 * - No free-floating LLM calls - everything goes through kernel
 */

interface OrchestratorRequest {
  tenant_id: string;
  workspace_id: string;
  action: string;
  context?: {
    campaign_id?: string;
    lead_id?: string;
    trigger_source?: string;
    brand_profile?: Record<string, unknown>;
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

/**
 * Internal Routing Table
 * Maps agent IDs to their edge function endpoints
 * This is the ONLY way to invoke specialist agents
 */
const AI_CMO_AGENTS = {
  campaignBuilder: "ai_cmo_campaign_builder",
  landingGenerator: "ai_cmo_landing_page_generator",
  humanizer: "ai_cmo_content_humanizer",
  emailReplyAnalyzer: "ai_cmo_email_reply_analyzer",
  optimizer: "ai_cmo_campaign_optimizer",
  voiceOrchestrator: "ai_cmo_voice_orchestrator"
} as const;

type AiCmoAgentId = typeof AI_CMO_AGENTS[keyof typeof AI_CMO_AGENTS];

/**
 * Agent to Edge Function mapping
 */
const AGENT_FUNCTIONS: Record<string, string> = {
  [AI_CMO_AGENTS.campaignBuilder]: 'cmo-campaign-builder',
  [AI_CMO_AGENTS.landingGenerator]: 'ai-cmo-landing-pages-generate',
  [AI_CMO_AGENTS.humanizer]: 'ai-cmo-humanize',
  [AI_CMO_AGENTS.emailReplyAnalyzer]: 'cmo-email-reply-analyzer',
  [AI_CMO_AGENTS.optimizer]: 'cmo-optimizer',
  [AI_CMO_AGENTS.voiceOrchestrator]: 'cmo-voice-agent-builder',
  // Legacy mappings for backward compatibility
  'campaign_builder': 'cmo-campaign-builder',
  'landing_page_generator': 'ai-cmo-landing-pages-generate',
  'content_humanizer': 'ai-cmo-humanize',
  'email_reply_analyzer': 'cmo-email-reply-analyzer',
  'campaign_optimizer': 'cmo-optimizer',
  'voice_orchestrator': 'cmo-voice-agent-builder',
};

/**
 * Action to Agent routing
 * Defines which agents are invoked for each orchestrator action
 */
const ACTION_TO_AGENTS: Record<string, AiCmoAgentId[]> = {
  'create_campaign': [AI_CMO_AGENTS.campaignBuilder, AI_CMO_AGENTS.landingGenerator, AI_CMO_AGENTS.humanizer],
  'build_campaign': [AI_CMO_AGENTS.campaignBuilder],
  'optimize_campaign': [AI_CMO_AGENTS.optimizer],
  'handle_reply': [AI_CMO_AGENTS.emailReplyAnalyzer],
  'analyze_reply': [AI_CMO_AGENTS.emailReplyAnalyzer],
  'deploy_voice': [AI_CMO_AGENTS.voiceOrchestrator],
  'orchestrate_voice': [AI_CMO_AGENTS.voiceOrchestrator],
  'regenerate_content': [AI_CMO_AGENTS.humanizer],
  'humanize_content': [AI_CMO_AGENTS.humanizer],
  'generate_landing_page': [AI_CMO_AGENTS.landingGenerator],
};

/**
 * Tool definitions exposed to the orchestrator LLM
 * These are the ONLY ways the orchestrator can invoke specialist agents
 */
const ORCHESTRATOR_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "call_campaign_builder",
      description: "Build a complete multi-channel campaign including content, landing pages, automations, and voice scripts",
      parameters: {
        type: "object",
        properties: {
          icp_description: { type: "string", description: "Target ICP description" },
          offer_details: { type: "string", description: "Product/service offer details" },
          channels: { type: "string", description: "Comma-separated channels: email,sms,linkedin,voice,landing_page" },
          goal: { type: "string", description: "Primary goal: leads, meetings, revenue, engagement" },
          campaign_name: { type: "string", description: "Name for the campaign" }
        },
        required: ["icp_description", "offer_details", "channels", "goal"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "call_landing_generator",
      description: "Generate a conversion-optimized landing page connected to CRM",
      parameters: {
        type: "object",
        properties: {
          template_type: { type: "string", description: "Template: saas, lead_magnet, webinar, services, booking, long_form" },
          headline: { type: "string", description: "Main headline for the page" },
          offer: { type: "string", description: "What is being offered" },
          icp: { type: "string", description: "Target audience description" },
          cta_type: { type: "string", description: "CTA type: form, booking, download" }
        },
        required: ["template_type", "offer", "icp"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "call_humanizer",
      description: "Refine AI-generated content to remove robotic tone and improve realism",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "The content to humanize" },
          content_type: { type: "string", description: "Type: email, social, landing, voice_script" },
          brand_voice: { type: "string", description: "Brand voice guidelines" },
          intensity: { type: "string", description: "Humanization level: light, medium, heavy" }
        },
        required: ["content", "content_type"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "call_email_reply_analyzer",
      description: "Analyze an inbound email reply, classify intent, and recommend next actions",
      parameters: {
        type: "object",
        properties: {
          reply_text: { type: "string", description: "The email reply content" },
          original_message: { type: "string", description: "The original outbound message" },
          lead_context: { type: "string", description: "JSON context about the lead" },
          campaign_goal: { type: "string", description: "The campaign's primary goal" }
        },
        required: ["reply_text"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "call_optimizer",
      description: "Analyze campaign performance and recommend optimizations",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "Campaign ID to optimize" },
          metrics: { type: "string", description: "JSON performance metrics" },
          assets: { type: "string", description: "JSON current campaign assets" },
          goal: { type: "string", description: "Optimization goal: leads, meetings, revenue" }
        },
        required: ["campaign_id", "metrics"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "call_voice_orchestrator",
      description: "Deploy and manage AI voice agents within sequences",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", description: "Action: create_agent, update_script, handle_outcome, select_agent" },
          lead_context: { type: "string", description: "JSON context about the lead" },
          campaign_context: { type: "string", description: "JSON campaign details" },
          call_outcome: { type: "string", description: "For handle_outcome: the call result" }
        },
        required: ["action"]
      }
    }
  }
];

/**
 * Tool name to agent ID mapping
 */
const TOOL_TO_AGENT: Record<string, AiCmoAgentId> = {
  'call_campaign_builder': AI_CMO_AGENTS.campaignBuilder,
  'call_landing_generator': AI_CMO_AGENTS.landingGenerator,
  'call_humanizer': AI_CMO_AGENTS.humanizer,
  'call_email_reply_analyzer': AI_CMO_AGENTS.emailReplyAnalyzer,
  'call_optimizer': AI_CMO_AGENTS.optimizer,
  'call_voice_orchestrator': AI_CMO_AGENTS.voiceOrchestrator,
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
