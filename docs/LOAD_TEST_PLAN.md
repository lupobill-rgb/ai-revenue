# Load Test Plan — Horizontal Scaling Validation

## Objective

Validate horizontal scaling with real constraints before production deployment.

## Test Configuration

| Parameter | Value |
|-----------|-------|
| Total jobs | 1,000 |
| Tenants | 10 |
| Jobs per tenant | 100 |
| Worker counts | N=1, then N=4 |

## Test Execution

### 1. Seed Test Data

```sql
-- Queue 1,000 jobs across 10 tenants
SELECT seed_load_test_jobs(1000, 10);
```

### 2. Run with N=1 Worker

```sql
-- Temporarily disable parallel workers
SELECT cron.unschedule('run-job-queue-parallel');

-- Use single worker cron
SELECT cron.schedule(
  'run-job-queue-single',
  '* * * * *',
  $$ SELECT public.run_job_queue_cron() $$
);

-- Wait for queue to drain, then check metrics
SELECT get_load_test_metrics();
```

### 3. Clear and Re-seed

```sql
SELECT clear_load_test_data();
SELECT seed_load_test_jobs(1000, 10);
```

### 4. Run with N=4 Workers

```sql
-- Re-enable parallel workers
SELECT cron.unschedule('run-job-queue-single');

SELECT cron.schedule(
  'run-job-queue-parallel',
  '* * * * *',
  $$ SELECT public.run_job_queue_parallel() $$
);

-- Wait for queue to drain, then check metrics
SELECT get_load_test_metrics();
```

### 5. Cleanup

```sql
SELECT clear_load_test_data();
```

## Pass/No-Pass Criteria

### LOAD1: Throughput Improvement
**Measure**: Time to drain queue (N=1 vs N=4)

| Workers | Expected Drain Time | Threshold |
|---------|---------------------|-----------|
| N=1 | ~20 minutes | Baseline |
| N=4 | ~5-7 minutes | ≤40% of N=1 |

**Pass**: N=4 drain time is materially faster than N=1

### LOAD2: Zero Duplicates
**Query**:
```sql
SELECT COUNT(*) FROM (
  SELECT idempotency_key, COUNT(*) 
  FROM channel_outbox 
  WHERE created_at > now() - interval '1 hour'
  GROUP BY idempotency_key 
  HAVING COUNT(*) > 1
) dups;
```

**Pass**: Result = 0

### LOAD3: Queue Age Threshold
**Query**:
```sql
SELECT EXTRACT(EPOCH FROM (now() - MIN(created_at)))::integer as oldest_age_seconds
FROM job_queue
WHERE status = 'queued';
```

**Pass**: `oldest_age_seconds` < 180 (3 minutes) during steady state

## Metrics Collection

Run this periodically during the test:

```sql
SELECT get_load_test_metrics();
```

Returns:
```json
{
  "queue_stats": { "queued": 850, "locked": 40, "completed": 110, ... },
  "oldest_queued_age_seconds": 45,
  "duplicate_count": 0,
  "worker_stats": { "worker_count": 4, "total_jobs_claimed": 200, ... },
  "tenant_distribution": { "tenant-1": 25, "tenant-2": 25, ... },
  "pass_criteria": {
    "LOAD2_duplicates_zero": true,
    "LOAD3_oldest_under_180s": true
  }
}
```

## Fairness Verification

Check that no single tenant consumed more than 25 jobs per tick:

```sql
SELECT 
  tenant_id,
  COUNT(*) as jobs_completed,
  MIN(updated_at) as first_completed,
  MAX(updated_at) as last_completed
FROM job_queue
WHERE status = 'completed'
  AND created_at > now() - interval '1 hour'
GROUP BY tenant_id
ORDER BY jobs_completed DESC;
```

**Pass**: All tenants make progress (no starvation)

## Troubleshooting

### Queue not draining
1. Check worker logs: `SELECT * FROM campaign_audit_log WHERE event_type = 'job_queue_tick' ORDER BY created_at DESC LIMIT 10;`
2. Check for stuck jobs: `SELECT * FROM job_queue WHERE status = 'locked' AND locked_at < now() - interval '5 minutes';`

### Duplicates detected
1. Identify duplicates: `SELECT idempotency_key, COUNT(*) FROM channel_outbox GROUP BY idempotency_key HAVING COUNT(*) > 1;`
2. Check if idempotency key generation is deterministic

### Tenant starvation
1. Check tenant distribution: `SELECT tenant_id, COUNT(*) FROM job_queue WHERE status = 'completed' GROUP BY tenant_id;`
2. Verify per-tenant cap is enforced in `claim_queued_jobs`
