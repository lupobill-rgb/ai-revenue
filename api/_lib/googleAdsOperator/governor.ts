import type { GoogleAdsClientWrapper } from "../googleAds/googleAdsClient";
import type { GuardrailsInput, ProposalDraft } from "./proposalGenerators";
import type { IncreaseCampaignBudgetPayload, ProposalPayload } from "./schemas";
import { ProposalPayloadSchema } from "./schemas";
import { safeNumber } from "./utils";

export type RiskFlag =
  | "FORBIDDEN_BILLING_CHANGE"
  | "FORBIDDEN_CONVERSION_TRACKING_CHANGE"
  | "FORBIDDEN_DELETE"
  | "UNKNOWN_PROPOSAL_KIND"
  | "BUDGET_INCREASE_REQUIRES_APPROVAL_GT_10PCT"
  | "NET_DAILY_SPEND_INCREASE_REQUIRES_APPROVAL_GT_15PCT"
  | "BUDGET_INCREASE_CLAMPED_TO_MAX_20PCT"
  | "NET_DAILY_SPEND_INCREASE_CLAMPED_TO_15PCT"
  | "INVALID_BID_CHANGE"
  | "INVALID_PAUSE_CHANGE";

export type EstimatedSpendImpact = {
  baselineDailyBudgetMicros: number;
  projectedDailyBudgetMicros: number;
  dailyBudgetChangeMicros: number;
  netDailyIncreasePct: number; // 0.0 - 1.0
};

export type GovernorDecision = {
  approved_payload: ProposalPayload | null;
  requires_approval: boolean;
  risk_flags: RiskFlag[];
  estimated_spend_impact: EstimatedSpendImpact;
};

