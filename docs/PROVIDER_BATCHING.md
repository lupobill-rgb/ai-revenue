# Provider Batching Optimization

## Overview

Phase B implements provider-level batching to reduce cost and latency while preserving per-item evidence in the outbox.

## Core Principles

1. **Batch at the provider boundary, not at the job boundary**
   - Jobs still process leads one at a time logically
   - Provider calls are batched for transport efficiency
   
2. **One outbox row per item remains sacred**
   - Every recipient gets their own outbox entry
   - No batch-level outbox entries
   
3. **Batch calls only optimize transport, not semantics**
   - Each item is still tracked individually
   - Partial failures are handled per-item

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Job Processor                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Phase 1: Outbox Reservations                        │  │
│  │  - Insert outbox row for each recipient              │  │
│  │  - Get outboxId for each                             │  │
│  │  - Handle idempotency (skip duplicates)              │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│                            ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Phase 2: Batch Builder                              │  │
│  │  - Group items by (provider, channel, tenant)        │  │
│  │  - Split into provider-optimal batch sizes           │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│                            ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Phase 3: Provider Batch Call                        │  │
│  │  - Send batch to provider API                        │  │
│  │  - e.g., Resend /emails/batch endpoint               │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│                            ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Phase 4: Response Fan-out                           │  │
│  │  - Map provider responses to individual outbox rows  │  │
│  │  - Mark each item success/failure independently      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Batch Builders

```typescript
import { BatchBuilder, BatchKey, BatchItem } from "../_shared/provider-batching.ts";

const builder = new BatchBuilder();

for (const lead of leads) {
  const outboxResult = await beginOutboxItem({...});
  
  if (outboxResult.outboxId) {
    builder.add(
      { provider: "resend", channel: "email", tenantId, workspaceId },
      { outboxId: outboxResult.outboxId, recipientEmail: lead.email, ... }
    );
  }
}

const batches = builder.getBatches(100); // Max 100 per batch
```

### 2. Provider Adapters

**Email (Resend Batch API)**
```typescript
import { sendEmailBatch, EmailBatchItem, EmailBatchConfig } from "../_shared/provider-batching.ts";

const batchItems: EmailBatchItem[] = items.map(item => ({
  outboxId: item.outboxId,
  to: item.recipientEmail,
  subject: personalizedSubject,
  html: personalizedBody,
}));

const response = await sendEmailBatch(resendApiKey, batchItems, {
  from: `${senderName} <${fromAddress}>`,
  replyTo: replyToAddress,
});
```

**Voice (Concurrent with Rate Limiting)**
```typescript
import { sendVoiceBatchConcurrent, VoiceBatchItem } from "../_shared/provider-batching.ts";

const response = await sendVoiceBatchConcurrent(
  vapiPrivateKey,
  assistantId,
  phoneNumberId,
  voiceItems,
  5 // concurrency limit
);
```

### 3. Response Fan-out

```typescript
import { fanOutBatchResults } from "../_shared/provider-batching.ts";

const { succeeded, failed } = await fanOutBatchResults(
  supabase,
  batchItems,
  batchResponse,
  "sent" // terminal status
);
```

### 4. Partial Failure Handling

The system handles partial failures gracefully:

- Each item in a batch is tracked independently
- If provider returns per-item errors, only those items are marked failed
- If entire batch fails, all items are marked failed
- Batch success ≠ item success

```typescript
interface BulkProviderResponse {
  success: boolean;           // All items succeeded
  partialFailure: boolean;    // Some succeeded, some failed
  results: Map<string, ProviderItemResult>;
  totalSent: number;
  totalFailed: number;
}
```

## Provider-Specific Batch Sizes

| Provider | Channel | Max Batch Size | Notes |
|----------|---------|----------------|-------|
| Resend | Email | 100 | Native batch API |
| Gmail | Email | 50 | Rate limited |
| SMTP | Email | 10 | Connection pooling |
| VAPI | Voice | 5 (concurrent) | API rate limits |
| ElevenLabs | Voice | 1 | No batching |

## Pass/No-Pass Criteria

### PB1: Batch of N sends → N outbox rows terminalized correctly
- Each item in batch has corresponding outbox row
- All rows updated with correct terminal status
- Provider message IDs recorded per-item

### PB2: Partial provider failure → only failed items marked failed
- Individual failures don't affect successful items
- Error messages recorded per-item
- Successful items still marked as sent

### PB3: No duplicates under retry/crash
- Idempotency keys prevent duplicate provider calls
- Outbox reservation created before batch call
- Crash recovery re-tries only pending items

## Observability

Batch metrics are logged to `campaign_audit_log`:

```json
{
  "event_type": "batch_completed",
  "details": {
    "channel": "email",
    "provider": "resend",
    "batch_size": 100,
    "sent": 98,
    "failed": 2,
    "skipped": 0,
    "duration_ms": 1234,
    "avg_item_duration_ms": 12.34
  }
}
```

## Migration Path

1. **Current**: Each email sent individually via `fetch()`
2. **Phase B**: Batch emails via Resend `/emails/batch` endpoint
3. **Result**: ~10x reduction in API calls, lower latency

## Cost Savings

| Metric | Before (Individual) | After (Batched) |
|--------|---------------------|-----------------|
| API calls for 1000 emails | 1000 | 10 |
| Avg latency per email | ~200ms | ~20ms |
| Connection overhead | 1000 connections | 10 connections |

## Testing

```typescript
// Test: PB1 - All items terminalized
const result = await processEmailBatchOptimized({
  leads: [lead1, lead2, lead3],
  // ...
});
assert(result.sent + result.failed + result.skipped === 3);

// Verify outbox rows
const { data: outbox } = await supabase
  .from("channel_outbox")
  .select("status")
  .eq("run_id", runId);
assert(outbox.every(row => ["sent", "failed", "skipped"].includes(row.status)));

// Test: PB2 - Partial failure handling
// Mock Resend to fail for lead2 only
const result = await processEmailBatchOptimized({...});
assert(result.partial === true);
assert(result.sent === 2);
assert(result.failed === 1);

// Test: PB3 - No duplicates on retry
const result1 = await processEmailBatchOptimized({...});
const result2 = await processEmailBatchOptimized({...}); // Same run_id
assert(result2.skipped === 3); // All skipped as duplicates
```
