/**
 * AI CMO Tool Execution Layer
 * Each tool injects the specialist's system prompt, calls the LLM, and returns structured JSON
 * NO SPECIALIST EVER BYPASSES THE ORCHESTRATOR
 */

import { aiCmoAgents, getAgentIdFromTool, type AiCmoAgentId } from './ai_cmo_routes';

/**
 * Specialist system prompts - loaded from prompt contracts
 * In production, these are loaded from module_prompts/ai_cmo/*.md
 */
const specialistPrompts: Record<AiCmoAgentId, string> = {
  ai_cmo_campaign_builder: `You are the AI CMO Campaign Builder agent.
You build complete multi-channel campaigns including content, landing pages, automations, and voice scripts.
Always return structured JSON with: campaign_id, assets[], automations[], summary.
Never generate placeholder content - all outputs must be production-ready.`,

  ai_cmo_landing_page_generator: `You are the AI CMO Landing Page Generator agent.
You create conversion-optimized landing pages that connect directly to the CRM.
Always return structured JSON with: page_id, template_type, sections[], form_config, cta_config.
All forms must auto-wire to CRM upsert functions.`,

  ai_cmo_content_humanizer: `You are the AI CMO Content Humanizer agent.
You refine AI-generated content to remove robotic tone and improve realism.
Always return structured JSON with: humanized_content, changes_made[], confidence_score.
Content must sound like a real human operator wrote it.`,

  ai_cmo_email_reply_analyzer: `You are the AI CMO Email Reply Analyzer agent.
You analyze inbound email replies, classify intent, and recommend next actions.
Always return structured JSON with: intent, sentiment, recommended_action, confidence_score, extracted_info.
Intent categories: interested, not_interested, meeting_request, question, objection, out_of_office, unsubscribe.`,

  ai_cmo_campaign_optimizer: `You are the AI CMO Campaign Optimizer agent.
You analyze campaign performance and recommend optimizations based on real data.
Always return structured JSON with: recommendations[], priority_changes[], metrics_analysis.
Optimize for: replies > meetings > conversions > clicks > opens.`,

  ai_cmo_voice_orchestrator: `You are the AI CMO Voice Orchestrator agent.
You deploy and manage AI voice agents within sequences.
Always return structured JSON with: action_result, agent_config, script_updates, next_steps.
Voice agents must be compliant, natural-sounding, and outcome-focused.`
};

export interface ToolExecutionRequest {
  toolName: string;
  parameters: Record<string, unknown>;
  tenantId: string;
  workspaceId: string;
  context?: {
    brandProfile?: Record<string, unknown>;
    campaignId?: string;
    leadId?: string;
  };
}

export interface ToolExecutionResult {
  success: boolean;
  agentId: AiCmoAgentId;
  output: Record<string, unknown>;
  error?: string;
  executionTimeMs?: number;
}

/**
 * Execute a specialist tool
 * This is the ONLY way to invoke specialist agents
 */
export async function executeSpecialistTool(
  request: ToolExecutionRequest,
  llmClient: {
    call: (systemPrompt: string, userMessage: string) => Promise<string>;
  }
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  
  const agentId = getAgentIdFromTool(request.toolName);
  if (!agentId) {
    return {
      success: false,
      agentId: aiCmoAgents.campaignBuilder, // fallback for type safety
      output: {},
      error: `Unknown tool: ${request.toolName}`
    };
  }

  const systemPrompt = specialistPrompts[agentId];
  if (!systemPrompt) {
    return {
      success: false,
      agentId,
      output: {},
      error: `No system prompt found for agent: ${agentId}`
    };
  }

  // Build user message from parameters and context
  const userMessage = buildUserMessage(request);

  try {
    const response = await llmClient.call(systemPrompt, userMessage);
    const output = parseStructuredOutput(response);

    return {
      success: true,
      agentId,
      output,
      executionTimeMs: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      agentId,
      output: {},
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Build user message from request parameters
 */
function buildUserMessage(request: ToolExecutionRequest): string {
  const parts: string[] = [];

  // Add tenant context
  parts.push(`Tenant ID: ${request.tenantId}`);
  parts.push(`Workspace ID: ${request.workspaceId}`);

  // Add brand context if available
  if (request.context?.brandProfile) {
    parts.push(`Brand Context: ${JSON.stringify(request.context.brandProfile)}`);
  }

  // Add campaign context if available
  if (request.context?.campaignId) {
    parts.push(`Campaign ID: ${request.context.campaignId}`);
  }

  // Add lead context if available
  if (request.context?.leadId) {
    parts.push(`Lead ID: ${request.context.leadId}`);
  }

  // Add tool parameters
  parts.push(`Request Parameters:`);
  parts.push(JSON.stringify(request.parameters, null, 2));

  return parts.join('\n\n');
}

/**
 * Parse LLM response to structured JSON
 */
function parseStructuredOutput(response: string): Record<string, unknown> {
  // Try to extract JSON from response
  const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {
      // Fall through to direct parse
    }
  }

  // Try direct JSON parse
  try {
    return JSON.parse(response);
  } catch {
    // Return as wrapped output
    return { raw_response: response };
  }
}

/**
 * Tool execution map for direct invocation
 */
export const toolExecutors: Record<string, (params: Record<string, unknown>, context: ToolExecutionRequest['context']) => Promise<Record<string, unknown>>> = {
  call_campaign_builder: async (params, context) => ({
    tool: 'call_campaign_builder',
    params,
    context,
    status: 'ready_for_execution'
  }),
  
  call_landing_generator: async (params, context) => ({
    tool: 'call_landing_generator',
    params,
    context,
    status: 'ready_for_execution'
  }),
  
  call_humanizer: async (params, context) => ({
    tool: 'call_humanizer',
    params,
    context,
    status: 'ready_for_execution'
  }),
  
  call_email_reply_analyzer: async (params, context) => ({
    tool: 'call_email_reply_analyzer',
    params,
    context,
    status: 'ready_for_execution'
  }),
  
  call_optimizer: async (params, context) => ({
    tool: 'call_optimizer',
    params,
    context,
    status: 'ready_for_execution'
  }),
  
  call_voice_orchestrator: async (params, context) => ({
    tool: 'call_voice_orchestrator',
    params,
    context,
    status: 'ready_for_execution'
  })
};
