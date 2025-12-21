# Execution Contract

> **Version: execution-kernel@v1.0 — FROZEN**
>
> See [EXECUTION_KERNEL_FREEZE.md](./EXECUTION_KERNEL_FREEZE.md) for change policy.

---

> **This is the architecture line in the sand.**
>
> A campaign is "launched" only if:
> 1. `campaign_runs` is terminal (`completed`/`partial`/`failed`)
> 2. Each intended item has a terminal `channel_outbox` row (`sent`/`called`/`posted`/`failed`/`skipped`)
> 3. Duplicates are impossible under crash/retry

---

## 1. Definitions

### campaign_run
A single execution attempt of a campaign. Created by `deploy_campaign()` with status `queued`.
- **Table**: `campaign_runs`
- **Key fields**: `id`, `campaign_id`, `tenant_id`, `workspace_id`, `status`, `channel`
- **Owner**: Created by `deploy_campaign()`, updated ONLY by edge functions

### job
A unit of work to be processed by the job queue system.
- **Table**: `job_queue`
- **Key fields**: `id`, `run_id`, `tenant_id`, `workspace_id`, `job_type`, `status`, `attempts`
- **Types**: `email_send_batch`, `voice_call_batch`, `social_post_batch`
- **Owner**: Created by `deploy_campaign()`, claimed and completed by `run-job-queue`

### outbox_item
An individual provider action record (email sent, call made, post created).
- **Table**: `channel_outbox`
- **Key fields**: `id`, `run_id`, `job_id`, `channel`, `provider`, `status`, `idempotency_key`
- **Purpose**: Deduplicate provider calls, track delivery status, enable crash recovery

---

## 2. Required Invariants

### Invariant 1: Outbox INSERT Before Provider Call
```
RULE: Every provider call MUST be preceded by an outbox INSERT with status='queued'
```

The outbox row acts as a "reservation" that prevents duplicate sends on retry:
1. INSERT outbox row with `status='queued'` and unique `idempotency_key`
2. If INSERT succeeds → proceed with provider call
3. If INSERT fails (unique violation) → SKIP provider call, mark as `skipped`
4. After provider call → UPDATE outbox with terminal status

### Invariant 2: Idempotency Key Required and Unique
```
RULE: Every outbox row MUST have a non-null idempotency_key
RULE: (tenant_id, workspace_id, idempotency_key) MUST be unique
```

Key generation patterns:
- **Email**: `sha256(run_id | lead_id | asset_id | scheduled_for)`
- **Voice**: `sha256(run_id | lead_id | script_version | scheduled_for)`
- **Social**: `sha256(run_id | post_id | channel | scheduled_for)`

### Invariant 3: Job Completes Only When All Items Terminal
```
RULE: A job is 'completed' only when ALL outbox items have terminal status
RULE: Terminal statuses: sent, called, posted, failed, skipped
```

Job completion logic:
- `completed`: All items succeeded (sent/called/posted) or were legitimately skipped
- `partial`: Some items succeeded, some failed
- `failed`: All items failed
- `dead`: Max retries exceeded with failures

### Invariant 4: Campaign Run Status From Job Outcomes
```
RULE: campaign_runs.status is computed from job outcomes
RULE: Only the edge function updates campaign_runs after initial INSERT
```

Status mapping:
- `queued` → Initial state (set by deploy_campaign)
- `running` → At least one job locked (set by run-job-queue)
- `completed` → All jobs completed successfully
- `partial` → Some jobs succeeded, some failed
- `failed` → All jobs failed or critical error

---

## 3. Status Taxonomy

### channel_outbox.status
| Status | Meaning | Terminal? |
|--------|---------|-----------|
| `queued` | Reserved, provider call pending | No |
| `sent` | Email delivered to provider | Yes |
| `called` | Voice call initiated | Yes |
| `posted` | Social post published | Yes |
| `failed` | Provider call failed | Yes |
| `skipped` | Idempotency: already processed | Yes |

### job_queue.status
| Status | Meaning |
|--------|---------|
| `queued` | Waiting to be claimed |
| `locked` | Claimed by a worker |
| `completed` | All items processed successfully |
| `failed` | Processing failed, may retry |
| `dead` | Max retries exceeded |

### campaign_runs.status
| Status | Meaning |
|--------|---------|
| `queued` | Jobs created, not yet started |
| `running` | Jobs being processed |
| `completed` | All jobs succeeded |
| `partial` | Some jobs succeeded, some failed |
| `failed` | Critical failure or all jobs failed |

---

## 4. Status Transitions

```
campaign_runs:
  queued → running → completed
                  → partial
                  → failed

job_queue:
  queued → locked → completed
                 → failed → queued (retry)
                         → dead (max retries)

channel_outbox:
  (INSERT) queued → sent/called/posted (success)
                 → failed (provider error)
                 → skipped (idempotency)
```

---

## 5. Never Do List

### ❌ NEVER: Call provider without outbox row
```typescript
// WRONG - No crash protection
const result = await sendEmail(to, subject, body);
await insertOutbox({ status: result.success ? 'sent' : 'failed' });

// RIGHT - Outbox reservation first
const outboxId = await beginOutboxItem({ ... });
const result = await sendEmail(to, subject, body);
await finalizeOutboxSuccess(outboxId, result.messageId);
```