type CampaignBudgetRow = {
  campaign?: { id?: string | number; status?: string; campaign_budget?: string };
  campaign_budget?: { amount_micros?: string | number };
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isForbiddenShape(payload: any): RiskFlag[] {
  // Defensive: proposals are typed, but we still guard against accidental
  // inclusion of forbidden changes if upstream logic expands in the future.
  const json = JSON.stringify(payload ?? {});
  const flags: RiskFlag[] = [];

  if (/(billing|payments|invoice|merchant_center)/i.test(json)) flags.push("FORBIDDEN_BILLING_CHANGE");
  if (/(conversion_action|conversion_tracking|tag|gtm|gclid|uploadClickConversions)/i.test(json)) {
    flags.push("FORBIDDEN_CONVERSION_TRACKING_CHANGE");
  }
  if (/(delete|remove)/i.test(json)) flags.push("FORBIDDEN_DELETE");

  return flags;
}

function budgetDeltaMicrosFromPayload(payload: ProposalPayload): number {
  if (payload.kind !== "increase_campaign_budget") return 0;
  return payload.afterAmountMicros - payload.beforeAmountMicros;
}

function ensureBudgetPayloadWithinSingleChangeCap(args: {
  payload: IncreaseCampaignBudgetPayload;
  guardrails: GuardrailsInput;
}): { payload: IncreaseCampaignBudgetPayload; flags: RiskFlag[] } {
  const flags: RiskFlag[] = [];
  const maxSinglePct = clamp(args.guardrails?.bidReductionPct ? args.guardrails.bidReductionPct : 0.2, 0, 0.5); // not used
  // Use product hard cap: 20%
  const capPct = 0.2;
  const before = args.payload.beforeAmountMicros;
  const desiredAfter = args.payload.afterAmountMicros;
  const desiredPct = (desiredAfter - before) / before;

  if (desiredPct <= capPct) return { payload: args.payload, flags };

  const clampedAfter = Math.trunc(before * (1 + capPct));
  flags.push("BUDGET_INCREASE_CLAMPED_TO_MAX_20PCT");

  return {
    payload: {
      ...args.payload,
      afterAmountMicros: clampedAfter,
      increaseMicros: clampedAfter - before,
      increasePct: (clampedAfter - before) / before,
    },
    flags,
  };
}

function approvalNeededForBudgetIncrease(payload: IncreaseCampaignBudgetPayload): boolean {
  // Approval threshold: budget increases > 10%
  return payload.increasePct > 0.1;
}

async function getBaselineDailyBudgetMicros(args: {
  client: GoogleAdsClientWrapper;
  lookbackDays: number;
}): Promise<{ baselineDailyBudgetMicros: number; budgetsByResource: Map<string, number> }> {
  // NOTE: We treat "daily spend" proxy as sum of enabled campaign budgets.
  // Budgets can be shared across campaigns, so we de-dupe by budget resource name.
  const rows = await args.client.query<CampaignBudgetRow[]>(`
    SELECT
      campaign.id,
      campaign.status,
      campaign.campaign_budget,
      campaign_budget.amount_micros
    FROM campaign
    WHERE campaign.status = "ENABLED"
  `);

  const budgetsByResource = new Map<string, number>();
  for (const row of rows || []) {
    const budgetRes = row?.campaign?.campaign_budget;
    if (!budgetRes) continue;
    const amt = Math.trunc(safeNumber(row?.campaign_budget?.amount_micros));
    if (amt <= 0) continue;
    budgetsByResource.set(String(budgetRes), amt);
  }

  let baselineDailyBudgetMicros = 0;
  for (const v of budgetsByResource.values()) baselineDailyBudgetMicros += v;

  return { baselineDailyBudgetMicros, budgetsByResource };
}

function computeImpact(args: { baselineDailyBudgetMicros: number; deltaMicros: number }): EstimatedSpendImpact {
  const baseline = Math.max(0, Math.trunc(args.baselineDailyBudgetMicros));
  const projected = Math.max(0, baseline + Math.trunc(args.deltaMicros));
  const pct = baseline > 0 ? (projected - baseline) / baseline : 0;
  return {
    baselineDailyBudgetMicros: baseline,
    projectedDailyBudgetMicros: projected,
    dailyBudgetChangeMicros: projected - baseline,
    netDailyIncreasePct: pct,
  };
}

/**
 * Evaluate a batch of proposals so we can enforce net daily spend increase caps.
 * This does NOT execute anything; it only returns deterministic decisions.
 */
export async function governProposals(args: {
  client: GoogleAdsClientWrapper;
  guardrails: GuardrailsInput;
  proposals: ProposalDraft[];
}): Promise<Map<string, GovernorDecision>> {
  const { baselineDailyBudgetMicros, budgetsByResource } = await getBaselineDailyBudgetMicros({
    client: args.client,
    lookbackDays: args.guardrails.lookbackDays,
  });

  const decisions = new Map<string, GovernorDecision>();

  // Track cumulative net increase across the batch (unique budget resources).
  const appliedBudgetAfter = new Map<string, number>(budgetsByResource);

  for (const p of args.proposals) {
    const risk_flags: RiskFlag[] = [];

    // Parse payload defensively
    let payload: ProposalPayload | null = null;
    try {
      payload = ProposalPayloadSchema.parse(p.payload);
    } catch {
      risk_flags.push("UNKNOWN_PROPOSAL_KIND");
    }

    // Hard-block forbidden shapes (billing, conversion tracking, deletes)
    const forbiddenFlags = isForbiddenShape(p.payload);
    risk_flags.push(...forbiddenFlags);

    // Default impact assumes no budget change.
    let deltaMicros = 0;
    let approved_payload: ProposalPayload | null = payload;
    let requires_approval = false;

    if (!payload || forbiddenFlags.length > 0) {
      // Block: no approved payload.
      approved_payload = null;
    } else if (payload.kind === "pause_ad_group") {
      if (payload.afterStatus !== "PAUSED") risk_flags.push("INVALID_PAUSE_CHANGE");
    } else if (payload.kind === "reduce_keyword_bid") {
      if (!(payload.afterCpcBidMicros > 0 && payload.afterCpcBidMicros < payload.beforeCpcBidMicros)) {
        risk_flags.push("INVALID_BID_CHANGE");
      }
    } else if (payload.kind === "increase_campaign_budget") {
      // Enforce max single change (20%) by clamping.
      const single = ensureBudgetPayloadWithinSingleChangeCap({ payload, guardrails: args.guardrails });
      approved_payload = single.payload;
      risk_flags.push(...single.flags);

      // Approval routing for >10% increases.
      if (approvalNeededForBudgetIncrease(single.payload)) {
        requires_approval = true;
        risk_flags.push("BUDGET_INCREASE_REQUIRES_APPROVAL_GT_10PCT");
      }

      // Net daily spend increase enforcement (15% cap, approval route if exceeded).
      const budgetRes = single.payload.campaignBudgetResourceName;
      const before = budgetsByResource.get(budgetRes) ?? single.payload.beforeAmountMicros;
      const desiredAfter = single.payload.afterAmountMicros;

      // Apply on top of any prior approved/clamped changes in this batch (for shared budgets).
      const currentAfter = appliedBudgetAfter.get(budgetRes) ?? before;
      const nextAfter = Math.max(currentAfter, desiredAfter); // increases only in v1
      appliedBudgetAfter.set(budgetRes, nextAfter);

      // Compute delta vs baseline using current batch-applied map.
      let projected = 0;
      for (const v of appliedBudgetAfter.values()) projected += v;
      deltaMicros = projected - baselineDailyBudgetMicros;

      const netPct = baselineDailyBudgetMicros > 0 ? deltaMicros / baselineDailyBudgetMicros : 0;
      if (netPct > 0.15) {
        requires_approval = true;
        risk_flags.push("NET_DAILY_SPEND_INCREASE_REQUIRES_APPROVAL_GT_15PCT");

        // Clamp this proposal's afterAmountMicros to bring netPct back to 15% (hard cap).
        // We do this by reducing THIS budget's after value, leaving prior budgets untouched.
        const capProjected = Math.trunc(baselineDailyBudgetMicros * 1.15);
        const over = projected - capProjected;
        if (over > 0) {
          const clampedAfter = Math.max(before, nextAfter - over);
          // Update applied map
          appliedBudgetAfter.set(budgetRes, clampedAfter);
          risk_flags.push("NET_DAILY_SPEND_INCREASE_CLAMPED_TO_15PCT");

          const clampedPayload: IncreaseCampaignBudgetPayload = {
            ...single.payload,
            afterAmountMicros: clampedAfter,
            increaseMicros: clampedAfter - single.payload.beforeAmountMicros,
            increasePct: (clampedAfter - single.payload.beforeAmountMicros) / single.payload.beforeAmountMicros,
          };
          approved_payload = clampedPayload;

          // Recompute delta after clamping
          projected = 0;
          for (const v of appliedBudgetAfter.values()) projected += v;
          deltaMicros = projected - baselineDailyBudgetMicros;
        }
      }
    } else {
      risk_flags.push("UNKNOWN_PROPOSAL_KIND");
      approved_payload = null;
    }

    // If any hard-block flags exist, force block.
    if (risk_flags.includes("FORBIDDEN_BILLING_CHANGE") || risk_flags.includes("FORBIDDEN_CONVERSION_TRACKING_CHANGE") || risk_flags.includes("FORBIDDEN_DELETE")) {
      approved_payload = null;
      requires_approval = true;
    }
    if (risk_flags.includes("UNKNOWN_PROPOSAL_KIND") || risk_flags.includes("INVALID_BID_CHANGE") || risk_flags.includes("INVALID_PAUSE_CHANGE")) {
      approved_payload = null;
      requires_approval = true;
    }

    // Estimated spend impact: if approved payload exists and is budget change, use its delta;
    // otherwise use current batch delta for context.
    const approvedDelta = approved_payload ? budgetDeltaMicrosFromPayload(approved_payload) : 0;
    const estimated_spend_impact = computeImpact({
      baselineDailyBudgetMicros,
      deltaMicros: approved_payload?.kind === "increase_campaign_budget" ? (approvedDelta + (deltaMicros - approvedDelta)) : deltaMicros,
    });

    decisions.set(p.dedupeKey, { approved_payload, requires_approval, risk_flags, estimated_spend_impact });
  }

  return decisions;
}

