/**
 * Kernel Module Registry
 * Loads and registers all available modules with the OS kernel
 */

import cmoManifest from '../../registry/modules/cmo.manifest.json';

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
    console.warn(`[Kernel] Module ${manifest.id} already registered, skipping`);
    return;
  }

  // Validate required dependencies
  const missingDeps = manifest.requires.filter(
    dep => !['supabase', 'kernel', 'ai_gateway'].includes(dep)
  );
  if (missingDeps.length > 0) {
    console.warn(`[Kernel] Module ${manifest.id} has unknown dependencies:`, missingDeps);
  }

  modules.set(manifest.id, manifest);
  console.log(`[Kernel] Registered module: ${manifest.name} v${manifest.version}`);
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
 * Check if a module is registered
 */
export function isModuleRegistered(moduleId: string): boolean {
  return modules.has(moduleId);
}

/**
 * Get module modes for routing
 */
export function getModuleModes(moduleId: string): string[] {
  const module = modules.get(moduleId);
  return module?.modes || [];
}

/**
 * Get agent config for a mode
 */
export function getAgentForMode(moduleId: string, mode: string): AgentConfig | undefined {
  const module = modules.get(moduleId);
  if (!module?.agents) return undefined;

  // Map mode to agent key
  const modeToAgent: Record<string, string> = {
    setup: 'brandIntake',
    strategy: 'plan90Day',
    funnels: 'funnelArchitect',
    campaigns: 'campaignDesigner',
    content: 'contentEngine',
    optimization: 'optimizationAnalyst'
  };

  const agentKey = modeToAgent[mode];
  return agentKey ? module.agents[agentKey] : undefined;
}

/**
 * Get orchestrator prompt path for a module
 */
export function getOrchestratorPrompt(moduleId: string): string | undefined {
  const module = modules.get(moduleId);
  return module?.orchestrator_prompt;
}

/**
 * Get documentation paths for a module
 */
export function getModuleDocs(moduleId: string): string[] {
  const module = modules.get(moduleId);
  return module?.docs || [];
}

/**
 * Get UI base path for a module
 */
export function getModuleBasePath(moduleId: string): string | undefined {
  const module = modules.get(moduleId);
  return module?.ui?.basePath;
}

// Register CMO module on load
registerModule(cmoManifest as ModuleManifest);

export { cmoManifest };
