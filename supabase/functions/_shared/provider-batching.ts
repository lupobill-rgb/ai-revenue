/**
 * Provider Batching Optimization
 * 
 * Batch at the provider boundary, not at the job boundary.
 * One outbox row per item remains sacred.
 * Batch calls only optimize transport, not semantics.
 * 
 * @see /docs/PROVIDER_BATCHING.md for architecture
 */

import {
  generateIdempotencyKey,
  beginOutboxItem,
  finalizeOutboxSuccess,
  finalizeOutboxFailure,
  type Channel,
  type Provider,
  type TerminalStatus,
} from "./outbox-contract.ts";

// ============= Types =============

/**
 * Batch group key: (provider, channel, tenant_id, workspace_id)
 */
export interface BatchKey {
  provider: Provider;
  channel: Channel;
  tenantId: string;
  workspaceId: string;
}

/**
 * Item in a batch ready for provider call
 */
export interface BatchItem {
  outboxId: string;
  recipientId: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

/**
 * Result from provider for a single item
 */
export interface ProviderItemResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerResponse?: Record<string, unknown>;
}

/**
 * Bulk provider response with per-item results
 */
export interface BulkProviderResponse {
  success: boolean;
  results: Map<string, ProviderItemResult>; // keyed by recipientEmail or recipientPhone
  partialFailure: boolean;
  totalSent: number;
  totalFailed: number;
}

/**
 * Configuration for a batch
 */
export interface BatchConfig {
  maxBatchSize: number;
  channel: Channel;
  provider: Provider;
  terminalStatus: TerminalStatus;
}

// ============= Batch Builder =============

/**
 * Collects outbox items into batches by (provider, channel, credentials, tenant)
 */
export class BatchBuilder {
  private batches: Map<string, BatchItem[]> = new Map();
  private batchKeys: Map<string, BatchKey> = new Map();

  /**
   * Generate a batch key string from components
   */
  private static makeBatchKeyString(key: BatchKey): string {
    return `${key.provider}|${key.channel}|${key.tenantId}|${key.workspaceId}`;
  }

  /**
   * Add an item to the appropriate batch
   */
  add(key: BatchKey, item: BatchItem): void {
    const keyStr = BatchBuilder.makeBatchKeyString(key);
    
    if (!this.batches.has(keyStr)) {
      this.batches.set(keyStr, []);
      this.batchKeys.set(keyStr, key);
    }
    
    this.batches.get(keyStr)!.push(item);
  }

  /**
   * Get all batches, optionally splitting by max size
   */
  getBatches(maxBatchSize: number = 100): Array<{ key: BatchKey; items: BatchItem[] }> {
    const result: Array<{ key: BatchKey; items: BatchItem[] }> = [];
    
    for (const [keyStr, items] of this.batches.entries()) {
      const key = this.batchKeys.get(keyStr)!;
      
      // Split into chunks of maxBatchSize
      for (let i = 0; i < items.length; i += maxBatchSize) {
        result.push({
          key,
          items: items.slice(i, i + maxBatchSize),
        });
      }
    }
    
    return result;
  }

  /**
   * Get total item count across all batches
   */
  getTotalCount(): number {
    let total = 0;
    for (const items of this.batches.values()) {
      total += items.length;
    }
    return total;
  }

  /**
   * Clear all batches
   */
  clear(): void {
    this.batches.clear();
    this.batchKeys.clear();
  }
}

// ============= Email Batch Provider =============

export interface EmailBatchItem {
  outboxId: string;
  to: string;
  subject: string;
  html: string;
  recipientId?: string | null;
}

export interface EmailBatchConfig {
  from: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

/**
 * Send emails in batch using Resend's batch API
 * @see https://resend.com/docs/api-reference/emails/send-batch-emails
 */
export async function sendEmailBatch(
  resendApiKey: string,
  items: EmailBatchItem[],
  config: EmailBatchConfig
): Promise<BulkProviderResponse> {
  const results = new Map<string, ProviderItemResult>();
  let totalSent = 0;
  let totalFailed = 0;

  // Resend supports up to 100 emails per batch
  const MAX_RESEND_BATCH = 100;

  try {
    // Split into sub-batches if needed
    for (let i = 0; i < items.length; i += MAX_RESEND_BATCH) {
      const batch = items.slice(i, i + MAX_RESEND_BATCH);
      
      // Build batch payload for Resend
      const batchPayload = batch.map(item => ({
        from: config.from,
        reply_to: config.replyTo,
        to: [item.to],
        subject: item.subject,
        html: item.html,
        tags: config.tags,
      }));

      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batchPayload),
      });

      const data = await res.json();

