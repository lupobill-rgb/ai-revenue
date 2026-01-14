import { z } from "zod";

export const PauseAdGroupPayloadSchema = z.object({
  kind: z.literal("pause_ad_group"),
  adGroupId: z.string(),
  adGroupResourceName: z.string(),
  adGroupName: z.string().optional(),
  campaignId: z.string(),
  campaignResourceName: z.string(),
  campaignName: z.string().optional(),
  beforeStatus: z.string(),
  afterStatus: z.literal("PAUSED"),
  lookbackDays: z.number().int().positive(),
  metrics: z.object({
    costMicros: z.number().int().nonnegative(),
    conversions: z.number().nonnegative(),
    clicks: z.number().int().nonnegative(),
    cpaMicros: z.number().int().nonnegative(),
  }),
});

export const ReduceKeywordBidPayloadSchema = z.object({
  kind: z.literal("reduce_keyword_bid"),
  adGroupId: z.string(),
  criterionId: z.string(),
  criterionResourceName: z.string(),
  keywordText: z.string().nullable().optional(),
  matchType: z.string().nullable().optional(),
  beforeCpcBidMicros: z.number().int().positive(),
  afterCpcBidMicros: z.number().int().positive(),
  lookbackDays: z.number().int().positive(),
  metrics: z.object({
    spendMicros: z.number().int().nonnegative(),
    conversions: z.number().nonnegative(),
  }),
});

export const IncreaseCampaignBudgetPayloadSchema = z.object({
  kind: z.literal("increase_campaign_budget"),
  campaignId: z.string(),
  campaignResourceName: z.string(),
  campaignName: z.string().optional(),
  campaignBudgetId: z.string(),
  campaignBudgetResourceName: z.string(),
  beforeAmountMicros: z.number().int().positive(),
  afterAmountMicros: z.number().int().positive(),
  increaseMicros: z.number().int().positive(),
  increasePct: z.number().positive(),
  lookbackDays: z.number().int().positive(),
  metrics: z.object({
    costMicros: z.number().int().nonnegative(),
    conversionsValue: z.number().nonnegative(),
    roas: z.number().nonnegative(),
  }),
});

export const ProposalPayloadSchema = z.discriminatedUnion("kind", [
  PauseAdGroupPayloadSchema,
  ReduceKeywordBidPayloadSchema,
  IncreaseCampaignBudgetPayloadSchema,
]);

export type PauseAdGroupPayload = z.infer<typeof PauseAdGroupPayloadSchema>;
export type ReduceKeywordBidPayload = z.infer<typeof ReduceKeywordBidPayloadSchema>;
export type IncreaseCampaignBudgetPayload = z.infer<typeof IncreaseCampaignBudgetPayloadSchema>;
export type ProposalPayload = z.infer<typeof ProposalPayloadSchema>;

export type ProposalType = ProposalPayload["kind"];

