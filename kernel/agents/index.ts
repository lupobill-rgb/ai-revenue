/**
 * Kernel Agents Registry
 * Registers all AI agent configurations for the OS modules
 */

import prospectIntel from './prospect_intel.json';
import outboundCopy from './outbound_copy.json';
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

// Agent registry
const agents: Record<string, AgentConfig> = {
  // Outbound OS agents
  prospect_intel: prospectIntel as AgentConfig,
  outbound_copy: outboundCopy as AgentConfig,
  // CMO agents
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
    cmo: ['cmo_optimizer', 'cmo_voice_agent_builder', 'cmo_campaign_builder'],
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

export { 
  prospectIntel, 
  outboundCopy,
  cmoOptimizer,
  cmoVoiceAgentBuilder,
  cmoCampaignBuilder,
};