### ❌ NEVER: Update campaign_runs directly from deploy_campaign
```sql
-- WRONG - Only edge function should set running/completed/partial/failed
UPDATE campaign_runs SET status = 'running' WHERE id = ...;
```

The `deploy_campaign()` function ONLY sets initial `queued` status. All subsequent status changes are made by `run-job-queue`.

### ❌ NEVER: Skip idempotency key generation
```typescript
// WRONG - No deduplication
await supabase.from('channel_outbox').insert({ ... }); // Missing idempotency_key

// RIGHT - Always generate deterministic key
const idempotencyKey = await generateIdempotencyKey([runId, leadId, assetId, scheduledFor]);
await beginOutboxItem({ idempotencyKey, ... });
```

### ❌ NEVER: Complete job without checking all outbox items
```typescript
// WRONG - May leave items in 'queued' state
await completeJob(jobId, true);

// RIGHT - Verify all items have terminal status
const allTerminal = await verifyAllOutboxTerminal(runId);
await completeJob(jobId, allTerminal);
```

### ❌ NEVER: Use non-deterministic idempotency keys
```typescript
// WRONG - Different key on retry = duplicate send
const key = crypto.randomUUID();

// RIGHT - Same inputs = same key = deduplication works
const key = await generateIdempotencyKey([runId, leadId, scheduledFor]);
```

---

## 6. Code Enforcement

All handlers MUST use the shared `outbox-contract` helper:

```typescript
import { beginOutboxItem, finalizeOutboxSuccess, finalizeOutboxFailure } from "./_shared/outbox-contract.ts";

// 1. Reserve outbox slot (returns outboxId or null if duplicate)
const outboxId = await beginOutboxItem({
  supabase,
  tenantId,
  workspaceId,
  runId,
  jobId,
  channel: "email",
  provider: "resend",
  recipientId: lead.id,
  recipientEmail: lead.email,
  payload: { subject, campaignId },
  idempotencyKey,
});

if (!outboxId) {
  // Idempotency: already processed, skip provider call
  skipped++;
  continue;
}

// 2. Call provider
const result = await sendEmail(...);

// 3. Finalize outbox
if (result.success) {
  await finalizeOutboxSuccess(supabase, outboxId, result.messageId, result);
} else {
  await finalizeOutboxFailure(supabase, outboxId, result.error);
}
```

Provider adapters should ONLY accept an `outboxId` parameter - this enforces that `beginOutboxItem` was called first.

---

## 7. Database Enforcement

### Constraints
```sql
-- Status must be valid
ALTER TABLE channel_outbox 
ADD CONSTRAINT channel_outbox_status_check 
CHECK (status IN ('queued', 'sent', 'called', 'posted', 'failed', 'skipped'));

-- Skipped flag must match status
ALTER TABLE channel_outbox 
ADD CONSTRAINT channel_outbox_skipped_status_check 
CHECK (skipped = false OR status = 'skipped');

-- Idempotency key required (already NOT NULL)
-- Unique constraint on (tenant_id, workspace_id, idempotency_key) (already exists)

-- Index for run detail queries
CREATE INDEX IF NOT EXISTS idx_channel_outbox_run_id ON channel_outbox(run_id);
```

---

## 8. Testing Requirements

### C1: Provider Call Requires Outbox
A handler cannot compile if it tries to call a provider adapter without first calling `beginOutboxItem` and receiving an `outboxId`.

### C2: Invalid Outbox Rejected
Database rejects:
- Invalid status values
- `skipped=true` with status != 'skipped'
- Missing `idempotency_key`
- Duplicate `idempotency_key` per tenant/workspace

---

## 9. Recovery Scenarios

### Crash After Outbox INSERT, Before Provider Call
- Outbox row exists with `status='queued'`
- On retry: new INSERT conflicts → skip (correct behavior)
- Manual resolution: Check provider logs, update outbox if action was taken

### Crash After Provider Call, Before Outbox UPDATE
- Outbox row exists with `status='queued'`, but provider action was taken
- On retry: new INSERT conflicts → skip (correct behavior)
- The original outbox row remains `queued` - requires manual verification

### Stale Lock Recovery
- Job remains `locked` > 5 minutes
- `claim_queued_jobs` resets to `queued` with `attempts++`
- Outbox idempotency prevents duplicate provider actions

---

## 10. Audit Trail

Every execution is fully traceable via:
1. `campaign_runs` - High-level run status
2. `job_queue` - Job processing details
3. `channel_outbox` - Per-item provider results
4. `campaign_audit_log` - Detailed event history

Query pattern:
```sql
-- Full execution trace
SELECT 
  cr.id as run_id, cr.status as run_status,
  jq.id as job_id, jq.status as job_status, jq.attempts,
  co.id as outbox_id, co.status as outbox_status, co.provider_message_id
FROM campaign_runs cr
JOIN job_queue jq ON jq.run_id = cr.id
LEFT JOIN channel_outbox co ON co.run_id = cr.id
WHERE cr.campaign_id = 'CAMPAIGN_UUID'
ORDER BY cr.created_at DESC, jq.created_at, co.created_at;
```
