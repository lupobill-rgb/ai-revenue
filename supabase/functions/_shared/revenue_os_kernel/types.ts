export type KernelEvent = {
  tenant_id: string;
  type: string;
  source: string;
  entity_type: string;
  entity_id: string;
  correlation_id: string;
  payload: Record<string, unknown>;
  occurred_at?: string;
};

/**
 * Revenue OS Kernel Contract Version
 *
 * Treat KernelEvent / KernelDecision / RevenueAction as versioned APIs.
 * Any breaking change MUST bump this version and update:
 * - docs/REVENUE_OS_KERNEL_CONTRACTS.md
 * - related tests + migrations (if DB shape changes)
 */
export const REVENUE_OS_KERNEL_CONTRACT_VERSION = "v1" as const;

export type RevenueActionType =
  | "FOLLOW_UP"
  | "TASK_CREATE"
  | "OUTBOUND_EMAIL"
  | "OUTBOUND_SMS"
  | "OUTBOUND_VOICE"
  | "BLOCK_DISCOUNT"
  | "REQUIRE_OVERRIDE"
  | "UPSSELL_TRIGGER"
  | "RENEWAL_NUDGE"
  | "NOOP";

export type RevenueSeverity = "info" | "warn" | "block";

export type RevenueActionTarget =
  | { kind: "deal"; deal_id: string }
  | { kind: "invoice"; invoice_id: string }
  | { kind: "account"; account_id: string }
  | { kind: "contact"; contact_id: string }
  | { kind: "lead"; lead_id: string }
  | { kind: "booking"; booking_id: string };

export type RevenueAction = {
  type: RevenueActionType;
  target: RevenueActionTarget;
  severity: RevenueSeverity;
  auto_execute: boolean;
  override_required: boolean;
  reason_code: string;
  reason_text: string;
  metadata?: Record<string, unknown>;
};

export type KernelDecisionStatus = "proposed" | "approved" | "executed" | "failed";

export type KernelDecision = {
  id?: string;
  tenant_id: string;
  event_id: string;
  correlation_id: string;
  policy_name: string;
  decision_type: "EMIT_ACTIONS" | "GUARD" | "NOOP";
  decision_json: Record<string, unknown>;
  status: KernelDecisionStatus;
  created_at?: string;
};

export type KernelActionStatus = "logged" | "executed" | "failed" | "skipped";

export type KernelActionRow = {
  id?: string;
  tenant_id: string;
  decision_id: string;
  correlation_id: string;
  action_type: string;
  action_json: Record<string, unknown>;
  status: KernelActionStatus;
  executed_at?: string | null;
  error?: string | null;
  created_at?: string;
};

export type KernelGuardResult = "ALLOW" | "ALLOW_WITH_OVERRIDE" | "BLOCK";

export type KernelGuardResponse = {
  result: KernelGuardResult;
  reason_code: string;
  reason_text: string;
  override_required: boolean;
};

export type KernelRuntimeMode = "shadow" | "enforce";

export type KernelRuntimeContext = {
  mode: KernelRuntimeMode;
  now: () => Date;
  log: (level: "info" | "warn" | "error", msg: string, extra?: Record<string, unknown>) => void;
};


