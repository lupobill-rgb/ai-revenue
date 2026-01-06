import type { KernelDecision, KernelEvent, KernelRuntimeContext } from "./types.ts";
import { revenueOsPolicies } from "./policies/revenue_os/index.ts";

export async function runDecisionEngine(
  event: KernelEvent,
  ctx: KernelRuntimeContext
): Promise<KernelDecision[]> {
  const routes: Array<{ match: boolean; run: () => Promise<KernelDecision[]> }> = [
    // Lead capture from CMO campaigns -> respond within SLA
    {
      match: event.type === "lead_captured" && event.source === "cmo_campaigns",
      run: () => revenueOsPolicies.growthLeadResponseV1(event),
    },
    // Campaign launched -> track for pipeline creation
    {
      match: event.type === "campaign_launched" && event.source === "cmo_campaigns",
      run: async () => {
        const payload = event.payload || {};
        ctx.log("info", "kernel: campaign_launched event received", {
          campaign_id: payload.campaign_id,
          leads_count: payload.leads_count,
          deals_created: payload.deals_created,
          correlation_id: event.correlation_id,
        });
        // Return empty decisions - campaign launch is logged for audit
        return [];
      },
    },
    // Lead qualified from campaign engagement -> auto-create deal
    {
      match: event.type === "lead_qualified" && (event.source === "cmo_campaigns" || event.source === "crm"),
      run: async () => {
        const payload = event.payload || {};
        const decisions: KernelDecision[] = [];
        
        // Emit task to follow up on qualified lead
        decisions.push({
          tenant_id: event.tenant_id,
          event_id: event.entity_id,
          correlation_id: event.correlation_id,
          policy_name: "growth/lead_qualified_v1",
          decision_type: "EMIT_ACTIONS",
          status: "proposed",
          decision_json: {
            actions: [
              {
                type: "TASK_CREATE",
                target: { kind: "lead", lead_id: payload.lead_id as string },
                severity: "info",
                auto_execute: true,
                override_required: false,
                reason_code: "QUALIFIED_LEAD_FOLLOWUP",
                reason_text: `Follow up with qualified lead: ${payload.lead_name || 'New Lead'}`,
                metadata: {
                  title: `Follow up with qualified lead: ${payload.lead_name || 'New Lead'}`,
                  description: `Lead qualified from campaign. Score: ${payload.lead_score || 'N/A'}. Schedule demo or discovery call.`,
                  due_in_hours: 4,
                  task_type: "sales_followup",
                },
              },
            ],
          },
        });
        
        return decisions;
      },
    },
    // Meeting booked from campaign -> update deal stage
    {
      match: event.type === "meeting_booked" && event.source === "cmo_campaigns",
      run: async () => {
        const payload = event.payload || {};
        ctx.log("info", "kernel: meeting_booked from campaign", {
          lead_id: payload.lead_id,
          deal_id: payload.deal_id,
          correlation_id: event.correlation_id,
        });
        
        // Could trigger deal stage update here
        return [];
      },
    },
    // Booking confirmation from FTS marketplace
    {
      match: event.type === "booking_created" && event.source === "fts_marketplace",
      run: () => revenueOsPolicies.ftsBookingConfirmationV1(event),
    },
    // Usage threshold crossed -> upsell opportunity
    {
      match: event.type === "usage_threshold_crossed" && event.source === "product_usage",
      run: () => revenueOsPolicies.growthUsageThresholdUpsellV1(event),
    },
    // Deal close attempt -> validate before closing
    {
      match: event.type === "deal_close_attempted" && event.source === "crm",
      run: () => revenueOsPolicies.pipelineDealCloseGuardV1(event),
    },
    // Discount attempt -> check margin guard
    {
      match: event.type === "discount_attempted" && event.source === "crm",
      run: () => revenueOsPolicies.marginDiscountGuardV1(event),
    },
    // Invoice send attempt -> validate before sending
    {
      match: event.type === "invoice_send_attempted" && event.source === "billing",
      run: () => revenueOsPolicies.pipelineInvoiceSendGuardV1(event),
    },
    // Campaign optimized -> log for audit
    {
      match: event.type === "campaign_optimized" && event.source === "cmo_campaigns",
      run: async () => {
        const payload = event.payload || {};
        ctx.log("info", "kernel: campaign_optimized", {
          campaign_id: payload.campaign_id,
          changes_count: (payload.changes as unknown[])?.length || 0,
          correlation_id: event.correlation_id,
        });
        return [];
      },
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


