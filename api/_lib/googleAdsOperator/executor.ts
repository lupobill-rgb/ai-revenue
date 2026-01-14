import { z } from "zod";
import type { GoogleAdsAuth } from "../googleAds/auth";
import { googleAdsAuthFromEnv } from "../googleAds/auth";
import { GoogleAdsClientWrapper } from "../googleAds/googleAdsClient";
import { supabaseAdmin, type ActionEventInsert } from "./db";
import type { ProposalPayload } from "./schemas";
import { ProposalPayloadSchema } from "./schemas";

const ExecuteInputSchema = z.object({
  proposalId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  adAccountId: z.string().uuid(),
  approvedPayload: ProposalPayloadSchema,
  runId: z.string().uuid().optional(),
  actorType: z.enum(["system", "ai", "human"]).default("system"),
  actorId: z.string().uuid().optional(),
});

export type ExecuteInput = z.infer<typeof ExecuteInputSchema>;

type ExecutionOutcome = "success" | "partial_failure" | "failure";

async function insertEvent(event: ActionEventInsert) {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("action_events").insert({
    workspace_id: event.workspace_id,
    ad_account_id: event.ad_account_id,
    proposal_id: event.proposal_id ?? null,
    event_type: event.event_type,
    actor_type: event.actor_type,
    actor_id: event.actor_id ?? null,
    run_id: event.run_id ?? null,
    message: event.message,
    details: event.details ?? {},
  });
  if (error) throw new Error(`Failed to insert action_event: ${error.message}`);
}

async function updateProposalStatus(args: {
  proposalId: string;
  status: "executing" | "executed" | "failed";
  executedAt?: string | null;
  lastError?: string | null;
}) {
  const supabase = supabaseAdmin();
  const update: Record<string, unknown> = { status: args.status };
  if (typeof args.executedAt !== "undefined") update.executed_at = args.executedAt;
  if (typeof args.lastError !== "undefined") update.last_error = args.lastError;
  const { error } = await supabase.from("action_proposals").update(update).eq("id", args.proposalId);
  if (error) throw new Error(`Failed to update action_proposal: ${error.message}`);
}

async function claimForExecution(proposalId: string): Promise<{ status: string; executed_at: string | null }> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.rpc("claim_action_proposal_for_execution", { p_proposal_id: proposalId });
  if (error) throw new Error(`Failed to claim proposal for execution: ${error.message}`);
  const status = (data as any)?.status as string | undefined;
  const executed_at = ((data as any)?.executed_at as string | null | undefined) ?? null;
  if (!status) throw new Error("claim_action_proposal_for_execution returned no status");
  return { status, executed_at };
}

