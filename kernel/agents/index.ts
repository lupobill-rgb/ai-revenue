/**
 * Kernel Agents Registry
 * Registers all AI agent configurations for the Outbound OS
 */

import prospectIntel from './prospect_intel.json';
import outboundCopy from './outbound_copy.json';

export interface AgentConfig {
  id: string;
  label: string;
  description: string;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string[];
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
}

// Agent registry
const agents: Record<string, AgentConfig> = {
  prospect_intel: prospectIntel as AgentConfig,
  outbound_copy: outboundCopy as AgentConfig,
};

export function getAgent(agentId: string): AgentConfig | undefined {
  return agents[agentId];
}

export function getAllAgents(): AgentConfig[] {
  return Object.values(agents);
}

export function getAgentSystemPrompt(agentId: string): string {
  const agent = agents[agentId];
  if (!agent) return '';
  return agent.system_prompt.join('\n');
}

export { prospectIntel, outboundCopy };
