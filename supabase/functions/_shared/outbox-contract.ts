/**
 * Outbox Contract Helper
 * 
 * Enforces the Execution Contract for campaign launches:
 * 1. Outbox INSERT before provider call
 * 2. Idempotency key required and unique
 * 3. Terminal status tracking
 * 
 * @see /docs/EXECUTION_CONTRACT.md
 */

// Terminal statuses that indicate action was completed
export const TERMINAL_STATUSES = ["sent", "called", "posted", "failed", "skipped"] as const;
export type TerminalStatus = typeof TERMINAL_STATUSES[number];

// Valid outbox statuses
export const VALID_STATUSES = ["queued", "sent", "called", "posted", "failed", "skipped", "generated", "pending_review"] as const;
export type OutboxStatus = typeof VALID_STATUSES[number];

// Channels
export type Channel = "email" | "voice" | "social";

// Provider types
export type Provider = "resend" | "gmail" | "smtp" | "elevenlabs" | "internal" | string;

/**
 * Parameters for beginning an outbox item
 */
export interface BeginOutboxParams {
  supabase: any;
  tenantId: string;
  runId: string;
  jobId: string;
  channel: Channel;
  provider: Provider;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  recipientId?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
}

/**
 * Result from beginOutboxItem
 */
export interface BeginOutboxResult {
  outboxId: string | null;
  skipped: boolean;
  error?: string;
}

/**
 * Generate idempotency key using SHA-256
 * Deterministic: same inputs = same key = deduplication works
 */
