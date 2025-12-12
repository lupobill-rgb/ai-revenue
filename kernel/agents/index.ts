/**
 * Kernel Agents Registry
 * Registers all AI agent configurations for the OS modules
 * 
 * ARCHITECTURE: One brain, many hands
 * - cmo_orchestrator is the master coordination layer
 * - All other CMO agents are specialized and invoked by orchestrator
 */

import prospectIntel from './prospect_intel.json';
import outboundCopy from './outbound_copy.json';
import cmoOrchestrator from './cmo_orchestrator.json';
import cmoOptimizer from './cmo_optimizer.json';
import cmoVoiceAgentBuilder from './cmo_voice_agent_builder.json';
import cmoCampaignBuilder from './cmo_campaign_builder.json';

export interface AgentConfig {
  id?: string;
  agent_name?: string;
  label?: string;
  description: string;
  model: string;
  temperature: number;
  max_tokens?: number;
  system_prompt: string[] | string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  db_tables?: string[];
  edge_function?: string;
}

// Agent registry - orchestrator is the entry point
const agents: Record<string, AgentConfig> = {
  // CMO Orchestrator - master coordination layer (SINGLE SOURCE OF TRUTH)
  cmo_orchestrator: cmoOrchestrator as AgentConfig,
  
  // Outbound OS agents
  prospect_intel: prospectIntel as AgentConfig,
  outbound_copy: outboundCopy as AgentConfig,
  
  // CMO specialized agents (invoked by orchestrator)
  cmo_optimizer: cmoOptimizer as AgentConfig,
  cmo_voice_agent_builder: cmoVoiceAgentBuilder as AgentConfig,
  cmo_campaign_builder: cmoCampaignBuilder as AgentConfig,
};

export function getAgent(agentId: string): AgentConfig | undefined {
  return agents[agentId];
}

export function getAllAgents(): AgentConfig[] {
  return Object.values(agents);
}

export function getAgentsByModule(module: 'outbound' | 'cmo'): AgentConfig[] {
  const prefixes = {
    outbound: ['prospect_intel', 'outbound_copy'],
    cmo: ['cmo_orchestrator', 'cmo_optimizer', 'cmo_voice_agent_builder', 'cmo_campaign_builder'],
  };
  return prefixes[module].map(id => agents[id]).filter(Boolean);
}

export function getAgentSystemPrompt(agentId: string): string {
  const agent = agents[agentId];
  if (!agent) return '';
  if (Array.isArray(agent.system_prompt)) {
    return agent.system_prompt.join('\n');
  }
  return agent.system_prompt;
}

/**
 * Get the CMO orchestrator config
 * This is the single source of truth for all CMO operations
 */
export function getCMOOrchestrator(): AgentConfig {
  return cmoOrchestrator as AgentConfig;
}

export { 
  prospectIntel, 
  outboundCopy,
  cmoOrchestrator,
  cmoOptimizer,
  cmoVoiceAgentBuilder,
  cmoCampaignBuilder,
};
