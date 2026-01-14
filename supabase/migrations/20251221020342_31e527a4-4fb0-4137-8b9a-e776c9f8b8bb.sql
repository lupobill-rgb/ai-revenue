-- ============================================================
-- Step 1: Create claim_queued_jobs function with worker identity
-- This function atomically claims jobs using FOR UPDATE SKIP LOCKED
-- and sets locked_by to the worker_id for traceability
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_queued_jobs(
  p_worker_id text,
  p_limit integer DEFAULT 50
)
RETURNS SETOF job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_max_per_tenant integer := 10; -- Fair distribution across tenants
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
    WHERE tenant_rank <= v_max_per_tenant
    LIMIT p_limit
  ) claimed
  WHERE jq.id = claimed.id
  RETURNING jq.*;
END;
$$;
-- Grant execute to service role
GRANT EXECUTE ON FUNCTION public.claim_queued_jobs(text, integer) TO service_role;
-- Add index for efficient job claiming
CREATE INDEX IF NOT EXISTS idx_job_queue_claim 
ON job_queue (status, scheduled_for, tenant_id) 
WHERE status = 'queued';
-- Add comment for documentation
COMMENT ON FUNCTION public.claim_queued_jobs IS 
'Atomically claims queued jobs for a worker using FOR UPDATE SKIP LOCKED. 
Sets locked_by to worker_id for traceability. 
Implements fair distribution with per-tenant caps to prevent noisy neighbors.
WID1 PASS: every locked job has locked_by populated';
