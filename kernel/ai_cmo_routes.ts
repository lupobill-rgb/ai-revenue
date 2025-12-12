/**
 * AI CMO Internal Routing Table
 * Maps orchestrator actions to specialized agents
 * All specialist invocations MUST go through these routes
 */

export const aiCmoAgents = {
  campaignBuilder: "ai_cmo_campaign_builder",
  landingGenerator: "ai_cmo_landing_page_generator",
  humanizer: "ai_cmo_content_humanizer",
  emailReplyAnalyzer: "ai_cmo_email_reply_analyzer",
  optimizer: "ai_cmo_campaign_optimizer",
  voiceOrchestrator: "ai_cmo_voice_orchestrator"
} as const;

export type AiCmoAgentKey = keyof typeof aiCmoAgents;
export type AiCmoAgentId = typeof aiCmoAgents[AiCmoAgentKey];

/**
 * Agent prompt file paths (relative to module_prompts/ai_cmo/)
 */
export const aiCmoPromptFiles: Record<AiCmoAgentId, string> = {
  ai_cmo_campaign_builder: "ai_cmo_campaign_builder.md",
  ai_cmo_landing_page_generator: "ai_cmo_landing_page_generator.md",
  ai_cmo_content_humanizer: "ai_cmo_content_humanizer.md",
  ai_cmo_email_reply_analyzer: "ai_cmo_email_reply_analyzer.md",
  ai_cmo_campaign_optimizer: "ai_cmo_campaign_optimizer.md",
  ai_cmo_voice_orchestrator: "ai_cmo_voice_orchestrator.md"
};

/**
 * Tool definitions exposed to the orchestrator
 * These are the ONLY ways to invoke specialist agents
 */
export interface OrchestratorTool {
  name: string;
  description: string;
  agentId: AiCmoAgentId;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export const orchestratorTools: OrchestratorTool[] = [
  {
    name: "call_campaign_builder",
    description: "Build a complete multi-channel campaign including content, landing pages, automations, and voice scripts",
    agentId: aiCmoAgents.campaignBuilder,
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
  },
  {
    name: "call_landing_generator",
    description: "Generate a conversion-optimized landing page connected to CRM",
    agentId: aiCmoAgents.landingGenerator,
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
  },
  {
    name: "call_humanizer",
    description: "Refine AI-generated content to remove robotic tone and improve realism",
    agentId: aiCmoAgents.humanizer,
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
  },
  {
    name: "call_email_reply_analyzer",
    description: "Analyze an inbound email reply, classify intent, and recommend next actions",
    agentId: aiCmoAgents.emailReplyAnalyzer,
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
  },
  {
    name: "call_optimizer",
    description: "Analyze campaign performance and recommend optimizations",
    agentId: aiCmoAgents.optimizer,
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
  },
  {
    name: "call_voice_orchestrator",
    description: "Deploy and manage AI voice agents within sequences",
    agentId: aiCmoAgents.voiceOrchestrator,
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
];

/**
 * Get tool definition by name
 */
export function getToolByName(name: string): OrchestratorTool | undefined {
  return orchestratorTools.find(t => t.name === name);
}

/**
 * Get agent ID from tool name
 */
export function getAgentIdFromTool(toolName: string): AiCmoAgentId | undefined {
  const tool = getToolByName(toolName);
  return tool?.agentId;
}

/**
 * Format tools for LLM tool calling
 */
export function getToolsForLLM(): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: OrchestratorTool["parameters"];
  };
}> {
  return orchestratorTools.map(tool => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}