      if (!res.ok) {
        // Entire batch failed - mark all items as failed
        const errorMsg = data.message || `Resend batch error: ${res.status}`;
        for (const item of batch) {
          results.set(item.to, {
            success: false,
            error: errorMsg,
          });
          totalFailed++;
        }
        console.error(`[email-batch] Batch failed: ${errorMsg}`);
        continue;
      }

      // Resend returns array of { id } objects in same order as input
      const responseData = Array.isArray(data) ? data : (data.data || []);
      
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const response = responseData[j];
        
        if (response?.id) {
          results.set(item.to, {
            success: true,
            messageId: response.id,
            providerResponse: response,
          });
          totalSent++;
        } else if (response?.error) {
          // Individual item failed within batch
          results.set(item.to, {
            success: false,
            error: response.error?.message || "Unknown error",
          });
          totalFailed++;
        } else {
          // Assume success if id is present
          results.set(item.to, {
            success: !!response?.id,
            messageId: response?.id,
            error: response?.error?.message,
          });
          if (response?.id) totalSent++;
          else totalFailed++;
        }
      }
    }

    return {
      success: totalFailed === 0,
      results,
      partialFailure: totalSent > 0 && totalFailed > 0,
      totalSent,
      totalFailed,
    };
  } catch (err) {
    // Complete failure - mark all as failed
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    for (const item of items) {
      results.set(item.to, {
        success: false,
        error: errorMsg,
      });
    }
    
    return {
      success: false,
      results,
      partialFailure: false,
      totalSent: 0,
      totalFailed: items.length,
    };
  }
}

// ============= Response Fan-out =============

/**
 * Fan out batch provider response to individual outbox rows
 * Maps provider responses back to individual outbox rows
 * Handles partial failures correctly
 */
export async function fanOutBatchResults(
  supabase: any,
  items: EmailBatchItem[],
  response: BulkProviderResponse,
  terminalStatus: TerminalStatus = "sent"
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;

  const updatePromises = items.map(async (item) => {
    const result = response.results.get(item.to);
    
    if (!result) {
      // No result for this item - treat as failure
      await finalizeOutboxFailure(supabase, item.outboxId, "No response from provider for this item");
      failed++;
      return;
    }

    if (result.success) {
      await finalizeOutboxSuccess(
        supabase,
        item.outboxId,
        result.messageId || null,
        result.providerResponse,
        terminalStatus
      );
      succeeded++;
    } else {
      await finalizeOutboxFailure(supabase, item.outboxId, result.error || "Unknown error");
      failed++;
    }
  });

  await Promise.all(updatePromises);

  return { succeeded, failed };
}

// ============= Batch Email Processor =============

export interface BatchEmailProcessorParams {
  supabase: any;
  tenantId: string;
  workspaceId: string;
  runId: string;
  jobId: string;
  leads: Array<{
    id: string;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
  }>;
  subject: string;
  htmlTemplate: string;
  emailConfig: EmailBatchConfig;
  resendApiKey: string;
  assetId?: string;
  scheduledFor?: string;
}

export interface BatchProcessResult {
  success: boolean;
  partial: boolean;
  sent: number;
  failed: number;
  skipped: number;
  error?: string;
}

/**
 * Process email batch with outbox-first pattern
 * 1. Insert all outbox rows (get outboxIds)
 * 2. Batch send via provider
 * 3. Fan out responses to individual outbox rows
 */
