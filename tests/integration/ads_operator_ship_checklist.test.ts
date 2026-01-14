import { describe, expect, it, vi } from "vitest";

import { governProposals } from "../../api/_lib/googleAdsOperator/governor";
import type { ProposalDraft } from "../../api/_lib/googleAdsOperator/proposalGenerators";

// ---- Test 1: Governor requires approval when thresholds exceeded ----
describe("ads operator ship checklist", () => {
  it("Governor requires approval when thresholds exceeded (budget + net daily)", async () => {
    const mockClient = {
      query: vi.fn(async () => {
        // baseline daily budget = 100 (micros)
        return [
          {
            campaign: { status: "ENABLED", campaign_budget: "customers/123/campaignBudgets/999" },
            campaign_budget: { amount_micros: 100_000_000 },
          },
        ];
      }),
    } as any;

    const guardrails = {
      cpaTargetMicros: null,
      roasTarget: null,
      lookbackDays: 30,
      minConversionsForCpaAction: 5,
      minClicksForCpaAction: 100,
      keywordSpendThresholdMicros: 5_000_000,
      bidReductionPct: 0.2,
    };

    const proposal: ProposalDraft = {
      proposalType: "increase_campaign_budget",
      title: "Increase budget",
      rationale: "Test",
      estimatedImpact: {},
      dedupeKey: "k1",
      payload: {
        kind: "increase_campaign_budget",
        campaignId: "1",
        campaignResourceName: "customers/123/campaigns/1",
        campaignBudgetId: "999",
        campaignBudgetResourceName: "customers/123/campaignBudgets/999",
        beforeAmountMicros: 100_000_000,
        afterAmountMicros: 120_000_000, // 20% increase => triggers >10% and net >15%
        increaseMicros: 20_000_000,
        increasePct: 0.2,
        lookbackDays: 30,
        metrics: { costMicros: 1, conversionsValue: 1, roas: 1 },
      },
    };

    const decisions = await governProposals({ client: mockClient, guardrails, proposals: [proposal] });
    const d = decisions.get("k1");
    expect(d).toBeTruthy();
    expect(d!.requires_approval).toBe(true);
    expect(d!.risk_flags).toContain("BUDGET_INCREASE_REQUIRES_APPROVAL_GT_10PCT");
    expect(d!.risk_flags).toContain("NET_DAILY_SPEND_INCREASE_REQUIRES_APPROVAL_GT_15PCT");
    // Governor must clamp net increase to 15%
    expect(d!.risk_flags).toContain("NET_DAILY_SPEND_INCREASE_CLAMPED_TO_15PCT");
  });

  it("Execution is blocked when execution_enabled = false", async () => {
    const events: any[] = [];
    const rpcCalled: { called: boolean } = { called: false };

    vi.doMock("../../api/_lib/googleAdsOperator/db", () => {
      return {
        supabaseAdmin: () => ({
          from: (table: string) => {
            if (table === "ad_accounts") {
              return {
                select: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        customer_id: "1234567890",
                        login_customer_id: null,
                        provider: "google_ads",
                        is_active: true,
                        execution_enabled: false,
                      },
                      error: null,
                    }),
                  }),
                }),
              };
            }
            if (table === "action_events") {
              return {
                insert: async (row: any) => {
                  events.push(row);
                  return { error: null };
                },
              };
            }
            if (table === "action_proposals") {
              return {
                update: () => ({ eq: async () => ({ error: null }) }),
              };
            }
            return {
              select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
            };
          },
          rpc: async () => {
            rpcCalled.called = true;
            return { data: null, error: { message: "rpc should not be called" } };
          },
          auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } },
        }),
      };
    });

    // Re-import executor after mock is registered
    const { executeApprovedProposal: exec } = await import("../../api/_lib/googleAdsOperator/executor");

    const result = await exec({
      proposalId: "00000000-0000-0000-0000-000000000001",
      workspaceId: "00000000-0000-0000-0000-000000000002",
      adAccountId: "00000000-0000-0000-0000-000000000003",
      approvedPayload: {
        kind: "pause_ad_group",
        adGroupId: "123",
        adGroupResourceName: "customers/123/adGroups/123",
        campaignId: "1",
        campaignResourceName: "customers/123/campaigns/1",
        beforeStatus: "ENABLED",
        afterStatus: "PAUSED",
        lookbackDays: 30,
        metrics: { costMicros: 1, conversions: 1, clicks: 100, cpaMicros: 1 },
      },
      actorType: "system",
    });

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("execution_disabled");
    expect(rpcCalled.called).toBe(false);
    expect(events.some((e) => e.message === "AI execution disabled by user.")).toBe(true);
  });
});

