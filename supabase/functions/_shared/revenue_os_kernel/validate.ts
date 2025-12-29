import type { KernelEvent } from "./types.ts";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function validateKernelEvent(input: unknown): KernelEvent {
  if (!isPlainObject(input)) throw new Error("KERNEL_EVENT_INVALID: body must be an object");

  const obj = input as Record<string, unknown>;
  const required = ["tenant_id", "type", "source", "entity_type", "entity_id", "correlation_id"];
  for (const key of required) {
    const val = obj[key];
    if (typeof val !== "string" || !val.trim()) {
      throw new Error(`KERNEL_EVENT_INVALID: missing/invalid ${key}`);
    }
  }

  const payload = obj["payload"];
  if (!isPlainObject(payload)) {
    throw new Error("KERNEL_EVENT_INVALID: payload must be an object");
  }

  const occurred_at = obj["occurred_at"];
  if (occurred_at !== undefined && (typeof occurred_at !== "string" || Number.isNaN(Date.parse(occurred_at)))) {
    throw new Error("KERNEL_EVENT_INVALID: occurred_at must be an ISO timestamp");
  }

  // NOTE: payload intentionally not deep-validated here; policies should expect minimal, validated data.
  return {
    tenant_id: obj["tenant_id"] as string,
    type: obj["type"] as string,
    source: obj["source"] as string,
    entity_type: obj["entity_type"] as string,
    entity_id: obj["entity_id"] as string,
    correlation_id: obj["correlation_id"] as string,
    payload,
    occurred_at: occurred_at as string | undefined,
  };
}


