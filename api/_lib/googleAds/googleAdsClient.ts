import { GoogleAdsApi, ResourceNames, enums, resources, type MutateOperation } from "google-ads-api";
import type { GoogleAdsAuth, GoogleAdsCustomerRef } from "./auth";

type GAQLRow = Record<string, any>;

export type EnsureResult = {
  kind: "noop" | "mutated";
  resourceName: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

export class GoogleAdsClientWrapper {
  private readonly customerId: string;
  private readonly customer: any;

  constructor(args: { auth: GoogleAdsAuth; customer: GoogleAdsCustomerRef }) {
    const client = new GoogleAdsApi({
      client_id: args.auth.clientId,
      client_secret: args.auth.clientSecret,
      developer_token: args.auth.developerToken,
    });

    this.customerId = args.customer.customerId;

    this.customer = client.Customer({
      customer_id: args.customer.customerId,
      login_customer_id: args.customer.loginCustomerId ?? args.auth.loginCustomerId,
      linked_customer_id: args.customer.linkedCustomerId ?? args.auth.linkedCustomerId,
      refresh_token: args.auth.refreshToken,
    });
  }

  /**
   * GAQL reporting (single request). Prefer small/targeted queries.
   */
  async query<T = GAQLRow[]>(gaql: string): Promise<T> {
    return await this.customer.query<T>(gaql);
  }

  async getAdGroupStatus(adGroupId: string | number): Promise<{ resourceName: string; status: string }> {
    const resourceName = ResourceNames.adGroup(this.customerId, adGroupId);
    const rows = await this.query<GAQLRow[]>(`
      SELECT ad_group.resource_name, ad_group.status
      FROM ad_group
      WHERE ad_group.resource_name = "${resourceName}"
      LIMIT 1
    `);
    const status = rows?.[0]?.ad_group?.status as string | undefined;
    if (!status) throw new Error(`Ad group not found for resource_name=${resourceName}`);
    return { resourceName, status };
  }

  async getKeywordCpcBidMicros(args: {
    adGroupId: string | number;
    criterionId: string | number;
  }): Promise<{ resourceName: string; cpcBidMicros: number; status?: string }> {
    const resourceName = ResourceNames.adGroupCriterion(this.customerId, args.adGroupId, args.criterionId);
    const rows = await this.query<GAQLRow[]>(`
      SELECT ad_group_criterion.resource_name, ad_group_criterion.status, ad_group_criterion.cpc_bid_micros
      FROM ad_group_criterion
      WHERE ad_group_criterion.resource_name = "${resourceName}"
      LIMIT 1
    `);
    const current = rows?.[0]?.ad_group_criterion;
    const bid = current?.cpc_bid_micros as number | undefined;
    if (typeof bid !== "number") throw new Error(`Keyword criterion not found or missing bid for resource_name=${resourceName}`);
    return { resourceName, cpcBidMicros: bid, status: current?.status as string | undefined };
  }

  async getCampaignBudgetAmountMicros(args: {
    campaignBudgetId: string | number;
  }): Promise<{ resourceName: string; amountMicros: number }> {
    const resourceName = ResourceNames.campaignBudget(this.customerId, args.campaignBudgetId);
    const rows = await this.query<GAQLRow[]>(`
      SELECT campaign_budget.resource_name, campaign_budget.amount_micros
      FROM campaign_budget
      WHERE campaign_budget.resource_name = "${resourceName}"
      LIMIT 1
    `);
    const amt = rows?.[0]?.campaign_budget?.amount_micros as number | undefined;
    if (typeof amt !== "number") throw new Error(`Campaign budget not found for resource_name=${resourceName}`);
    return { resourceName, amountMicros: amt };
  }

  /**
   * Idempotently pause an ad group (never delete).
   */
  async ensureAdGroupPaused(adGroupId: string | number): Promise<EnsureResult> {
    const resourceName = ResourceNames.adGroup(this.customerId, adGroupId);

    const rows = await this.query<GAQLRow[]>(`
      SELECT ad_group.resource_name, ad_group.status
      FROM ad_group
      WHERE ad_group.resource_name = "${resourceName}"
      LIMIT 1
    `);

    const current = rows?.[0]?.ad_group;
    const beforeStatus = current?.status as string | undefined;

    if (!beforeStatus) {
      throw new Error(`Ad group not found for resource_name=${resourceName}`);
    }

    if (beforeStatus === "PAUSED") {
      return { kind: "noop", resourceName, before: { status: beforeStatus }, after: { status: "PAUSED" } };
    }

    const operations: MutateOperation<resources.IAdGroup>[] = [
      {
        entity: "ad_group",
        operation: "update",
        resource: {
          resource_name: resourceName,
          status: enums.AdGroupStatus.PAUSED,
        },
      },
    ];

    await this.customer.mutateResources(operations, { partial_failure: false, validate_only: false });
    return { kind: "mutated", resourceName, before: { status: beforeStatus }, after: { status: "PAUSED" } };
  }

  /**
   * Idempotently set a keyword CPC bid (micros). This only touches ad_group_criterion.cpc_bid_micros.
   */
  async ensureKeywordCpcBidMicros(args: {
    adGroupId: string | number;
    criterionId: string | number;
    desiredCpcBidMicros: number;
  }): Promise<EnsureResult> {
    if (!Number.isFinite(args.desiredCpcBidMicros) || args.desiredCpcBidMicros <= 0) {
      throw new Error(`desiredCpcBidMicros must be > 0; got ${args.desiredCpcBidMicros}`);
    }

    const resourceName = ResourceNames.adGroupCriterion(this.customerId, args.adGroupId, args.criterionId);

    const rows = await this.query<GAQLRow[]>(`
      SELECT ad_group_criterion.resource_name, ad_group_criterion.status, ad_group_criterion.cpc_bid_micros
      FROM ad_group_criterion
      WHERE ad_group_criterion.resource_name = "${resourceName}"
      LIMIT 1
    `);

    const current = rows?.[0]?.ad_group_criterion;
    const beforeBid = current?.cpc_bid_micros as number | undefined;

    if (typeof beforeBid !== "number") {
      throw new Error(`Keyword criterion not found or missing bid for resource_name=${resourceName}`);
    }

    if (beforeBid === args.desiredCpcBidMicros) {
      return {
        kind: "noop",
        resourceName,
        before: { cpc_bid_micros: beforeBid },
        after: { cpc_bid_micros: args.desiredCpcBidMicros },
      };
    }

    const operations: MutateOperation<resources.IAdGroupCriterion>[] = [
      {
        entity: "ad_group_criterion",
        operation: "update",
        resource: {
          resource_name: resourceName,
          cpc_bid_micros: args.desiredCpcBidMicros,
        },
      },
    ];

    await this.customer.mutateResources(operations, { partial_failure: false, validate_only: false });
    return {
      kind: "mutated",
      resourceName,
      before: { cpc_bid_micros: beforeBid },
      after: { cpc_bid_micros: args.desiredCpcBidMicros },
    };
  }

  /**
   * Idempotently set a campaign budget amount (micros). Only touches campaign_budget.amount_micros.
   */
  async ensureCampaignBudgetAmountMicros(args: {
    campaignBudgetId: string | number;
    desiredAmountMicros: number;
  }): Promise<EnsureResult> {
    if (!Number.isFinite(args.desiredAmountMicros) || args.desiredAmountMicros <= 0) {
      throw new Error(`desiredAmountMicros must be > 0; got ${args.desiredAmountMicros}`);
    }

    const resourceName = ResourceNames.campaignBudget(this.customerId, args.campaignBudgetId);

    const rows = await this.query<GAQLRow[]>(`
      SELECT campaign_budget.resource_name, campaign_budget.amount_micros
      FROM campaign_budget
      WHERE campaign_budget.resource_name = "${resourceName}"
      LIMIT 1
    `);

    const current = rows?.[0]?.campaign_budget;
    const beforeAmount = current?.amount_micros as number | undefined;

    if (typeof beforeAmount !== "number") {
      throw new Error(`Campaign budget not found for resource_name=${resourceName}`);
    }

    if (beforeAmount === args.desiredAmountMicros) {
      return {
        kind: "noop",
        resourceName,
        before: { amount_micros: beforeAmount },
        after: { amount_micros: args.desiredAmountMicros },
      };
    }

    const operations: MutateOperation<resources.ICampaignBudget>[] = [
      {
        entity: "campaign_budget",
        operation: "update",
        resource: {
          resource_name: resourceName,
          amount_micros: args.desiredAmountMicros,
        },
      },
    ];

    await this.customer.mutateResources(operations, { partial_failure: false, validate_only: false });
    return {
      kind: "mutated",
      resourceName,
      before: { amount_micros: beforeAmount },
      after: { amount_micros: args.desiredAmountMicros },
    };
  }
}

