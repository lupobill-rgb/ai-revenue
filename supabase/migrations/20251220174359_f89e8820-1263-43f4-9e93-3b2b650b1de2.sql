-- ============================================================
-- HARDEN run_job_queue_cron() - Use internal secret, not anon key
-- ============================================================

CREATE OR REPLACE FUNCTION public.run_job_queue_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _result jsonb;
  _internal_secret text;
  _supabase_url text;
BEGIN
  -- Get internal function secret from vault - REQUIRED for security
  SELECT decrypted_secret INTO _internal_secret 
  FROM vault.decrypted_secrets 
  WHERE name = 'INTERNAL_FUNCTION_SECRET' 
  LIMIT 1;
  
  IF _internal_secret IS NULL THEN
    -- Fall back to vault version if named differently
    SELECT decrypted_secret INTO _internal_secret 
    FROM vault.decrypted_secrets 
    WHERE name = 'INTERNAL_FUNCTION_SECRET_VAULT' 
    LIMIT 1;
  END IF;
  
  IF _internal_secret IS NULL THEN
    RAISE EXCEPTION 'INTERNAL_FUNCTION_SECRET not found in vault';
  END IF;
  
  -- Get URL from app settings
  _supabase_url := current_setting('app.supabase_url', true);
  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    RAISE EXCEPTION 'app.supabase_url not configured';
  END IF;
  
  -- Call the edge function with internal secret (not anon key)
  SELECT net.http_post(
    url := _supabase_url || '/functions/v1/run-job-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', _internal_secret
    ),
    body := '{"source": "pg_cron"}'::jsonb
  ) INTO _result;
  
  RAISE LOG 'run_job_queue_cron completed with internal secret auth';
END;
$function$;
-- Add comment for documentation
COMMENT ON FUNCTION public.run_job_queue_cron IS 
'Cron-invoked function that calls run-job-queue edge function.
SECURITY: Uses INTERNAL_FUNCTION_SECRET from vault (not anon key).
CALLERS: pg_cron scheduler only.
SCHEDULE: Every minute via run-job-queue-every-minute job.';
