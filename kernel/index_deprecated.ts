/**
 * UbiGrowth OS Kernel (DEPRECATED)
 * Legacy agent router for executive modules.
 *
 * DO NOT USE for Revenue OS control plane behavior.
 * Use: `supabase/functions/_shared/revenue_os_kernel/*`
 */

import { supabase } from '../src/integrations/supabase/client';
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
// Avoid duplicate type exports (AgentConfig, ModuleManifest) from `./core` vs `./types`.
export { registerModule, getModule, getAllModules, getAgentForMode, getOrchestratorPrompt, getModuleDocs } from './core';
export * from './test/tenant-test';
export * from './launch/module-toggle';
export * from './health/module-health';

/**
 * Run a direct agent call with standardized envelope
 * This is the new unified interface for agent invocations
 */
export async function runAgent(request: AgentRequest): Promise<AgentResponse> {
  // @deprecated Revenue OS Kernel Runtime is the source of truth for decisions/actions.
  const startTime = Date.now();
  const { agent_name, tenant_id, campaign_id, user_id, payload } = request;

  // === GUARDRAIL 1: Validate tenant_id is present ===
  if (!tenant_id) {
    return {
      success: false,
      agent_name,
      run_id: '',
      error: 'Missing required field: tenant_id',
      duration_ms: Date.now() - startTime,
    };
  }

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
    // === GUARDRAIL 2: Validate campaign_id belongs to tenant (if provided) ===
    if (campaign_id) {
      const { data: campaign, error: campaignError } = await supabase
        .from('cmo_campaigns')
        .select('id, tenant_id')
        .eq('id', campaign_id)
        .single();

      if (campaignError || !campaign) {
        return {
          success: false,
          agent_name,
          run_id: '',
          error: `Campaign not found: ${campaign_id}`,
          duration_ms: Date.now() - startTime,
        };
      }

      if (campaign.tenant_id !== tenant_id) {
        console.error(`Security: Campaign ${campaign_id} does not belong to tenant ${tenant_id}`);
        return {
          success: false,
          agent_name,
          run_id: '',
          error: 'Campaign does not belong to this tenant',
          duration_ms: Date.now() - startTime,
        };
      }
    }

    // === GUARDRAIL 3: Log agent run start to agent_runs ===
    const { data: runData, error: runError } = await supabase
      .from('agent_runs')
      .insert({
        agent: agent_name,
        tenant_id,
        workspace_id: tenant_id,
        mode: agent_name.replace('cmo_', ''),
        status: 'running',
        // agent_runs.input is Json typed; keep runtime behavior but satisfy TS.
        input: { campaign_id, user_id, payload } as any,
      })
      .select('id')
      .single();

    if (runError) {
      console.error('Failed to create agent_run:', runError);
    }

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

    // === Update agent_run with result (success/failure + latency) ===
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
    const duration_ms = Date.now() - startTime;
    console.error(`Agent ${agent_name} error:`, err);
    return {
      success: false,
      agent_name,
      run_id: '',
      error: err instanceof Error ? err.message : 'Unknown error',
      duration_ms,
    };
  }
}

/**
 * Run a kernel request against any exec module
 * This is the primary interface for interacting with CMO/CRO/CFO/COO
 */
export async function runKernel(request: KernelRequest): Promise<KernelResponse> {
  // @deprecated Revenue OS Kernel Runtime is the source of truth for decisions/actions.
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


