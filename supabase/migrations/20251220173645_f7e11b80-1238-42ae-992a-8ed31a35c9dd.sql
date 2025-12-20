-- ============================================================
-- ATOMIC JOB CLAIMING WITH LOCK TIMEOUT RECOVERY
-- ============================================================

-- Drop and recreate claim_queued_jobs for true atomic claiming
CREATE OR REPLACE FUNCTION public.claim_queued_jobs(p_worker_id text, p_limit integer DEFAULT 10)
RETURNS SETOF job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- First, recover stale locks (locked > 5 minutes and still 'locked')
  UPDATE job_queue
  SET 
    status = 'queued',
    locked_at = NULL,
    locked_by = NULL,
    attempts = attempts + 1,
    updated_at = now()
  WHERE status = 'locked'
    AND locked_at < now() - interval '5 minutes';

  -- Atomic claim: UPDATE ... WHERE ... FOR UPDATE SKIP LOCKED ... RETURNING
  -- This ensures no two workers can claim the same job
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM job_queue
    WHERE status = 'queued'
      AND scheduled_for <= now()
      AND locked_at IS NULL
    ORDER BY scheduled_for ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE job_queue j
  SET 
    status = 'locked',
    locked_at = now(),
    locked_by = p_worker_id,
    updated_at = now()
  FROM claimed c
  WHERE j.id = c.id
  RETURNING j.*;
END;
$function$;

-- Add index for efficient job claiming queries
CREATE INDEX IF NOT EXISTS idx_job_queue_claim_lookup 
ON job_queue (status, scheduled_for, locked_at) 
WHERE status = 'queued' AND locked_at IS NULL;

-- Add index for stale lock recovery
CREATE INDEX IF NOT EXISTS idx_job_queue_stale_locks
ON job_queue (status, locked_at)
WHERE status = 'locked';

-- Function to recover a single stale job (for manual intervention)
CREATE OR REPLACE FUNCTION public.recover_stale_jobs(p_timeout_minutes integer DEFAULT 5)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recovered_count integer;
BEGIN
  WITH recovered AS (
    UPDATE job_queue
    SET 
      status = 'queued',
      locked_at = NULL,
      locked_by = NULL,
      attempts = attempts + 1,
      updated_at = now()
    WHERE status = 'locked'
      AND locked_at < now() - (p_timeout_minutes || ' minutes')::interval
    RETURNING id
  )
  SELECT count(*) INTO recovered_count FROM recovered;
  
  RETURN recovered_count;
END;
$function$;