import type { KernelDecision, KernelEvent, RevenueAction } from "../../../types.ts";
import { getString } from "../../_helpers.ts";

export async function handle(event: KernelEvent): Promise<KernelDecision[]> {
  const booking_id = event.entity_id;
  const invitee_email = getString(event.payload, "invitee_email");
  const scheduled_at = getString(event.payload, "scheduled_at");

  const actions: RevenueAction[] = [
    {
      type: "OUTBOUND_EMAIL",
      target: { kind: "booking", booking_id },
      severity: "info",
      auto_execute: true,
      override_required: false,
      reason_code: "revenue_os.fts.booking_confirmation_v1.confirmation",
      reason_text: "Send booking confirmation",
      metadata: {
        to_email: invitee_email,
        subject: "Booking confirmed",
        html_body:
          "<p>Thanks — your booking is confirmed.</p><p>If you need anything before the call, just reply to this email.</p>",
        schedule: { when: "now" },
      },
    },
    {
      type: "OUTBOUND_EMAIL",
      target: { kind: "booking", booking_id },
      severity: "info",
      auto_execute: true,
      override_required: false,
      reason_code: "revenue_os.fts.booking_confirmation_v1.reminder",
      reason_text: "Schedule booking reminder",
      metadata: {
        to_email: invitee_email,
        subject: "Reminder: upcoming booking",
        html_body:
          "<p>Quick reminder about your upcoming booking.</p><p>Looking forward to it.</p>",
        schedule: { when: "relative", minutes_before: 1440, anchor: scheduled_at }, // 24h before if possible
      },
    },
    {
      type: "TASK_CREATE",
      target: { kind: "booking", booking_id },
      severity: "info",
      auto_execute: true,
      override_required: false,
      reason_code: "revenue_os.fts.booking_confirmation_v1.roster_request",
      reason_text: "Create roster request task",
      metadata: {
        title: "Prepare roster / intake for booked customer",
        description: "Booking created — request roster/intake info before the session.",
        due_in_hours: 4,
      },
    },
  ];

  const decision: KernelDecision = {
    tenant_id: event.tenant_id,
    event_id: "", // filled by runtime
    correlation_id: event.correlation_id,
    policy_name: "revenue_os.fts.booking_confirmation_v1",
    decision_type: "EMIT_ACTIONS",
    decision_json: { actions },
    status: "approved",
  };

  return [decision];
}


