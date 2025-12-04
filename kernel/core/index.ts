/**
 * Kernel Core
 * Module registration and routing infrastructure
 */

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

// Module registry
const modules: Map<string, ModuleManifest> = new Map();

/**
 * Register a module with the kernel
 */
export function registerModule(manifest: ModuleManifest): void {
  if (modules.has(manifest.id)) {
    console.warn(`[Kernel] Module ${manifest.id} already registered`);
    return;
  }
  modules.set(manifest.id, manifest);
  console.log(`[Kernel] Registered: ${manifest.name} v${manifest.version}`);
}

/**
 * Get a registered module by ID
 */
export function getModule(moduleId: string): ModuleManifest | undefined {
  return modules.get(moduleId);
}

/**
 * Get all registered modules
 */
export function getAllModules(): ModuleManifest[] {
  return Array.from(modules.values());
}

/**
 * Get agent config for a mode
 */
export function getAgentForMode(moduleId: string, mode: string): AgentConfig | undefined {
  const module = modules.get(moduleId);
  if (!module?.agents) return undefined;

  // CMO mode mappings
  const cmoModeToAgent: Record<string, string> = {
    setup: 'brandIntake',
    strategy: 'plan90Day',
    funnels: 'funnelArchitect',
    campaigns: 'campaignDesigner',
    content: 'contentEngine',
    optimization: 'optimizationAnalyst'
  };

  // CRO mode mappings
  const croModeToAgent: Record<string, string> = {
    setup: 'pipelineIntake',
    forecast: 'forecastPlanner',
    deal_review: 'dealReviewer',
    optimization: 'revenueMoves'
  };

  // CFO mode mappings
  const cfoModeToAgent: Record<string, string> = {
    setup: 'setup',
    budgeting: 'budgetPlanner',
    forecasting: 'forecaster',
    reporting: 'reporter'
  };

  // COO mode mappings
  const cooModeToAgent: Record<string, string> = {
    setup: 'setup',
    workflows: 'workflowDesigner',
    processes: 'processOptimizer',
    optimization: 'analyst'
  };

  // Select mapping based on module
  let modeToAgent: Record<string, string>;
  switch (moduleId) {
    case 'ai_cmo':
      modeToAgent = cmoModeToAgent;
      break;
    case 'ai_cro':
      modeToAgent = croModeToAgent;
      break;
    case 'ai_cfo':
      modeToAgent = cfoModeToAgent;
      break;
    case 'ai_coo':
      modeToAgent = cooModeToAgent;
      break;
    default:
      return undefined;
  }

  const agentKey = modeToAgent[mode];
  return agentKey ? module.agents[agentKey] : undefined;
}

/**
 * Get orchestrator prompt path
 */
export function getOrchestratorPrompt(moduleId: string): string | undefined {
  return modules.get(moduleId)?.orchestrator_prompt;
}

/**
 * Get module docs
 */
export function getModuleDocs(moduleId: string): string[] {
  return modules.get(moduleId)?.docs || [];
}
