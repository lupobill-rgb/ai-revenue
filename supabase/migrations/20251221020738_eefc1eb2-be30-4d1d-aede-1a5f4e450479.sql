-- ============================================================
-- Step 3: Increase scheduler concurrency to 4 parallel workers
-- Each worker hits run-job-queue with independent worker_id
-- HS1: Throughput ~3-4x vs 1 worker
-- HS2: Duplicates remain 0 (idempotency holds)
-- ============================================================

-- Create function that spawns 4 parallel worker invocations
CREATE OR REPLACE FUNCTION public.run_job_queue_parallel()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _internal_secret text;
  _supabase_url text;
  _worker_num integer;
BEGIN
  -- Get internal function secret from vault
  SELECT decrypted_secret INTO _internal_secret 
  FROM vault.decrypted_secrets 
  WHERE name = 'INTERNAL_FUNCTION_SECRET' 
  LIMIT 1;
  
  IF _internal_secret IS NULL THEN
    RAISE EXCEPTION 'INTERNAL_FUNCTION_SECRET not found in vault';
  END IF;
  
  -- Get URL from app settings
  _supabase_url := current_setting('app.supabase_url', true);
  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    RAISE EXCEPTION 'app.supabase_url not configured';
  END IF;
  
  -- Spawn 4 parallel workers using pg_net
  -- Each call is non-blocking and runs concurrently
  FOR _worker_num IN 1..4 LOOP
    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/run-job-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', _internal_secret
      ),
      body := jsonb_build_object(
        'source', 'pg_cron',
        'worker_slot', _worker_num
      )
    );
  END LOOP;
  
  RAISE LOG 'run_job_queue_parallel: spawned 4 workers';
END;
$$;

COMMENT ON FUNCTION public.run_job_queue_parallel IS 
'Spawns 4 parallel job queue workers for horizontal scaling.
HS1: Throughput ~3-4x vs 1 worker (4 concurrent workers)
HS2: Duplicates remain 0 due to FOR UPDATE SKIP LOCKED + idempotency keys';
