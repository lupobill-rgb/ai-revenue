/**
 * Kernel Types
 * Shared type definitions for the OS kernel
 */

export type ExecModule = 'ai_cmo' | 'ai_cro' | 'ai_cfo' | 'ai_coo';

export type CMOMode = 'setup' | 'strategy' | 'funnels' | 'campaigns' | 'content' | 'optimization';
export type CROMode = 'setup' | 'forecast' | 'deal_review' | 'optimization';
export type CFOMode = 'setup' | 'budgeting' | 'forecasting' | 'reporting';
export type COOMode = 'setup' | 'workflows' | 'processes' | 'optimization';

export type ModuleMode = CMOMode | CROMode | CFOMode | COOMode;

/**
 * Standardized Agent Request Envelope
 * All kernel agent calls follow this contract
 */
export interface AgentRequest {
  agent_name: string;
  tenant_id: string;
  campaign_id?: string | null;
  user_id: string;
  payload: Record<string, unknown>;
}

/**
 * Standardized Agent Response
 */
export interface AgentResponse {
  success: boolean;
  agent_name: string;
  run_id: string;
  data?: Record<string, unknown>;
  error?: string;
  duration_ms?: number;
}

export interface KernelRequest {
  module: ExecModule;
  mode: ModuleMode;
  tenant_id: string;
  workspace_id: string;
  payload: Record<string, unknown>;
  context?: {
    plan_id?: string;
    funnel_id?: string;
    campaign_id?: string;
    experiment_id?: string;
    budget_id?: string;
    workflow_id?: string;
  };
}

export interface KernelResponse {
  success: boolean;
  module: ExecModule;
  mode: ModuleMode;
  agent: string;
  run_id: string;
  data?: Record<string, unknown>;
  entities?: Record<string, string | string[]>;
  error?: string;
  duration_ms?: number;
}

export interface AgentConfig {
  prompt: string;
  function: string;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  entry_agent: string;
  orchestrator_prompt?: string;
  modes: string[];
  requires: string[];
  docs: string[];
  schemas: string[];
  ui?: {
    basePath: string;
    primaryScreens: string[];
  };
  permissions?: {
    tenant: boolean;
    role: string[];
  };
  agents?: Record<string, AgentConfig>;
}

export interface ModuleRegistry {
  modules: Map<string, ModuleManifest>;
  register(manifest: ModuleManifest): void;
  get(moduleId: string): ModuleManifest | undefined;
  getAll(): ModuleManifest[];
  getAgentForMode(moduleId: string, mode: string): AgentConfig | undefined;
}

/**
 * Module table prefixes
 */
export const MODULE_PREFIXES: Record<ExecModule, string> = {
  ai_cmo: 'cmo',
  ai_cro: 'cro',
  ai_cfo: 'cfo',
  ai_coo: 'coo',
};

/**
 * Module edge function prefixes
 */
export const MODULE_FUNCTION_PREFIXES: Record<ExecModule, string> = {
  ai_cmo: 'cmo-',
  ai_cro: 'cro-',
  ai_cfo: 'cfo-',
  ai_coo: 'coo-',
};

/**
 * CMO Agent Names - All routed through orchestrator
 */
export const CMO_AGENTS = {
  // Orchestrator - master coordination layer
  ORCHESTRATOR: 'cmo_orchestrator',
  // Specialized agents
  CAMPAIGN_BUILDER: 'cmo_campaign_builder',
  LANDING_PAGE_GENERATOR: 'cmo_landing_page_generator',
  CONTENT_HUMANIZER: 'cmo_content_humanizer',
  EMAIL_REPLY_ANALYZER: 'cmo_email_reply_analyzer',
  CAMPAIGN_OPTIMIZER: 'cmo_campaign_optimizer',
  VOICE_ORCHESTRATOR: 'cmo_voice_orchestrator',
  // Legacy aliases
  VOICE_AGENT_BUILDER: 'cmo_voice_agent_builder',
  OPTIMIZER: 'cmo_optimizer',
} as const;

export type CMOAgentName = typeof CMO_AGENTS[keyof typeof CMO_AGENTS];

/**
 * Orchestrator action types
 */
export type OrchestratorAction = 
  | 'create_campaign'
  | 'optimize_campaign'
  | 'handle_reply'
  | 'deploy_voice'
  | 'regenerate_content'
  | 'generate_landing_page';

/**
 * Orchestrator request envelope
 */
export interface OrchestratorRequest {
  tenant_id: string;
  workspace_id: string;
  action: OrchestratorAction;
  context?: {
    campaign_id?: string;
    lead_id?: string;
    trigger_source?: 'user' | 'cron' | 'webhook' | 'automation';
  };
  payload: Record<string, unknown>;
}

/**
 * Orchestrator response envelope
 */
export interface OrchestratorResponse {
  success: boolean;
  action_taken: string;
  agents_invoked: Array<{
    agent_name: string;
    input_summary: string;
    output_summary: string;
    duration_ms: number;
  }>;
  assets_created?: Array<{
    asset_type: string;
    asset_id: string;
    status: string;
  }>;
  crm_updates?: Array<{
    entity_type: string;
    entity_id: string;
    action: string;
  }>;
  next_actions?: Array<{
    action_type: string;
    scheduled_at?: string;
    reason: string;
  }>;
  errors?: Array<{
    agent: string;
    error_code: string;
    message: string;
  }>;
}
