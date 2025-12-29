import { describe, it, expect } from "vitest";

import { validateKernelEvent } from "../../supabase/functions/_shared/revenue_os_kernel/validate.ts";
import { makeIdempotencyKey } from "../../supabase/functions/_shared/revenue_os_kernel/hash.ts";
import { runDecisionEngine } from "../../supabase/functions/_shared/revenue_os_kernel/decision-engine.ts";

describe("Revenue OS Kernel runtime invariants", () => {
  it("validates KernelEvent shape", () => {
    expect(() => validateKernelEvent(null)).toThrow();
    expect(() =>
      validateKernelEvent({
        tenant_id: "t",
        type: "lead_captured",
        source: "cmo_campaigns",
        entity_type: "lead",
        entity_id: "l",
        correlation_id: "c",
        payload: {},
      })
    ).not.toThrow();
  });

  it("generates deterministic idempotency keys", async () => {
    const a = await makeIdempotencyKey(["t", "lead_captured", "cmo_campaigns", "lead", "l", "c", "2025-01-01T00:00:00.000Z"]);
    const b = await makeIdempotencyKey(["t", "lead_captured", "cmo_campaigns", "lead", "l", "c", "2025-01-01T00:00:00.000Z"]);
    const c = await makeIdempotencyKey(["t", "lead_captured", "cmo_campaigns", "lead", "l", "different", "2025-01-01T00:00:00.000Z"]);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("routes lead_captured to Revenue OS Growth policy", async () => {
    const decisions = await runDecisionEngine(
      {
        tenant_id: "t",
        type: "lead_captured",
        source: "cmo_campaigns",
        entity_type: "lead",
        entity_id: "lead-1",
        correlation_id: "lead-1",
        payload: { lead_id: "lead-1" },
      },
      {
        mode: "shadow",
        now: () => new Date("2025-01-01T00:00:00.000Z"),
        log: () => {},
      }
    );

    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions[0].policy_name).toBe("revenue_os.growth.lead_response_v1");
    expect(decisions[0].decision_type).toBe("EMIT_ACTIONS");
  });

  it("routes usage_threshold_crossed to Revenue OS expansion policy (shadow)", async () => {
    const decisions = await runDecisionEngine(
      {
        tenant_id: "t",
        type: "usage_threshold_crossed",
        source: "product_usage",
        entity_type: "account",
        entity_id: "acct-1",
        correlation_id: "c-1",
        payload: { account_id: "acct-1", metric: "api_calls", threshold: 1000, value: 1200 },
      },
      {
        mode: "shadow",
        now: () => new Date("2025-01-01T00:00:00.000Z"),
        log: () => {},
      }
    );

    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions[0].policy_name).toBe("revenue_os.growth.usage_threshold_upsell_v1");
    expect(decisions[0].decision_type).toBe("EMIT_ACTIONS");
  });
});


