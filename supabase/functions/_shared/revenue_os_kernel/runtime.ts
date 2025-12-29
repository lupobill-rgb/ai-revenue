import { emitKernelEvent } from "./event-bus.ts";
import { runDecisionEngine } from "./decision-engine.ts";
import { executeDecision } from "./dispatcher.ts";
import { validateKernelEvent } from "./validate.ts";
import type { KernelDecision, KernelEvent, KernelRuntimeContext } from "./types.ts";

export function makeDefaultRuntimeContext(mode: "shadow" | "enforce", correlation_id: string): KernelRuntimeContext {
  return {
    mode,
    now: () => new Date(),
    log: (level, msg, extra) => {
      const base = { correlation_id, ...extra };
      if (level === "error") console.error(msg, base);
      else if (level === "warn") console.warn(msg, base);
      else console.log(msg, base);
    },
  };
}

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

  if (error || !data?.id) {
    throw new Error(`KERNEL_DECISION_INSERT_FAILED: ${error?.message || "missing id"}`);
  }
  return data.id;
}

async function updateDecisionStatus(supabase: any, id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from("kernel_decisions")
    .update({ status } as never)
    .eq("id", id);
  if (error) throw new Error(`KERNEL_DECISION_UPDATE_FAILED: ${error.message}`);
}

export type IngestResult = {
  event_id: string;
  correlation_id: string;
  mode: "shadow" | "enforce";
  decisions_created: number;
  actions_logged: boolean;
  skipped_idempotent: boolean;
};

/**
 * Ingest a KernelEvent end-to-end:
 * event -> persist (idempotent) -> decision engine -> persist decisions -> dispatch -> persist actions
 */
export async function ingestKernelEvent(supabase: any, input: unknown, opts?: { mode?: "shadow" | "enforce" }): Promise<IngestResult> {
  const event: KernelEvent = validateKernelEvent(input);
  const envMode =
    (globalThis as any)?.Deno?.env?.get?.("REVENUE_OS_KERNEL_MODE") === "enforce" ? "enforce" : "shadow";
  const mode = opts?.mode || envMode;
  const ctx = makeDefaultRuntimeContext(mode, event.correlation_id);

  ctx.log("info", "kernel: ingest start", { type: event.type, source: event.source });

  const emitted = await emitKernelEvent(supabase, event);
  if (!emitted.inserted) {
    ctx.log("info", "kernel: idempotent skip (event already exists)", { event_id: emitted.event_id });
    return {
      event_id: emitted.event_id,
      correlation_id: event.correlation_id,
      mode,
      decisions_created: 0,
      actions_logged: false,
      skipped_idempotent: true,
    };
  }

  const decisions = await runDecisionEngine(event, ctx);
  if (decisions.length === 0) {
    return {
      event_id: emitted.event_id,
      correlation_id: event.correlation_id,
      mode,
      decisions_created: 0,
      actions_logged: false,
      skipped_idempotent: false,
    };
  }

  // Persist decisions, then dispatch.
  let decisionsCreated = 0;
  for (const d of decisions) {
    d.event_id = emitted.event_id;
    d.tenant_id = event.tenant_id;
    d.correlation_id = event.correlation_id;
    d.status = d.status || "approved";

    const decisionId = await insertDecisionRow(supabase, d);
    d.id = decisionId;
    decisionsCreated++;

    try {
      await executeDecision(supabase, d, ctx);
      if (ctx.mode === "enforce") {
        await updateDecisionStatus(supabase, decisionId, "executed");
      }
    } catch (e) {
      await updateDecisionStatus(supabase, decisionId, "failed");
      throw e;
    }
  }

  return {
    event_id: emitted.event_id,
    correlation_id: event.correlation_id,
    mode,
    decisions_created: decisionsCreated,
    actions_logged: true,
    skipped_idempotent: false,
  };
}


