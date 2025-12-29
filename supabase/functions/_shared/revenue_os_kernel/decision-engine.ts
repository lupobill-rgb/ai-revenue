import type { KernelDecision, KernelEvent, KernelRuntimeContext } from "./types.ts";
import { revenueOsPolicies } from "./policies/revenue_os/index.ts";

export async function runDecisionEngine(
  event: KernelEvent,
  ctx: KernelRuntimeContext
): Promise<KernelDecision[]> {
  const routes: Array<{ match: boolean; run: () => Promise<KernelDecision[]> }> = [
    {
      match: event.type === "lead_captured" && event.source === "cmo_campaigns",
      run: () => revenueOsPolicies.growthLeadResponseV1(event),
    },
    {
      match: event.type === "booking_created" && event.source === "fts_marketplace",
      run: () => revenueOsPolicies.ftsBookingConfirmationV1(event),
    },
    {
      match: event.type === "usage_threshold_crossed" && event.source === "product_usage",
      run: () => revenueOsPolicies.growthUsageThresholdUpsellV1(event),
    },
    {
      match: event.type === "deal_close_attempted" && event.source === "crm",
      run: () => revenueOsPolicies.pipelineDealCloseGuardV1(event),
    },
    {
      match: event.type === "discount_attempted" && event.source === "crm",
      run: () => revenueOsPolicies.marginDiscountGuardV1(event),
    },
    {
      match: event.type === "invoice_send_attempted" && event.source === "billing",
      run: () => revenueOsPolicies.pipelineInvoiceSendGuardV1(event),
    },
  ];

  const handlers = routes.filter((r) => r.match);
  if (handlers.length === 0) {
    ctx.log("info", "kernel: no policy routes for event", {
      type: event.type,
      source: event.source,
      correlation_id: event.correlation_id,
    });
    return [];
  }

  const decisions: KernelDecision[] = [];
  for (const h of handlers) {
    const produced = await h.run();
    decisions.push(...produced);
  }
  return decisions;
}