export async function processEmailBatchOptimized(
  params: BatchEmailProcessorParams
): Promise<BatchProcessResult> {
  const {
    supabase,
    tenantId,
    workspaceId,
    runId,
    jobId,
    leads,
    subject,
    htmlTemplate,
    emailConfig,
    resendApiKey,
    assetId = "unknown",
    scheduledFor = new Date().toISOString(),
  } = params;

  const batchItems: EmailBatchItem[] = [];
  let skipped = 0;
  let earlyFailed = 0;

  // Phase 1: Insert all outbox rows (reservations)
  console.log(`[batch-email] Phase 1: Inserting ${leads.length} outbox reservations`);
  
  for (const lead of leads) {
    if (!lead.email) continue;

    const idempotencyKey = await generateIdempotencyKey([
      runId,
      lead.id,
      assetId,
      scheduledFor,
    ]);

    const outboxResult = await beginOutboxItem({
      supabase,
      tenantId,
      workspaceId,
      runId,
      jobId,
      channel: "email" as Channel,
      provider: "resend" as Provider,
      recipientId: lead.id,
      recipientEmail: lead.email,
      payload: { subject, asset_id: assetId },
      idempotencyKey,
    });

    if (outboxResult.skipped) {
      skipped++;
      continue;
    }

    if (!outboxResult.outboxId) {
      console.error(`[batch-email] Failed to create outbox for ${lead.email}:`, outboxResult.error);
      earlyFailed++;
      continue;
    }

    // Personalize content
    const personalizedHtml = htmlTemplate
      .replace(/\{\{first_name\}\}/g, lead.first_name || "there")
      .replace(/\{\{last_name\}\}/g, lead.last_name || "");
    
    const personalizedSubject = subject
      .replace(/\{\{first_name\}\}/g, lead.first_name || "there")
      .replace(/\{\{last_name\}\}/g, lead.last_name || "");

    batchItems.push({
      outboxId: outboxResult.outboxId,
      to: lead.email,
      subject: personalizedSubject,
      html: personalizedHtml,
      recipientId: lead.id,
    });
  }

  // Phase 2: Batch send to provider
  console.log(`[batch-email] Phase 2: Sending batch of ${batchItems.length} emails`);
  
  if (batchItems.length === 0) {
    return {
      success: skipped > 0 || earlyFailed === 0,
      partial: false,
      sent: 0,
      failed: earlyFailed,
      skipped,
      error: earlyFailed > 0 ? "Failed to create outbox entries" : undefined,
    };
  }

  const batchResponse = await sendEmailBatch(resendApiKey, batchItems, emailConfig);

  // Phase 3: Fan out responses to outbox rows
  console.log(`[batch-email] Phase 3: Fanning out ${batchItems.length} results`);
  
  const fanOutResult = await fanOutBatchResults(supabase, batchItems, batchResponse, "sent");

  const totalFailed = earlyFailed + fanOutResult.failed;
  const totalSent = fanOutResult.succeeded;

  console.log(`[batch-email] Complete: sent=${totalSent}, failed=${totalFailed}, skipped=${skipped}`);

  return {
    success: totalFailed === 0,
    partial: totalSent > 0 && totalFailed > 0,
    sent: totalSent,
    failed: totalFailed,
    skipped,
  };
}

// ============= Voice Batch Types =============

export interface VoiceBatchItem {
  outboxId: string;
  phoneNumber: string;
  customerName?: string;
  recipientId?: string | null;
}

/**
 * ElevenLabs doesn't support true batching, so we use concurrent calls
 * with proper rate limiting.
 */
export async function sendVoiceBatchConcurrent(
  elevenLabsApiKey: string,
  agentId: string,
  items: VoiceBatchItem[],
  concurrency: number = 5
): Promise<BulkProviderResponse> {
  const results = new Map<string, ProviderItemResult>();
  let totalCalled = 0;
  let totalFailed = 0;

  // Process in chunks of `concurrency`
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    
    const promises = chunk.map(async (item) => {
      try {
        const res = await fetch("https://api.elevenlabs.io/v1/convai/conversations/phone", {
          method: "POST",
          headers: {
            "xi-api-key": elevenLabsApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id: agentId,
            to_phone_number: item.phoneNumber,
            metadata: {
              customer_name: item.customerName,
              recipient_id: item.recipientId,
              outbox_id: item.outboxId,
            },
          }),
        });

        const data = await res.json();
        
        if (!res.ok) {
          results.set(item.phoneNumber, {
            success: false,
            error: data?.detail?.message || data?.message || `ElevenLabs error: ${res.status}`,
          });
          totalFailed++;
        } else {
          results.set(item.phoneNumber, {
            success: true,
            messageId: data.conversation_id || data.id,
            providerResponse: data,
          });
          totalCalled++;
        }
      } catch (err) {
        results.set(item.phoneNumber, {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
        totalFailed++;
      }
    });

    await Promise.all(promises);
  }

  return {
    success: totalFailed === 0,
    results,
    partialFailure: totalCalled > 0 && totalFailed > 0,
    totalSent: totalCalled,
    totalFailed,
  };
}

// ============= Metrics =============

export interface BatchMetrics {
  channel: Channel;
  provider: Provider;
  batchSize: number;
  sent: number;
  failed: number;
  skipped: number;
  durationMs: number;
  avgItemDurationMs: number;
}

/**
 * Log batch metrics for observability
 */
export async function logBatchMetrics(
  supabase: any,
  tenantId: string,
  workspaceId: string,
  runId: string,
  jobId: string,
  metrics: BatchMetrics
): Promise<void> {
  try {
    await supabase.from("campaign_audit_log").insert({
      tenant_id: tenantId,
      workspace_id: workspaceId,
      run_id: runId,
      job_id: jobId,
      event_type: "batch_completed",
      actor_type: "system",
      details: {
        channel: metrics.channel,
        provider: metrics.provider,
        batch_size: metrics.batchSize,
        sent: metrics.sent,
        failed: metrics.failed,
        skipped: metrics.skipped,
        duration_ms: metrics.durationMs,
        avg_item_duration_ms: metrics.avgItemDurationMs,
      },
    } as never);
  } catch (err) {
    console.error("[batch-metrics] Failed to log metrics:", err);
  }
}