async function getAdAccountCustomer(args: {
  adAccountId: string;
}): Promise<{ customerId: string; loginCustomerId?: string; executionEnabled: boolean }> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("ad_accounts")
    .select("customer_id, login_customer_id, provider, is_active, execution_enabled")
    .eq("id", args.adAccountId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load ad_account: ${error.message}`);
  if (!data) throw new Error(`ad_account not found: ${args.adAccountId}`);
  if (data.provider !== "google_ads") throw new Error(`Unsupported ads provider: ${data.provider}`);
  if (data.is_active === false) throw new Error("ad_account is inactive");
  return {
    customerId: data.customer_id,
    loginCustomerId: data.login_customer_id ?? undefined,
    executionEnabled: data.execution_enabled !== false,
  };
}

function assertOnlyApprovedPayloadUsed(payload: ProposalPayload) {
  // Execution layer must consume ONLY the approved_payload object (already governor-sanitized).
  // We enforce by never loading proposal.payload here, and parsing strictly.
  ProposalPayloadSchema.parse(payload);
}

export async function executeApprovedProposal(raw: ExecuteInput, auth?: GoogleAdsAuth) {
  const input = ExecuteInputSchema.parse(raw);
  assertOnlyApprovedPayloadUsed(input.approvedPayload);

  // Kill switch: hard stop execution per ad account.
  // IMPORTANT: Do this before claiming the proposal to avoid flipping status to "executing".
  const adAccount = await getAdAccountCustomer({ adAccountId: input.adAccountId });
  if (!adAccount.executionEnabled) {
    await insertEvent({
      workspace_id: input.workspaceId,
      ad_account_id: input.adAccountId,
      proposal_id: input.proposalId,
      event_type: "note",
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      run_id: input.runId ?? null,
      message: "AI execution disabled by user.",
      details: { execution_enabled: false },
    });
    return { outcome: "success" as ExecutionOutcome, skipped: true, reason: "execution_disabled" as const };
  }

  // Idempotent claim: only transitions APPROVED -> EXECUTING.
  const claim = await claimForExecution(input.proposalId);
  if (claim.executed_at) {
    // Already executed in a previous run; no-op, but still verifiable by caller if desired.
    await insertEvent({
      workspace_id: input.workspaceId,
      ad_account_id: input.adAccountId,
      proposal_id: input.proposalId,
      event_type: "note",
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      run_id: input.runId ?? null,
      message: "Execution skipped: proposal already executed",
      details: { status: claim.status, executed_at: claim.executed_at },
    });
    return { outcome: "success" as ExecutionOutcome, skipped: true };
  }

  if (claim.status !== "executing") {
    await insertEvent({
      workspace_id: input.workspaceId,
      ad_account_id: input.adAccountId,
      proposal_id: input.proposalId,
      event_type: "note",
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      run_id: input.runId ?? null,
      message: "Execution skipped: proposal not in executable state",
      details: { status: claim.status },
    });
    return { outcome: "failure" as ExecutionOutcome, skipped: true };
  }

  const { customerId, loginCustomerId } = adAccount;
  const googleAuth = auth ?? googleAdsAuthFromEnv();
  const client = new GoogleAdsClientWrapper({
    auth: googleAuth,
    customer: { customerId, loginCustomerId },
  });

  const payload = input.approvedPayload;

  await insertEvent({
    workspace_id: input.workspaceId,
    ad_account_id: input.adAccountId,
    proposal_id: input.proposalId,
    event_type: "execution_started",
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    run_id: input.runId ?? null,
    message: `Execution started for ${payload.kind}`,
    details: { approved_payload: payload },
  });

  try {
    // Capture before_state from authoritative re-fetch.
    let before_state: Record<string, unknown> = {};
    let after_state: Record<string, unknown> = {};

    if (payload.kind === "pause_ad_group") {
      const before = await client.getAdGroupStatus(payload.adGroupId);
      before_state = before;

      const mutation = await client.ensureAdGroupPaused(payload.adGroupId);

      const after = await client.getAdGroupStatus(payload.adGroupId);
      after_state = after;

      const ok = after.status === "PAUSED";
      await insertEvent({
        workspace_id: input.workspaceId,
        ad_account_id: input.adAccountId,
        proposal_id: input.proposalId,
        event_type: ok ? "execution_succeeded" : "execution_failed",
        actor_type: input.actorType,
        actor_id: input.actorId ?? null,
        run_id: input.runId ?? null,
        message: ok ? "Mutation applied" : "Mutation did not reach desired state",
        details: { outcome: ok ? "success" : "failure", before_state, mutation, after_state },
      });

      await insertEvent({
        workspace_id: input.workspaceId,
        ad_account_id: input.adAccountId,
        proposal_id: input.proposalId,
        event_type: ok ? "verification_succeeded" : "verification_failed",
        actor_type: input.actorType,
        actor_id: input.actorId ?? null,
        run_id: input.runId ?? null,
        message: ok ? "Verification succeeded" : "Verification failed",
        details: { expected: { status: "PAUSED" }, after_state },
      });

      if (!ok) throw new Error(`Verification failed: expected ad_group.status=PAUSED, got ${after.status}`);
    } else if (payload.kind === "reduce_keyword_bid") {
      const before = await client.getKeywordCpcBidMicros({ adGroupId: payload.adGroupId, criterionId: payload.criterionId });
      before_state = before;

      const mutation = await client.ensureKeywordCpcBidMicros({
        adGroupId: payload.adGroupId,
        criterionId: payload.criterionId,
        desiredCpcBidMicros: payload.afterCpcBidMicros,
      });

      const after = await client.getKeywordCpcBidMicros({ adGroupId: payload.adGroupId, criterionId: payload.criterionId });
      after_state = after;

      const ok = after.cpcBidMicros === payload.afterCpcBidMicros;
      await insertEvent({
        workspace_id: input.workspaceId,
        ad_account_id: input.adAccountId,
        proposal_id: input.proposalId,
        event_type: ok ? "execution_succeeded" : "execution_failed",
        actor_type: input.actorType,
        actor_id: input.actorId ?? null,
        run_id: input.runId ?? null,
        message: ok ? "Mutation applied" : "Mutation did not reach desired state",
        details: { outcome: ok ? "success" : "failure", before_state, mutation, after_state },
      });

      await insertEvent({
        workspace_id: input.workspaceId,
        ad_account_id: input.adAccountId,
        proposal_id: input.proposalId,
        event_type: ok ? "verification_succeeded" : "verification_failed",
        actor_type: input.actorType,
        actor_id: input.actorId ?? null,
        run_id: input.runId ?? null,
        message: ok ? "Verification succeeded" : "Verification failed",
        details: { expected: { cpc_bid_micros: payload.afterCpcBidMicros }, after_state },
      });

      if (!ok) throw new Error(`Verification failed: expected cpc_bid_micros=${payload.afterCpcBidMicros}, got ${after.cpcBidMicros}`);
    } else if (payload.kind === "increase_campaign_budget") {
      const before = await client.getCampaignBudgetAmountMicros({ campaignBudgetId: payload.campaignBudgetId });
      before_state = before;

      const mutation = await client.ensureCampaignBudgetAmountMicros({
        campaignBudgetId: payload.campaignBudgetId,
        desiredAmountMicros: payload.afterAmountMicros,
      });

      const after = await client.getCampaignBudgetAmountMicros({ campaignBudgetId: payload.campaignBudgetId });
      after_state = after;

      const ok = after.amountMicros === payload.afterAmountMicros;
      await insertEvent({
        workspace_id: input.workspaceId,
        ad_account_id: input.adAccountId,
        proposal_id: input.proposalId,
        event_type: ok ? "execution_succeeded" : "execution_failed",
        actor_type: input.actorType,
        actor_id: input.actorId ?? null,
        run_id: input.runId ?? null,
        message: ok ? "Mutation applied" : "Mutation did not reach desired state",
        details: { outcome: ok ? "success" : "failure", before_state, mutation, after_state },
      });

      await insertEvent({
        workspace_id: input.workspaceId,
        ad_account_id: input.adAccountId,
        proposal_id: input.proposalId,
        event_type: ok ? "verification_succeeded" : "verification_failed",
        actor_type: input.actorType,
        actor_id: input.actorId ?? null,
        run_id: input.runId ?? null,
        message: ok ? "Verification succeeded" : "Verification failed",
        details: { expected: { amount_micros: payload.afterAmountMicros }, after_state },
      });

      if (!ok) throw new Error(`Verification failed: expected amount_micros=${payload.afterAmountMicros}, got ${after.amountMicros}`);
    } else {
      throw new Error(`Unsupported approved_payload kind: ${(payload as any).kind}`);
    }

    // Success
    await updateProposalStatus({
      proposalId: input.proposalId,
      status: "executed",
      executedAt: new Date().toISOString(),
      lastError: null,
    });

    return { outcome: "success" as ExecutionOutcome, skipped: false };
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : "Execution failed";
    await insertEvent({
      workspace_id: input.workspaceId,
      ad_account_id: input.adAccountId,
      proposal_id: input.proposalId,
      event_type: "execution_failed",
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      run_id: input.runId ?? null,
      message: msg,
      details: { outcome: "failure" as ExecutionOutcome },
    });

    await updateProposalStatus({
      proposalId: input.proposalId,
      status: "failed",
      lastError: msg,
    });

    throw err;
  }
}

