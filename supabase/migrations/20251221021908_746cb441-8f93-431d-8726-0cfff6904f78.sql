-- Add service_role guard to get_horizontal_scaling_metrics
CREATE OR REPLACE FUNCTION public.get_horizontal_scaling_metrics(p_window_minutes integer DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workers jsonb;
  v_queue_stats jsonb;
  v_oldest_queued_age_seconds integer;
  v_duplicate_groups integer;
BEGIN
  -- Guard: only service_role can execute
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 1. Aggregate worker metrics from last p_window_minutes
  SELECT COALESCE(jsonb_agg(worker_row), '[]'::jsonb) INTO v_workers
  FROM (
    SELECT 
      jsonb_build_object(
        'worker_id', worker_id,
        'jobs_claimed', SUM(jobs_claimed)::integer,
        'jobs_succeeded', SUM(jobs_succeeded)::integer,
        'jobs_failed', SUM(jobs_failed)::integer,
        'avg_tick_duration_ms', ROUND(AVG(tick_duration_ms))::integer,
        'last_tick_at', MAX(tick_started_at)
      ) as worker_row
    FROM worker_tick_metrics
    WHERE tick_started_at >= now() - (p_window_minutes || ' minutes')::interval
    GROUP BY worker_id
    ORDER BY MAX(tick_started_at) DESC
  ) w;

  -- 2. Queue stats via filtered aggregates (uses index on status, created_at)
  SELECT jsonb_build_object(
    'queued', COUNT(*) FILTER (WHERE status = 'queued'),
    'locked', COUNT(*) FILTER (WHERE status = 'locked'),
    'completed', COUNT(*) FILTER (WHERE status = 'completed'),
    'failed', COUNT(*) FILTER (WHERE status = 'failed')
  ) INTO v_queue_stats
  FROM job_queue;

  -- 3. Oldest queued age (seconds) - uses index
  SELECT COALESCE(
    EXTRACT(EPOCH FROM (now() - MIN(created_at)))::integer,
    0
  ) INTO v_oldest_queued_age_seconds
  FROM job_queue
  WHERE status = 'queued';

  -- 4. Duplicate groups (tenant_id, workspace_id, idempotency_key) in last hour
  SELECT COALESCE(COUNT(*)::integer, 0) INTO v_duplicate_groups
  FROM (
    SELECT tenant_id, workspace_id, idempotency_key
    FROM channel_outbox
    WHERE created_at >= now() - interval '1 hour'
    GROUP BY tenant_id, workspace_id, idempotency_key
    HAVING count(*) > 1
  ) d;

  RETURN jsonb_build_object(
    'workers', v_workers,
    'queue_stats', v_queue_stats,
    'oldest_queued_age_seconds', v_oldest_queued_age_seconds,
    'duplicate_groups_last_hour', v_duplicate_groups
  );
END;
$$;

-- Add index for performance on job_queue queries
CREATE INDEX IF NOT EXISTS idx_job_queue_status_created_at ON job_queue(status, created_at);