-- ============================================================
-- LOCK DOWN JOB QUEUE MUTATING FUNCTIONS
-- Only service_role should call these (used by run-job-queue edge function)
-- ============================================================

-- 1) claim_queued_jobs(text, integer) - locks and claims jobs for processing
REVOKE ALL ON FUNCTION public.claim_queued_jobs(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_queued_jobs(text, integer) FROM authenticated;
REVOKE ALL ON FUNCTION public.claim_queued_jobs(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_queued_jobs(text, integer) TO service_role;
COMMENT ON FUNCTION public.claim_queued_jobs(text, integer) IS 
'SECURITY: Only callable by service_role (run-job-queue edge function).
Atomically claims queued jobs for processing by a worker.';
-- 2) complete_job(uuid, boolean, text) - marks job as completed/failed
REVOKE ALL ON FUNCTION public.complete_job(uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_job(uuid, boolean, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.complete_job(uuid, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_job(uuid, boolean, text) TO service_role;
COMMENT ON FUNCTION public.complete_job(uuid, boolean, text) IS 
'SECURITY: Only callable by service_role (run-job-queue edge function).
Marks a job as completed or failed with optional error message.';
-- 3) recover_stale_jobs(integer) - recovers stuck jobs
REVOKE ALL ON FUNCTION public.recover_stale_jobs(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recover_stale_jobs(integer) FROM authenticated;
REVOKE ALL ON FUNCTION public.recover_stale_jobs(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.recover_stale_jobs(integer) TO service_role;
COMMENT ON FUNCTION public.recover_stale_jobs(integer) IS 
'SECURITY: Only callable by service_role (run-job-queue edge function or cron).
Resets jobs that have been locked too long back to queued status.';
-- 4) retry_job(uuid) - retries failed jobs with internal role check
DROP FUNCTION IF EXISTS public.retry_job(uuid);
CREATE OR REPLACE FUNCTION public.retry_job(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job RECORD;
  v_caller_role text;
  v_user_id uuid;
BEGIN
  -- Access control: service_role OR platform_admin
  v_caller_role := current_setting('request.jwt.claim.role', true);
  v_user_id := auth.uid();
  
  IF v_caller_role IS DISTINCT FROM 'service_role' THEN
    -- Not service role, check if platform admin
    IF NOT public.is_platform_admin(v_user_id) THEN
      RAISE EXCEPTION 'Access denied: only service_role or platform_admin can retry jobs';
    END IF;
  END IF;

  SELECT * INTO v_job FROM job_queue WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  
  IF v_job.status NOT IN ('failed', 'dead') THEN RETURN FALSE; END IF;
  
  -- Calculate exponential backoff: 1min, 2min, 4min
  UPDATE job_queue
  SET status = 'queued',
      scheduled_for = now() + (power(2, attempts) || ' minutes')::interval,
      locked_at = NULL,
      locked_by = NULL,
      updated_at = now()
  WHERE id = p_job_id;
  
  RETURN TRUE;
END;
$function$;
-- Keep retry_job accessible to authenticated (for platform admins via internal check)
GRANT EXECUTE ON FUNCTION public.retry_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_job(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.retry_job(uuid) FROM anon;
COMMENT ON FUNCTION public.retry_job(uuid) IS 
'SECURITY: Callable by service_role or platform_admin only.
Regular authenticated users get access denied exception.
Used to retry failed/dead jobs with exponential backoff.';
-- 5) deploy_campaign - intentionally callable by authenticated users
-- Has proper auth.uid() check and workspace access validation
COMMENT ON FUNCTION public.deploy_campaign(uuid) IS 
'SECURITY: Callable by authenticated users.
Access control: Validates auth.uid(), workspace membership, and prerequisites.
This is the ONLY entry point for users to deploy campaigns.
Creates initial campaign_run with status=queued (one-time INSERT only).';
