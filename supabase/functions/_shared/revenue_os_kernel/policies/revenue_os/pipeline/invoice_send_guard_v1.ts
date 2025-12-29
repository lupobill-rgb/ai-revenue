import type { KernelDecision, KernelEvent, KernelGuardResponse } from "../../../types.ts";
import { getString } from "../../_helpers.ts";

export async function handle(event: KernelEvent): Promise<KernelDecision[]> {
  const invoice_id = getString(event.payload, "invoice_id") || event.entity_id;

  const guard: KernelGuardResponse = {
    result: "BLOCK",
    reason_code: "revenue_os.pipeline.invoice_send_guard_v1.block.not_implemented",
    reason_text: "Invoice sending is not configured in this environment",
    override_required: true,
  };

  const decision: KernelDecision = {
    tenant_id: event.tenant_id,
    event_id: "",
    correlation_id: event.correlation_id,
    policy_name: "revenue_os.pipeline.invoice_send_guard_v1",
    decision_type: "GUARD",
    decision_json: { guard, invoice_id },
    status: "approved",
  };

  return [decision];
}


