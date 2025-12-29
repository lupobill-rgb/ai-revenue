import type { KernelDecision, KernelEvent, RevenueAction } from "../../../types.ts";
import { getString } from "../../_helpers.ts";

export async function handle(event: KernelEvent): Promise<KernelDecision[]> {
  // Minimal, deterministic v1 policy: respond fast on new leads with email + follow-up task.
  const lead_id = event.entity_id;
  const campaign_id = getString(event.payload, "campaign_id");

  const actions: RevenueAction[] = [
    {
      type: "OUTBOUND_EMAIL",
      target: { kind: "lead", lead_id },
      severity: "info",
      auto_execute: true,
      override_required: false,
      reason_code: "revenue_os.growth.lead_response_v1.send_email",
      reason_text: "Send immediate lead confirmation / first-touch email",
      metadata: {
        subject: "Thanks for reaching out — quick next step",
        html_body:
          "<p>Hi {{first_name}},</p><p>Thanks for reaching out. What’s the best time for a quick 10-minute call to learn what you’re trying to achieve?</p><p>— {{company}}</p>",
        campaign_id: campaign_id || null,
        schedule: { when: "now" },
      },
    },
    {
      type: "TASK_CREATE",
      target: { kind: "lead", lead_id },
      severity: "info",
      auto_execute: true,
      override_required: false,
      reason_code: "revenue_os.growth.lead_response_v1.create_task",
      reason_text: "Create follow-up task to ensure no lead stalls",
      metadata: {
        title: "Follow up with new lead",
        description: "New lead captured — confirm fit and propose next step.",
        due_in_hours: 1,
      },
    },
  ];

  const decision: KernelDecision = {
    tenant_id: event.tenant_id,
    event_id: "", // filled by runtime
    correlation_id: event.correlation_id,
    policy_name: "revenue_os.growth.lead_response_v1",
    decision_type: "EMIT_ACTIONS",
    decision_json: { actions },
    status: "approved",
  };

  return [decision];
}


