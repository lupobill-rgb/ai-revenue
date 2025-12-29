import { emitKernelEvent } from "./event-bus.ts";
import { runDecisionEngine } from "./decision-engine.ts";
import { validateKernelEvent } from "./validate.ts";
import type { KernelDecision, KernelEvent, KernelGuardResponse, KernelRuntimeContext } from "./types.ts";
import { makeDefaultRuntimeContext } from "./runtime.ts";

async function insertDecisionRow(supabase: any, decision: KernelDecision): Promise<string> {
  const { data, error } = await supabase
    .from("kernel_decisions")
    .insert({
      tenant_id: decision.tenant_id,
      event_id: decision.event_id,
      correlation_id: decision.correlation_id,
      policy_name: decision.policy_name,
      decision_type: decision.decision_type,
      decision_json: decision.decision_json,
      status: decision.status,
    } as never)
    .select("id")
    .single();

  if (error || !data?.id) throw new Error(`KERNEL_DECISION_INSERT_FAILED: ${error?.message || "missing id"}`);
  return data.id;
}

function pickStrictestGuard(responses: KernelGuardResponse[]): KernelGuardResponse {
  // Order: BLOCK > ALLOW_WITH_OVERRIDE > ALLOW
  const rank = (r: KernelGuardResponse) => (r.result === "BLOCK" ? 2 : r.result === "ALLOW_WITH_OVERRIDE" ? 1 : 0);
  return responses.sort((a, b) => rank(b) - rank(a))[0];
}

export type RunGuardResult = {
  event_id: string;
  correlation_id: string;
  decision_ids: string[];
  guard: KernelGuardResponse;
};

/**
 * Run a guard check for a single event.
 * - Emits KernelEvent (idempotent)
 * - Routes to policies -> stores GUARD decisions
 * - Returns the strictest GUARD response (or ALLOW if none)
 */
export async function runKernelGuard(
  supabase: any,
  input: unknown,
  ctx?: KernelRuntimeContext
): Promise<RunGuardResult> {
  const event: KernelEvent = validateKernelEvent(input);
  const runtimeCtx = ctx || makeDefaultRuntimeContext("shadow", event.correlation_id);

  const emitted = await emitKernelEvent(supabase, event);

  const decisions = await runDecisionEngine(event, runtimeCtx);
  const guards = decisions.filter((d) => d.decision_type === "GUARD");

  if (guards.length === 0) {
    return {
      event_id: emitted.event_id,
      correlation_id: event.correlation_id,
      decision_ids: [],
      guard: {
        result: "ALLOW",
        reason_code: "revenue_os.guard.no_policy",
        reason_text: "No guard policy matched",
        override_required: false,
      },
    };
  }

  const decisionIds: string[] = [];
  const responses: KernelGuardResponse[] = [];

  for (const d of guards) {
    d.event_id = emitted.event_id;
    d.tenant_id = event.tenant_id;
    d.correlation_id = event.correlation_id;
    d.status = d.status || "approved";

    const id = await insertDecisionRow(supabase, d);
    decisionIds.push(id);

    const guard = (d.decision_json as any)?.guard as KernelGuardResponse | undefined;
    if (guard) responses.push(guard);
  }

  const strictest = responses.length ? pickStrictestGuard(responses) : {
    result: "ALLOW",
    reason_code: "revenue_os.guard.no_guard_decision",
    reason_text: "No guard decision produced",
    override_required: false,
  };

  return { event_id: emitted.event_id, correlation_id: event.correlation_id, decision_ids: decisionIds, guard: strictest };
}


