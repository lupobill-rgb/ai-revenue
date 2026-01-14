import { ResourceNames } from "google-ads-api";
import type { GoogleAdsClientWrapper } from "../googleAds/googleAdsClient";
import type {
  IncreaseCampaignBudgetPayload,
  PauseAdGroupPayload,
  ProposalPayload,
  ReduceKeywordBidPayload,
} from "./schemas";
import { ProposalPayloadSchema } from "./schemas";
import { lookbackRangeUtc, safeNumber, stableSha256 } from "./utils";

export type GuardrailsInput = {
  // All micros are in account currency micros unless otherwise specified.
  cpaTargetMicros: number | null;
  roasTarget: number | null;
  lookbackDays: number;
  minConversionsForCpaAction: number;
  minClicksForCpaAction: number;
  keywordSpendThresholdMicros: number;
  bidReductionPct: number; // e.g. 0.20
};

export type ProposalDraft = {
  proposalType: "pause_ad_group" | "reduce_keyword_bid" | "increase_campaign_budget";
  title: string;
  rationale: string;
  estimatedImpact: Record<string, unknown>;
  payload: ProposalPayload;
  dedupeKey: string;
};

function dedupeKeyForPayload(input: { workspaceId: string; adAccountId: string; payload: ProposalPayload }): string {
  // Stable across runs for the same intended end-state.
  return stableSha256(
    JSON.stringify({
      v: 1,
      workspaceId: input.workspaceId,
      adAccountId: input.adAccountId,
      kind: input.payload.kind,
      target:
        input.payload.kind === "pause_ad_group"
          ? { adGroupId: input.payload.adGroupId, afterStatus: input.payload.afterStatus }
          : input.payload.kind === "reduce_keyword_bid"
            ? { adGroupId: input.payload.adGroupId, criterionId: input.payload.criterionId, after: input.payload.afterCpcBidMicros }
            : { campaignId: input.payload.campaignId, budgetId: input.payload.campaignBudgetId, after: input.payload.afterAmountMicros },
    }),
  );
}

export async function generatePauseAdGroupProposals(args: {
  client: GoogleAdsClientWrapper;
  customerId: string;
  workspaceId: string;
  adAccountId: string;
  guardrails: GuardrailsInput;
}): Promise<ProposalDraft[]> {
  if (!args.guardrails.cpaTargetMicros || args.guardrails.cpaTargetMicros <= 0) return [];
  const { start, end } = lookbackRangeUtc(args.guardrails.lookbackDays);

  const rows = await args.client.query<any[]>(`
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group.status,
      metrics.cost_micros,
      metrics.conversions,
      metrics.clicks
    FROM ad_group
    WHERE
      ad_group.status = "ENABLED"
      AND segments.date BETWEEN "${start}" AND "${end}"
  `);

  const out: ProposalDraft[] = [];

  for (const row of rows || []) {
    const adGroup = row.ad_group;
    const campaign = row.campaign;
    const metrics = row.metrics;

    const costMicros = Math.trunc(safeNumber(metrics?.cost_micros));
    const conversions = safeNumber(metrics?.conversions);
    const clicks = Math.trunc(safeNumber(metrics?.clicks));

    if (conversions < args.guardrails.minConversionsForCpaAction) continue;
    if (clicks < args.guardrails.minClicksForCpaAction) continue;
    if (costMicros <= 0) continue;

    const cpaMicros = Math.round(costMicros / Math.max(conversions, 1e-9));
    if (cpaMicros <= args.guardrails.cpaTargetMicros) continue;

    const payload: PauseAdGroupPayload = {
      kind: "pause_ad_group",
      adGroupId: String(adGroup?.id),
      adGroupResourceName: ResourceNames.adGroup(args.customerId, adGroup?.id),
      adGroupName: adGroup?.name ?? undefined,
      campaignId: String(campaign?.id),
      campaignResourceName: ResourceNames.campaign(args.customerId, campaign?.id),
      campaignName: campaign?.name ?? undefined,
      beforeStatus: String(adGroup?.status),
      afterStatus: "PAUSED",
      lookbackDays: args.guardrails.lookbackDays,
      metrics: {
        costMicros,
        conversions,
        clicks,
        cpaMicros,
      },
    };

    const parsed = ProposalPayloadSchema.parse(payload);
    const dedupeKey = dedupeKeyForPayload({ workspaceId: args.workspaceId, adAccountId: args.adAccountId, payload: parsed });

    out.push({
      proposalType: "pause_ad_group",
      title: `Pause ad group "${payload.adGroupName ?? payload.adGroupId}" (CPA above target)`,
      rationale: `CPA of ${(payload.metrics.cpaMicros / 1_000_000).toFixed(2)} is above target of ${(args.guardrails.cpaTargetMicros / 1_000_000).toFixed(2)} over last ${args.guardrails.lookbackDays} days with ${payload.metrics.conversions.toFixed(1)} conversions.`,
      estimatedImpact: {
        expected: "reduce_waste",
        costMicros,
      },
      payload: parsed,
      dedupeKey,
    });
  }

  return out;
}

