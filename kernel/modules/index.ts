import { cmoManifest } from '../../registry/modules/cmo.manifest.json';

/**
 * Module Registration
 * Registers all available modules with the kernel core
 */

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  entry_agent: string;
  modes: string[];
  requires: string[];
  schemas: string[];
  ui: {
    basePath: string;
    primaryScreens: string[];
  };
  permissions: {
    tenant: boolean;
    role: string[];
  };
  agents?: Record<string, {
    prompt: string;
    function: string;
  }>;
}

// Module registry
const modules: Map<string, ModuleManifest> = new Map();

/**
 * Register a module with the kernel
 */
export function registerModule(manifest: ModuleManifest): void {
  if (modules.has(manifest.id)) {
    console.warn(`Module ${manifest.id} already registered, skipping`);
    return;
  }
  
  // Validate required dependencies
  manifest.requires.forEach(dep => {
    if (dep !== 'supabase' && dep !== 'kernel' && dep !== 'ai_gateway') {
      console.warn(`Module ${manifest.id} requires unknown dependency: ${dep}`);
    }
  });

  modules.set(manifest.id, manifest);
  console.log(`Registered module: ${manifest.name} v${manifest.version}`);
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
export function getAgentForMode(moduleId: string, mode: string): { prompt: string; function: string } | undefined {
  const module = modules.get(moduleId);
  if (!module?.agents) return undefined;
  
  // Map mode to agent key
  const modeToAgent: Record<string, string> = {
    'setup': 'brandIntake',
    'strategy': 'plan90Day',
    'funnels': 'funnelArchitect',
    'campaigns': 'campaignDesigner',
    'content': 'contentEngine',
    'optimization': 'optimizationAnalyst'
  };
  
  const agentKey = modeToAgent[mode];
  return agentKey ? module.agents[agentKey] : undefined;
}

// Register CMO module on load
registerModule(cmoManifest as ModuleManifest);

export { cmoManifest };
