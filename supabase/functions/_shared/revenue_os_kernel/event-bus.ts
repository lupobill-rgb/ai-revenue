import { makeIdempotencyKey } from "./hash.ts";
import type { KernelEvent } from "./types.ts";

export type EmitKernelEventResult = {
  event_id: string;
  inserted: boolean;
  idempotency_key: string;
};

/**
 * emitKernelEvent(event)
 * - Validates + normalizes inputs should be done by caller.
 * - Idempotent insert into kernel_events (per tenant, per idempotency_key).
 * - Returns { inserted=false } if the event already existed, and MUST NOT be processed twice.
 */
export async function emitKernelEvent(
  supabase: any,
  event: KernelEvent
): Promise<EmitKernelEventResult> {
  const occurredAt = event.occurred_at || new Date().toISOString();

  // Deterministic key: does NOT include payload; payload can evolve while preserving dedupe.
  const idempotency_key = await makeIdempotencyKey([
    event.tenant_id,
    event.type,
    event.source,
    event.entity_type,
    event.entity_id,
    event.correlation_id,
    occurredAt,
  ]);

  const insert = {
    tenant_id: event.tenant_id,
    type: event.type,
    source: event.source,
    entity_type: event.entity_type,
    entity_id: event.entity_id,
    correlation_id: event.correlation_id,
    payload_json: event.payload,
    status: 'pending',
    occurred_at: occurredAt,
    idempotency_key,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("kernel_events")
    .insert(insert as never)
    .select("id")
    .single();

  if (!insertError && inserted?.id) {
    return { event_id: inserted.id, inserted: true, idempotency_key };
  }

  // Idempotency conflict -> fetch existing id and return inserted=false
  if (insertError?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("kernel_events")
      .select("id")
      .eq("tenant_id", event.tenant_id)
      .eq("idempotency_key", idempotency_key)
      .single();

    if (existingError || !existing?.id) {
      throw new Error(`KERNEL_EVENT_IDEMPOTENCY_LOOKUP_FAILED: ${existingError?.message || "missing event"}`);
    }

    return { event_id: existing.id, inserted: false, idempotency_key };
  }

  throw new Error(`KERNEL_EVENT_INSERT_FAILED: ${insertError?.message || "unknown error"}`);
}


