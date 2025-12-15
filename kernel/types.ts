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
 * CMO Agent Names
 */
export const CMO_AGENTS = {
  CAMPAIGN_BUILDER: 'cmo_campaign_builder',
  VOICE_AGENT_BUILDER: 'cmo_voice_agent_builder',
  OPTIMIZER: 'cmo_optimizer',
} as const;

export type CMOAgentName = typeof CMO_AGENTS[keyof typeof CMO_AGENTS];
