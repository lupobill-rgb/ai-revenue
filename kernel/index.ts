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
  AgentRequest,
  AgentResponse,
} from './types';

export * from './types';
export * from './core';
export * from './test/tenant-test';
export * from './launch/module-toggle';
export * from './health/module-health';

/**
 * Run a direct agent call with standardized envelope
 * This is the new unified interface for agent invocations
 */
export async function runAgent(request: AgentRequest): Promise<AgentResponse> {
  const startTime = Date.now();
  const { agent_name, tenant_id, campaign_id, user_id, payload } = request;

  // Determine edge function from agent name
  const agentToFunction: Record<string, string> = {
    'cmo_campaign_builder': 'cmo-campaign-builder',
    'cmo_voice_agent_builder': 'cmo-voice-agent-builder',
    'cmo_optimizer': 'cmo-optimizer',
  };

  const edgeFunction = agentToFunction[agent_name];
  if (!edgeFunction) {
    return {
      success: false,
      agent_name,
      run_id: '',
      error: `Unknown agent: ${agent_name}`,
      duration_ms: Date.now() - startTime,
    };
  }

  try {
    // Log agent run start
    const { data: runData, error: runError } = await supabase
      .from('agent_runs')
      .insert({
        agent: agent_name,
        tenant_id,
        workspace_id: tenant_id, // Use tenant_id as workspace_id for consistency
        mode: agent_name.replace('cmo_', ''),
        status: 'running',
        input: { campaign_id, user_id, payload },
      })
      .select('id')
      .single();

    const run_id = runData?.id || '';

    // Call the edge function
    const { data, error } = await supabase.functions.invoke(edgeFunction, {
      body: {
        agent_name,
        tenant_id,
        campaign_id,
        user_id,
        payload,
        run_id,
      },
    });

    const duration_ms = Date.now() - startTime;

    // Update agent run with result
    if (run_id) {
      await supabase
        .from('agent_runs')
        .update({
          status: error ? 'failed' : 'completed',
          output: data,
          error_message: error?.message,
          completed_at: new Date().toISOString(),
          duration_ms,
        })
        .eq('id', run_id);
    }

    if (error) {
      return {
        success: false,
        agent_name,
        run_id,
        error: error.message,
        duration_ms,
      };
    }

    return {
      success: true,
      agent_name,
      run_id,
      data,
      duration_ms,
    };
  } catch (err) {
    return {
      success: false,
      agent_name,
      run_id: '',
      error: err instanceof Error ? err.message : 'Unknown error',
      duration_ms: Date.now() - startTime,
    };
  }
}

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