export async function generateReduceKeywordBidProposals(args: {
  client: GoogleAdsClientWrapper;
  customerId: string;
  workspaceId: string;
  adAccountId: string;
  guardrails: GuardrailsInput;
}): Promise<ProposalDraft[]> {
  const { start, end } = lookbackRangeUtc(args.guardrails.lookbackDays);
  const threshold = Math.trunc(args.guardrails.keywordSpendThresholdMicros);
  const reductionPct = args.guardrails.bidReductionPct;

  if (!(reductionPct > 0 && reductionPct < 1)) return [];

  const rows = await args.client.query<any[]>(`
    SELECT
      ad_group.id,
      ad_group_criterion.criterion_id,
      ad_group_criterion.resource_name,
      ad_group_criterion.status,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.cpc_bid_micros,
      metrics.cost_micros,
      metrics.conversions
    FROM keyword_view
    WHERE
      ad_group_criterion.status = "ENABLED"
      AND metrics.conversions = 0
      AND metrics.cost_micros > ${threshold}
      AND segments.date BETWEEN "${start}" AND "${end}"
  `);

  const out: ProposalDraft[] = [];

  for (const row of rows || []) {
    const adGroup = row.ad_group;
    const crit = row.ad_group_criterion;
    const metrics = row.metrics;

    const beforeBid = Math.trunc(safeNumber(crit?.cpc_bid_micros));
    if (beforeBid <= 0) continue;

    const afterBid = Math.trunc(beforeBid * (1 - reductionPct));
    if (afterBid <= 0) continue;
    if (afterBid === beforeBid) continue;

    const spendMicros = Math.trunc(safeNumber(metrics?.cost_micros));
    const conversions = safeNumber(metrics?.conversions);

    const payload: ReduceKeywordBidPayload = {
      kind: "reduce_keyword_bid",
      adGroupId: String(adGroup?.id),
      criterionId: String(crit?.criterion_id),
      criterionResourceName: String(crit?.resource_name),
      keywordText: crit?.keyword?.text ?? null,
      matchType: crit?.keyword?.match_type ?? null,
      beforeCpcBidMicros: beforeBid,
      afterCpcBidMicros: afterBid,
      lookbackDays: args.guardrails.lookbackDays,
      metrics: {
        spendMicros,
        conversions,
      },
    };

    const parsed = ProposalPayloadSchema.parse(payload);
    const dedupeKey = dedupeKeyForPayload({ workspaceId: args.workspaceId, adAccountId: args.adAccountId, payload: parsed });

    out.push({
      proposalType: "reduce_keyword_bid",
      title: `Reduce bid for keyword "${payload.keywordText ?? payload.criterionId}" (spend with zero conv)`,
      rationale: `Keyword spent ${(spendMicros / 1_000_000).toFixed(2)} with 0 conversions over last ${args.guardrails.lookbackDays} days; reducing bid by ${(reductionPct * 100).toFixed(0)}% to curb waste.`,
      estimatedImpact: {
        expected: "reduce_waste",
        spendMicros,
        bidBeforeMicros: beforeBid,
        bidAfterMicros: afterBid,
      },
      payload: parsed,
      dedupeKey,
    });
  }

  return out;
}

