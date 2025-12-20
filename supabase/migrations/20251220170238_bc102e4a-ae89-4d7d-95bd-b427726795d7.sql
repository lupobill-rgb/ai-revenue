-- Fix security issues in cron functions: remove hardcoded secrets, use vault properly

-- 1. Fix dispatch_outbound_cron - use vault secret only, no fallbacks
CREATE OR REPLACE FUNCTION public.dispatch_outbound_cron()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _result jsonb;
  _secret text;
BEGIN
  -- Get the secret from vault - REQUIRED, no fallback
  SELECT decrypted_secret INTO _secret 
  FROM vault.decrypted_secrets 
  WHERE name = 'INTERNAL_FUNCTION_SECRET' 
  LIMIT 1;
  
  IF _secret IS NULL THEN
    RAISE EXCEPTION 'INTERNAL_FUNCTION_SECRET not found in vault';
  END IF;
  
  -- Call the edge function with the secret
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/dispatch-outbound-sequences',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', _secret
    ),
    body := '{"cron": true}'::jsonb
  ) INTO _result;
  
  RAISE LOG 'dispatch_outbound_cron completed';
END;
$function$;

-- 2. Fix run_job_queue_cron - use vault for anon key, no hardcoding
CREATE OR REPLACE FUNCTION public.run_job_queue_cron()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _result jsonb;
  _anon_key text;
  _supabase_url text;
BEGIN
  -- Get anon key from vault - REQUIRED
  SELECT decrypted_secret INTO _anon_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_ANON_KEY' 
  LIMIT 1;
  
  IF _anon_key IS NULL THEN
    RAISE EXCEPTION 'SUPABASE_ANON_KEY not found in vault';
  END IF;
  
  -- Get URL from app settings
  _supabase_url := current_setting('app.supabase_url', true);
  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    RAISE EXCEPTION 'app.supabase_url not configured';
  END IF;
  
  -- Call the edge function
  SELECT net.http_post(
    url := _supabase_url || '/functions/v1/run-job-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := '{"source": "pg_cron"}'::jsonb
  ) INTO _result;
  
  RAISE LOG 'run_job_queue_cron completed';
END;
$function$;

-- 3. Restrict function execution to postgres role only (used by pg_cron)
REVOKE EXECUTE ON FUNCTION public.dispatch_outbound_cron() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dispatch_outbound_cron() FROM anon;
REVOKE EXECUTE ON FUNCTION public.dispatch_outbound_cron() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.run_job_queue_cron() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_job_queue_cron() FROM anon;
REVOKE EXECUTE ON FUNCTION public.run_job_queue_cron() FROM authenticated;

-- Only postgres (superuser/service role) can execute these
GRANT EXECUTE ON FUNCTION public.dispatch_outbound_cron() TO postgres;
GRANT EXECUTE ON FUNCTION public.run_job_queue_cron() TO postgres;