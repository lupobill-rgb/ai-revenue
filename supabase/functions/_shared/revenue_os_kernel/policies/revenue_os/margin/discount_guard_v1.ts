import type { KernelDecision, KernelEvent, KernelGuardResponse } from "../../../types.ts";
import { getNumber, getString } from "../../_helpers.ts";

export async function handle(event: KernelEvent): Promise<KernelDecision[]> {
  const deal_id = getString(event.payload, "deal_id") || event.entity_id;
  const old_value = getNumber(event.payload, "old_value") ?? NaN;
  const new_value = getNumber(event.payload, "new_value") ?? NaN;

  let guard: KernelGuardResponse = {
    result: "ALLOW",
    reason_code: "revenue_os.margin.discount_guard_v1.allow",
    reason_text: "Allowed",
    override_required: false,
  };

  if (Number.isFinite(old_value) && Number.isFinite(new_value) && old_value > 0) {
    const drop = (old_value - new_value) / old_value;
    if (drop >= 0.2) {
      guard = {
        result: "ALLOW_WITH_OVERRIDE",
        reason_code: "revenue_os.margin.discount_guard_v1.override_required.discount_ge_20pct",
        reason_text: "Discount >= 20% requires override",
        override_required: true,
      };
    }
    if (drop >= 0.5) {
      guard = {
        result: "BLOCK",
        reason_code: "revenue_os.margin.discount_guard_v1.block.discount_ge_50pct",
        reason_text: "Discount >= 50% blocked",
        override_required: true,
      };
    }
  }

  const decision: KernelDecision = {
    tenant_id: event.tenant_id,
    event_id: "",
    correlation_id: event.correlation_id,
    policy_name: "revenue_os.margin.discount_guard_v1",
    decision_type: "GUARD",
    decision_json: { guard, deal_id },
    status: "approved",
  };

  return [decision];
}


