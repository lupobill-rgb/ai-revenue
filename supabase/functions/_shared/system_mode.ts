export const SYSTEM_MODE = "LOCKED_V1" as const;

const REQUIRED_SYSTEM_MODE = "LOCKED_V1" as const;

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

type SystemModeLogContext = {
  tenant_id?: string | null;
  workspace_id?: string | null;
  component: string;
  action: string;
  extra?: Record<string, unknown>;
};

/**
 * Hard gate for any execution path.
 *
 * If someone changes SYSTEM_MODE away from LOCKED_V1 without explicitly removing
 * this guard, execution will refuse to run (fail-closed) and log the attempt.
 */
export async function assertLockedV1OrRefuseExecution(
  supabase: any,
  ctx: SystemModeLogContext
): Promise<void> {
  if (SYSTEM_MODE === REQUIRED_SYSTEM_MODE) return;

  // Best-effort log (must not throw over logging).
  try {
    await supabase.from("campaign_audit_log").insert({
      tenant_id: ctx.tenant_id || ZERO_UUID,
      workspace_id: ctx.workspace_id || ZERO_UUID,
      event_type: "system_mode_bypass_attempt",
      actor_type: "system",
      details: {
        required: REQUIRED_SYSTEM_MODE,
        actual: SYSTEM_MODE,
        component: ctx.component,
        action: ctx.action,
        timestamp: new Date().toISOString(),
        ...(ctx.extra ? { extra: ctx.extra } : {}),
      },
    } as never);
  } catch {
    // ignore
  }

  throw new Error(`EXECUTION_REFUSED_SYSTEM_MODE: required=${REQUIRED_SYSTEM_MODE} actual=${SYSTEM_MODE}`);
}

