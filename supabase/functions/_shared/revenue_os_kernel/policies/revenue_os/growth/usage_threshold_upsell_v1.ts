import type { KernelDecision, KernelEvent, RevenueAction } from "../../../types.ts";
import { getNumber, getString } from "../../_helpers.ts";

export async function handle(event: KernelEvent): Promise<KernelDecision[]> {
  const account_id = getString(event.payload, "account_id") || event.entity_id;
  const metric = getString(event.payload, "metric");
  const threshold = getNumber(event.payload, "threshold");
  const value = getNumber(event.payload, "value");

  const actions: RevenueAction[] = [
    {
      type: "UPSSELL_TRIGGER",
      target: { kind: "account", account_id },
      severity: "info",
      auto_execute: false,
      override_required: false,
      reason_code: "revenue_os.growth.usage_threshold_upsell_v1.upsell_trigger",
      reason_text: "Usage threshold crossed (shadow signal)",
      metadata: { metric, threshold, value },
    },
  ];

  return [
    {
      tenant_id: event.tenant_id,
      event_id: "",
      correlation_id: event.correlation_id,
      policy_name: "revenue_os.growth.usage_threshold_upsell_v1",
      decision_type: "EMIT_ACTIONS",
      decision_json: { actions },
      status: "approved",
    },
  ];
}


