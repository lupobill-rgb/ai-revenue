/**
 * UbiGrowth OS Kernel (BLOCKED)
 *
 * This file exists to prevent regressions back to the legacy “agent router kernel”.
 * The legacy implementation was moved to `kernel/index_deprecated.ts`.
 *
 * Revenue OS control plane is ONLY:
 * - modules emit events
 * - kernel decides (policies)
 * - dispatcher acts
 */

import type { AgentRequest, AgentResponse, KernelRequest, KernelResponse, ExecModule } from "./types";
import { getAllModules, getModule } from "./core";

export * from "./types";
export { registerModule, getModule, getAllModules, getAgentForMode, getOrchestratorPrompt, getModuleDocs } from "./core";
export * from "./test/tenant-test";
export * from "./launch/module-toggle";
export * from "./health/module-health";

function isProdBuild(): boolean {
  // Vite replaces import.meta.env.PROD at build-time.
  try {
    return Boolean((import.meta as any)?.env?.PROD);
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

function blocked(name: string): never {
  throw new Error(
    `DEPRECATED_KERNEL_BLOCKED: ${name} is disabled. Use Revenue OS Kernel (events -> decisions -> actions) instead.`
  );
}

/**
 * @deprecated Blocked. Kept only to prevent reintroducing side effects via UI/agent router.
 */
export async function runAgent(request: AgentRequest): Promise<AgentResponse> {
  if (isProdBuild()) blocked("runAgent");
  return {
    success: false,
    agent_name: request.agent_name,
    run_id: "",
    error: "DEPRECATED_KERNEL_NOOP",
    duration_ms: 0,
  };
}

/**
 * @deprecated Blocked. Kept only to prevent reintroducing side effects via UI/agent router.
 */
export async function runKernel(request: KernelRequest): Promise<KernelResponse> {
  if (isProdBuild()) blocked("runKernel");
  return {
    success: false,
    module: request.module,
    mode: request.mode,
    agent: "deprecated",
    run_id: "",
    error: "DEPRECATED_KERNEL_NOOP",
    duration_ms: 0,
  };
}

export function getExecModules(): ExecModule[] {
  return ["ai_cmo", "ai_cro", "ai_cfo", "ai_coo"];
}

export function getActiveModules(): ExecModule[] {
  return getExecModules().filter((moduleId) => {
    const manifest = getModule(moduleId);
    return manifest && (manifest as any)._status !== "planned";
  });
}

export function isModuleAvailable(moduleId: ExecModule): boolean {
  const manifest = getModule(moduleId);
  return manifest !== undefined && (manifest as any)._status !== "planned";
}

export function isModuleRegistered(moduleId: ExecModule): boolean {
  return getModule(moduleId) !== undefined;
}

export function getModuleManifest(moduleId: ExecModule) {
  return getModule(moduleId);
}

export function getAllModuleManifests() {
  return getAllModules();
}