export async function generateIncreaseBudgetProposals(args: {
  client: GoogleAdsClientWrapper;
  customerId: string;
  workspaceId: string;
  adAccountId: string;
  guardrails: GuardrailsInput;
  // Proposal-only heuristic (governor enforces caps/approvals later)
  proposedIncreasePct?: number; // default 0.10
}): Promise<ProposalDraft[]> {
  if (!args.guardrails.roasTarget || args.guardrails.roasTarget <= 0) return [];

  const increasePct = typeof args.proposedIncreasePct === "number" ? args.proposedIncreasePct : 0.10;
  if (!(increasePct > 0 && increasePct <= 0.20)) return [];

  const { start, end } = lookbackRangeUtc(args.guardrails.lookbackDays);

  const rows = await args.client.query<any[]>(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.campaign_budget,
      campaign_budget.amount_micros,
      metrics.cost_micros,
      metrics.conversions_value
    FROM campaign
    WHERE
      campaign.status = "ENABLED"
      AND segments.date BETWEEN "${start}" AND "${end}"
  `);

  const out: ProposalDraft[] = [];

  for (const row of rows || []) {
    const campaign = row.campaign;
    const budget = row.campaign_budget;
    const metrics = row.metrics;

    const costMicros = Math.trunc(safeNumber(metrics?.cost_micros));
    const conversionsValue = safeNumber(metrics?.conversions_value);
    if (costMicros <= 0) continue;

    // ROAS = conversion_value / cost (currency units / currency units)
    const roas = (conversionsValue * 1_000_000) / costMicros;
    if (roas <= args.guardrails.roasTarget) continue;

    const beforeAmount = Math.trunc(safeNumber(budget?.amount_micros));
    if (beforeAmount <= 0) continue;

    const afterAmount = Math.trunc(beforeAmount * (1 + increasePct));
    if (afterAmount <= beforeAmount) continue;

    const campaignBudgetResourceName = String(campaign?.campaign_budget);
    const campaignBudgetId = campaignBudgetResourceName.split("/").pop() || "";
    if (!campaignBudgetId) continue;

    const payload: IncreaseCampaignBudgetPayload = {
      kind: "increase_campaign_budget",
      campaignId: String(campaign?.id),
      campaignResourceName: ResourceNames.campaign(args.customerId, campaign?.id),
      campaignName: campaign?.name ?? undefined,
      campaignBudgetId,
      campaignBudgetResourceName,
      beforeAmountMicros: beforeAmount,
      afterAmountMicros: afterAmount,
      increaseMicros: afterAmount - beforeAmount,
      increasePct,
      lookbackDays: args.guardrails.lookbackDays,
      metrics: {
        costMicros,
        conversionsValue,
        roas,
      },
    };

    const parsed = ProposalPayloadSchema.parse(payload);
    const dedupeKey = dedupeKeyForPayload({ workspaceId: args.workspaceId, adAccountId: args.adAccountId, payload: parsed });

    out.push({
      proposalType: "increase_campaign_budget",
      title: `Increase budget for "${payload.campaignName ?? payload.campaignId}" (ROAS positive)`,
      rationale: `Campaign ROAS of ${roas.toFixed(2)} is above target ${args.guardrails.roasTarget.toFixed(2)} over last ${args.guardrails.lookbackDays} days; proposing +${(increasePct * 100).toFixed(0)}% budget to scale.`,
      estimatedImpact: {
        expected: "scale_winners",
        roas,
        costMicros,
        conversionsValue,
        budgetBeforeMicros: beforeAmount,
        budgetAfterMicros: afterAmount,
      },
      payload: parsed,
      dedupeKey,
    });
  }

  return out;
}

