import type { KernelDecision, KernelEvent, KernelGuardResponse } from "../../../types.ts";
import { getNumber, getString } from "../../_helpers.ts";

export async function handle(event: KernelEvent): Promise<KernelDecision[]> {
  const deal_id = getString(event.payload, "deal_id") || event.entity_id;
  const new_stage = getString(event.payload, "new_stage");
  const deal_value = getNumber(event.payload, "deal_value") ?? 0;

  let guard: KernelGuardResponse = {
    result: "ALLOW",
    reason_code: "revenue_os.pipeline.deal_close_guard_v1.allow",
    reason_text: "Allowed",
    override_required: false,
  };

  if (new_stage === "closed_won" && (!Number.isFinite(deal_value) || deal_value <= 0)) {
    guard = {
      result: "ALLOW_WITH_OVERRIDE",
      reason_code: "revenue_os.pipeline.deal_close_guard_v1.override_required.non_positive_value",
      reason_text: "Closing a deal as won with non-positive value requires override",
      override_required: true,
    };
  }

  const decision: KernelDecision = {
    tenant_id: event.tenant_id,
    event_id: "",
    correlation_id: event.correlation_id,
    policy_name: "revenue_os.pipeline.deal_close_guard_v1",
    decision_type: "GUARD",
    decision_json: { guard, deal_id },
    status: "approved",
  };

  return [decision];
}


