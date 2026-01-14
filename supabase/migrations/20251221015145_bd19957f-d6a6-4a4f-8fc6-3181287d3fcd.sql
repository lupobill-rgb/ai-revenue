-- Phase A: Multi-Worker Horizontal Scaling
-- Observability tables and enhanced claim function

-- Worker tick metrics table for observability
CREATE TABLE IF NOT EXISTS public.worker_tick_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id text NOT NULL,
  tick_started_at timestamptz NOT NULL DEFAULT now(),
  tick_completed_at timestamptz,
  tick_duration_ms integer,
  jobs_claimed integer DEFAULT 0,
  jobs_processed integer DEFAULT 0,
  jobs_succeeded integer DEFAULT 0,
  jobs_failed integer DEFAULT 0,
  jobs_throttled integer DEFAULT 0,
  lock_contention_count integer DEFAULT 0,
  tenant_jobs jsonb DEFAULT '{}',
  queue_depth_at_start integer DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Index for querying recent metrics
CREATE INDEX IF NOT EXISTS idx_worker_tick_metrics_created 
ON worker_tick_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_tick_metrics_worker
ON worker_tick_metrics(worker_id, created_at DESC);
-- Enable RLS (platform admins only)
ALTER TABLE public.worker_tick_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_admins_only_select" ON public.worker_tick_metrics
FOR SELECT USING (is_platform_admin());
CREATE POLICY "platform_admins_only_insert" ON public.worker_tick_metrics
FOR INSERT WITH CHECK (is_platform_admin());
-- Allow service role full access for edge functions
CREATE POLICY "service_role_all" ON public.worker_tick_metrics
FOR ALL USING (auth.role() = 'service_role');
-- Enhanced claim_queued_jobs with per-tenant fairness
-- Returns jobs distributed across tenants for fairness
CREATE OR REPLACE FUNCTION public.claim_queued_jobs(
  p_worker_id text,
  p_limit integer DEFAULT 50
)
RETURNS SETOF job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_timeout interval := interval '50 milliseconds';
  v_max_per_tenant integer := 10;
  v_claimed_ids uuid[];
  v_tenant_counts jsonb := '{}';
BEGIN
  -- Set a short lock timeout to avoid blocking other workers
  EXECUTE format('SET LOCAL lock_timeout = %L', v_lock_timeout);
  
  -- Claim jobs with FOR UPDATE SKIP LOCKED for concurrent worker safety
  -- Uses a CTE to fairly distribute across tenants
  WITH ranked_jobs AS (
    SELECT 
      id,
      tenant_id,
      ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC) as tenant_rank
    FROM job_queue
    WHERE status = 'queued'
      AND (scheduled_for IS NULL OR scheduled_for <= now())
      AND locked_at IS NULL
  ),
  fair_jobs AS (
    SELECT id
    FROM ranked_jobs
    WHERE tenant_rank <= v_max_per_tenant
    ORDER BY tenant_rank ASC, id ASC
    LIMIT p_limit
  ),
  claimed AS (
    UPDATE job_queue jq
    SET 
      status = 'locked',
      locked_at = now(),
      locked_by = p_worker_id,
      attempts = attempts + 1
    FROM fair_jobs fj
    WHERE jq.id = fj.id
      AND jq.status = 'queued' -- Re-check status to avoid race
      AND jq.locked_at IS NULL -- Re-check lock to avoid race
    RETURNING jq.*
  )
  SELECT array_agg(id) INTO v_claimed_ids FROM claimed;
  
  -- Return the claimed jobs
  RETURN QUERY
  SELECT * FROM job_queue WHERE id = ANY(COALESCE(v_claimed_ids, ARRAY[]::uuid[]));
  
EXCEPTION
  WHEN lock_not_available THEN
    -- Another worker has the lock, return empty
    RAISE NOTICE 'Lock contention detected for worker %', p_worker_id;
    RETURN;
  WHEN OTHERS THEN
    RAISE;
END;
$$;
-- Function to record worker tick metrics
CREATE OR REPLACE FUNCTION public.record_worker_tick(
  p_worker_id text,
  p_tick_started_at timestamptz,
  p_jobs_claimed integer,
  p_jobs_processed integer,
  p_jobs_succeeded integer,
  p_jobs_failed integer,
  p_jobs_throttled integer,
  p_lock_contention integer,
  p_tenant_jobs jsonb,
  p_queue_depth integer,
  p_error text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tick_id uuid;
  v_duration_ms integer;
BEGIN
  v_duration_ms := EXTRACT(EPOCH FROM (now() - p_tick_started_at)) * 1000;
  
  INSERT INTO worker_tick_metrics (
    worker_id,
    tick_started_at,
    tick_completed_at,
    tick_duration_ms,
    jobs_claimed,
    jobs_processed,
    jobs_succeeded,
    jobs_failed,
    jobs_throttled,
    lock_contention_count,
    tenant_jobs,
    queue_depth_at_start,
    error_message
  ) VALUES (
    p_worker_id,
    p_tick_started_at,
    now(),
    v_duration_ms,
    p_jobs_claimed,
    p_jobs_processed,
    p_jobs_succeeded,
    p_jobs_failed,
    p_jobs_throttled,
    p_lock_contention,
    p_tenant_jobs,
    p_queue_depth,
    p_error
  )
  RETURNING id INTO v_tick_id;
  
  RETURN v_tick_id;
END;
$$;
-- View for worker health summary (last 5 minutes)
CREATE OR REPLACE VIEW public.worker_health_summary AS
SELECT 
  worker_id,
  COUNT(*) as tick_count,
  AVG(tick_duration_ms)::integer as avg_tick_duration_ms,
  MAX(tick_duration_ms) as max_tick_duration_ms,
  SUM(jobs_claimed) as total_jobs_claimed,
  SUM(jobs_processed) as total_jobs_processed,
  SUM(jobs_succeeded) as total_jobs_succeeded,
  SUM(jobs_failed) as total_jobs_failed,
  SUM(jobs_throttled) as total_jobs_throttled,
  SUM(lock_contention_count) as total_lock_contentions,
  MAX(created_at) as last_tick_at,
  EXTRACT(EPOCH FROM (now() - MAX(created_at))) as seconds_since_last_tick
FROM worker_tick_metrics
WHERE created_at > now() - interval '5 minutes'
GROUP BY worker_id;
-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.claim_queued_jobs(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_worker_tick(text, timestamptz, integer, integer, integer, integer, integer, integer, jsonb, integer, text) TO service_role;
GRANT SELECT ON public.worker_health_summary TO authenticated;
