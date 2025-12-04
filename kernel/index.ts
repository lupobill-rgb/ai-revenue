/**
 * UbiGrowth OS Kernel
 * Unified interface for all executive modules
 */

import { supabase } from '@/integrations/supabase/client';
import { getModule, getAgentForMode, getAllModules } from './core';
import { isModuleEnabledForTenant } from './launch/module-toggle';
import type { 
  ExecModule, 
  KernelRequest, 
  KernelResponse,
} from './types';

export * from './types';
export * from './core';
export * from './test/tenant-test';
export * from './launch/module-toggle';
export * from './health/module-health';

/**
 * Run a kernel request against any exec module
 * This is the primary interface for interacting with CMO/CRO/CFO/COO
 */
export async function runKernel(request: KernelRequest): Promise<KernelResponse> {
  const startTime = Date.now();
  const { module, mode, tenant_id, workspace_id, payload, context } = request;

  // Check if module is enabled for tenant FIRST
  const moduleEnabled = await isModuleEnabledForTenant(module, tenant_id);
  if (!moduleEnabled) {
    return {
      success: false,
      module,
      mode,
      agent: 'unknown',
      run_id: '',
      error: `Module ${module} is disabled for this tenant`,
    };
  }

  // Validate module exists
  const manifest = getModule(module);
  if (!manifest) {
    return {
      success: false,
      module,
      mode,
      agent: 'unknown',
      run_id: '',
      error: `Module ${module} not registered`,
    };
  }

  // Check module status (planned modules cannot be run)
  const moduleStatus = (manifest as any)._status;
  if (moduleStatus === 'planned') {
    return {
      success: false,
      module,
      mode,
      agent: 'unknown',
      run_id: '',
      error: `Module ${module} is planned but not yet active`,
    };
  }

  // Get agent config for mode
  const agentConfig = getAgentForMode(module, mode);
  if (!agentConfig) {
    return {
      success: false,
      module,
      mode,
      agent: 'unknown',
      run_id: '',
      error: `No agent configured for mode ${mode} in module ${module}`,
    };
  }

  try {
    // Call the edge function via kernel router
    const { data, error } = await supabase.functions.invoke(`${module.replace('ai_', '')}-kernel`, {
      body: {
        mode,
        tenant_id,
        workspace_id,
        payload,
        context,
      },
    });

    if (error) {
      return {
        success: false,
        module,
        mode,
        agent: agentConfig.function,
        run_id: '',
        error: error.message,
        duration_ms: Date.now() - startTime,
      };
    }

    return {
      success: true,
      module,
      mode,
      agent: agentConfig.function,
      run_id: data?.run_id || '',
      data: data?.result,
      entities: data?.entities,
      duration_ms: Date.now() - startTime,
    };
  } catch (err) {
    return {
      success: false,
      module,
      mode,
      agent: agentConfig.function,
      run_id: '',
      error: err instanceof Error ? err.message : 'Unknown error',
      duration_ms: Date.now() - startTime,
    };
  }
}

/**
 * Get all registered exec modules
 */
export function getExecModules(): ExecModule[] {
  return ['ai_cmo', 'ai_cro', 'ai_cfo', 'ai_coo'];
}

/**
 * Get only active (non-planned) modules
 */
export function getActiveModules(): ExecModule[] {
  return getExecModules().filter(moduleId => {
    const manifest = getModule(moduleId);
    return manifest && (manifest as any)._status !== 'planned';
  });
}

/**
 * Check if a module is registered and available
 */
export function isModuleAvailable(moduleId: ExecModule): boolean {
  const manifest = getModule(moduleId);
  return manifest !== undefined && (manifest as any)._status !== 'planned';
}

/**
 * Check if a module is registered (regardless of status)
 */
export function isModuleRegistered(moduleId: ExecModule): boolean {
  return getModule(moduleId) !== undefined;
}

/**
 * Get module manifest by ID
 */
export function getModuleManifest(moduleId: ExecModule) {
  return getModule(moduleId);
}

/**
 * Get all module manifests
 */
export function getAllModuleManifests() {
  return getAllModules();
}
