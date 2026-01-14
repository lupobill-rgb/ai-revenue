-- ============================================================
-- Step 2: Enforce per-tenant/workspace caps for fairness
-- FAIR1: max_jobs_per_tenant = 25
-- FAIR2: max_jobs_per_tick = 200 (global cap)
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_queued_jobs(
  p_worker_id text,
  p_limit integer DEFAULT 200  -- Global cap: 200 jobs per tick
)
RETURNS SETOF job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_max_per_tenant integer := 25; -- FAIR1: No tenant can consume >25 jobs per tick
  v_now timestamptz := now();
  v_lock_timeout interval := interval '5 minutes'; -- Stale lock recovery
BEGIN
  -- Reset stale locks (jobs locked > 5 minutes are considered abandoned)
  UPDATE job_queue
  SET status = 'queued',
      locked_at = NULL,
      locked_by = NULL,
      attempts = attempts + 1,
      updated_at = v_now
  WHERE status = 'locked'
    AND locked_at < v_now - v_lock_timeout;

  -- Claim jobs with FOR UPDATE SKIP LOCKED for concurrent safety
  -- Use fair distribution: limit per tenant to prevent noisy neighbors
  -- FAIR1: Each tenant gets max 25 jobs per tick
  -- FAIR2: Multiple tenants progress each minute via round-robin ranking
  RETURN QUERY
  WITH ranked_jobs AS (
    SELECT j.*,
           ROW_NUMBER() OVER (PARTITION BY j.tenant_id ORDER BY j.scheduled_for, j.created_at) as tenant_rank
    FROM job_queue j
    WHERE j.status = 'queued'
      AND j.scheduled_for <= v_now
      AND j.attempts < 3 -- Max 3 attempts before dead
    ORDER BY j.scheduled_for, j.created_at
    FOR UPDATE SKIP LOCKED
  )
  UPDATE job_queue jq
  SET status = 'locked',
      locked_at = v_now,
      locked_by = p_worker_id,
      updated_at = v_now
  FROM (
    SELECT id FROM ranked_jobs 
    WHERE tenant_rank <= v_max_per_tenant  -- FAIR1: Cap at 25 per tenant
    ORDER BY tenant_rank, scheduled_for    -- FAIR2: Interleave tenants
    LIMIT p_limit                          -- Global cap: 200
  ) claimed
  WHERE jq.id = claimed.id
  RETURNING jq.*;
END;
$$;
-- Add comment for documentation
COMMENT ON FUNCTION public.claim_queued_jobs IS 
'Atomically claims queued jobs for a worker using FOR UPDATE SKIP LOCKED.
Fairness guarantees:
- FAIR1: No single tenant can consume >25 jobs per tick (v_max_per_tenant)
- FAIR2: Multiple tenants progress each minute via interleaved ordering
- Global cap: 200 jobs per tick (p_limit default)
Sets locked_by to worker_id for WID1 traceability.';
