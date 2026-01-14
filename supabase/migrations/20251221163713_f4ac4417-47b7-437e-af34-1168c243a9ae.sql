-- Fix claim_queued_jobs: PostgreSQL doesn't allow FOR UPDATE with window functions
-- Solution: Use a two-step approach - first select candidates, then lock them

CREATE OR REPLACE FUNCTION public.claim_queued_jobs(p_worker_id text, p_limit integer DEFAULT 200)
RETURNS SETOF job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Two-step claim: first identify candidates, then lock them
  -- Step 1: Select candidate job IDs (no FOR UPDATE here since we use window functions)
  -- Step 2: Lock only those specific IDs with FOR UPDATE SKIP LOCKED
  RETURN QUERY
  WITH candidate_ids AS (
    -- First get job IDs with fair ranking (no locking here)
    SELECT j.id,
           ROW_NUMBER() OVER (PARTITION BY j.tenant_id ORDER BY j.scheduled_for, j.created_at) as tenant_rank
    FROM job_queue j
    WHERE j.status = 'queued'
      AND j.scheduled_for <= v_now
      AND j.attempts < 3 -- Max 3 attempts before dead
  ),
  fair_candidates AS (
    -- Apply fairness limits
    SELECT id 
    FROM candidate_ids 
    WHERE tenant_rank <= v_max_per_tenant
    LIMIT p_limit
  ),
  locked_jobs AS (
    -- Lock the specific jobs - FOR UPDATE SKIP LOCKED is valid here (no window functions)
    SELECT jq.id
    FROM job_queue jq
    WHERE jq.id IN (SELECT id FROM fair_candidates)
      AND jq.status = 'queued'  -- Re-check status to avoid race conditions
    FOR UPDATE SKIP LOCKED
  )
  UPDATE job_queue jq
  SET status = 'locked',
      locked_at = v_now,
      locked_by = p_worker_id,
      updated_at = v_now
  FROM locked_jobs
  WHERE jq.id = locked_jobs.id
  RETURNING jq.*;
END;
$$;