export async function generateIdempotencyKey(parts: (string | null | undefined)[]): Promise<string> {
  const data = parts.filter(Boolean).join("|");
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Begin an outbox item - MUST be called before any provider call
 * 
 * This creates a "reservation" in the outbox table. If the insert succeeds,
 * you get an outboxId and should proceed with the provider call.
 * If the insert fails due to unique constraint, the item was already processed.
 * 
 * @returns outboxId if insert succeeded, null if idempotent skip
 */
export async function beginOutboxItem(params: BeginOutboxParams): Promise<BeginOutboxResult> {
  const {
    supabase,
    tenantId,
    runId,
    jobId,
    channel,
    provider,
    idempotencyKey,
    payload,
    recipientId,
    recipientEmail,
    recipientPhone,
  } = params;

  // Validate idempotency key is provided
  if (!idempotencyKey) {
    throw new Error("EXECUTION_CONTRACT_VIOLATION: idempotencyKey is required");
  }

  const insertData: Record<string, unknown> = {
    tenant_id: tenantId,
    run_id: runId,
    job_id: jobId,
    channel,
    provider,
    payload,
    status: "queued",
    idempotency_key: idempotencyKey,
    skipped: false,
  };

  // Add optional recipient fields
  if (recipientId) insertData.recipient_id = recipientId;
  if (recipientEmail) insertData.recipient_email = recipientEmail;
  if (recipientPhone) insertData.recipient_phone = recipientPhone;

  const { data: insertedOutbox, error: insertError } = await supabase
    .from("channel_outbox")
    .insert(insertData as never)
    .select("id")
    .single();

  // If insert failed due to unique constraint (idempotent replay), skip provider call
  if (insertError) {
    if (insertError.code === "23505") { // Unique violation
      console.log(`[outbox-contract] Idempotent skip for ${channel} - already in outbox (key: ${idempotencyKey.substring(0, 16)}...)`);
      
      // Update the existing entry to mark as skipped replay
      await supabase
        .from("channel_outbox")
        .update({ skipped: true, skip_reason: "idempotent_replay", status: "skipped" } as never)
        .eq("tenant_id", tenantId)
        .eq("idempotency_key", idempotencyKey);

      return { outboxId: null, skipped: true };
    }

    // Other insert error
    console.error(`[outbox-contract] Failed to insert outbox:`, insertError);
    return { outboxId: null, skipped: false, error: insertError.message };
  }

  return { outboxId: insertedOutbox?.id, skipped: false };
}

/**
 * Finalize outbox item on success
 * 
 * MUST be called after successful provider call to update the outbox
 * with the provider response.
 */
export async function finalizeOutboxSuccess(
  supabase: any,
  outboxId: string,
  providerMessageId: string | null,
  providerResponse?: Record<string, unknown>,
  terminalStatus?: TerminalStatus
): Promise<void> {
  if (!outboxId) {
    throw new Error("EXECUTION_CONTRACT_VIOLATION: outboxId is required for finalizeOutboxSuccess");
  }

  // Determine status based on what was provided or default to 'sent'
  const status = terminalStatus || "sent";

  const updateData: Record<string, unknown> = {
    status,
    provider_message_id: providerMessageId,
  };

  if (providerResponse) {
    updateData.provider_response = providerResponse;
  }

  await supabase
    .from("channel_outbox")
    .update(updateData as never)
    .eq("id", outboxId);
}

/**
 * Finalize outbox item on failure
 * 
 * MUST be called after failed provider call to update the outbox
 * with the error details.
 */
export async function finalizeOutboxFailure(
  supabase: any,
  outboxId: string,
  error: string
): Promise<void> {
  if (!outboxId) {
    throw new Error("EXECUTION_CONTRACT_VIOLATION: outboxId is required for finalizeOutboxFailure");
  }

  await supabase
    .from("channel_outbox")
    .update({
      status: "failed",
      error,
    } as never)
    .eq("id", outboxId);
}

/**
 * Verify all outbox items for a run have terminal status
 * Used to determine if a job can be marked as completed
 */
export async function verifyAllOutboxTerminal(
  supabase: any,
  runId: string
): Promise<{ allTerminal: boolean; counts: { terminal: number; pending: number } }> {
  const { data: items, error } = await supabase
    .from("channel_outbox")
    .select("status")
    .eq("run_id", runId);

  if (error || !items) {
    console.error("[outbox-contract] Failed to verify outbox items:", error);
    return { allTerminal: false, counts: { terminal: 0, pending: 0 } };
  }

  const terminal = items.filter((i: { status: string }) => 
    TERMINAL_STATUSES.includes(i.status as TerminalStatus)
  ).length;
  const pending = items.length - terminal;

  return {
    allTerminal: pending === 0,
    counts: { terminal, pending }
  };
}

/**
 * Get outbox summary for a run
 * Returns counts by status for run completion logic
 */
export async function getOutboxSummary(
  supabase: any,
  runId: string
): Promise<{
  total: number;
  sent: number;
  called: number;
  posted: number;
  failed: number;
  skipped: number;
  pending: number;
}> {
  const { data: items, error } = await supabase
    .from("channel_outbox")
    .select("status")
    .eq("run_id", runId);

  if (error || !items) {
    console.error("[outbox-contract] Failed to get outbox summary:", error);
    return { total: 0, sent: 0, called: 0, posted: 0, failed: 0, skipped: 0, pending: 0 };
  }

  const counts = {
    total: items.length,
    sent: 0,
    called: 0,
    posted: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
  };

  for (const item of items as { status: string }[]) {
    switch (item.status) {
      case "sent": counts.sent++; break;
      case "called": counts.called++; break;
      case "posted": counts.posted++; break;
      case "failed": counts.failed++; break;
      case "skipped": counts.skipped++; break;
      case "queued": counts.pending++; break;
      default: 
        // generated, pending_review are considered non-terminal for strict mode
        if (!TERMINAL_STATUSES.includes(item.status as TerminalStatus)) {
          counts.pending++;
        }
    }
  }

  return counts;
}

/**
 * Create a provider adapter wrapper that enforces outbox-first pattern
 * Provider adapters created with this REQUIRE an outboxId, enforcing the contract
 */
export function createProviderAdapter<TParams, TResult extends { success: boolean; messageId?: string; error?: string }>(
  providerFn: (params: TParams) => Promise<TResult>
): (outboxId: string, params: TParams) => Promise<TResult> {
  return async (outboxId: string, params: TParams): Promise<TResult> => {
    // Compile-time enforcement: outboxId is required
    if (!outboxId) {
      throw new Error("EXECUTION_CONTRACT_VIOLATION: Provider adapter called without outboxId - call beginOutboxItem first");
    }
    
    return providerFn(params);
  };
}
