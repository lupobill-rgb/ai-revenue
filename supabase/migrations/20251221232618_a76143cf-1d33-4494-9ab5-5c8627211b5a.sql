-- Fix HS metrics authorization guard: use auth.role() / request.jwt.claims parsing.
-- Note: pg_net extension cannot be moved out of public because it doesn't support SET SCHEMA.

CREATE OR REPLACE FUNCTION public.get_horizontal_scaling_metrics(p_window_minutes integer DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workers jsonb;
  v_queue_stats jsonb;
  v_oldest_queued_age_seconds int;
  v_duplicate_groups int;
  v_role text;
  v_claims text;
BEGIN
  -- Prefer built-in helper (reliable across contexts)
  v_role := auth.role();

  -- Fallback: parse JWT claims if present
  IF v_role IS NULL OR v_role = '' THEN
    v_claims := current_setting('request.jwt.claims', true);
    IF v_claims IS NOT NULL AND v_claims <> '' THEN
      v_role := (v_claims::jsonb ->> 'role');
    END IF;
  END IF;

  -- Legacy fallback
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claim.role', true);
  END IF;

  -- HARD GUARD
  IF v_role = 'service_role' THEN
    NULL;
  ELSIF v_role = 'authenticated' THEN
    IF NOT public.is_platform_admin_safe() THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  ELSE
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
    FROM public.worker_tick_metrics
    WHERE tick_started_at >= now() - (p_window_minutes || ' minutes')::interval
    GROUP BY worker_id
    ORDER BY MAX(tick_started_at) DESC
  ) w;

  -- 2. Queue stats via filtered aggregates
  SELECT jsonb_build_object(
    'queued', COUNT(*) FILTER (WHERE status = 'queued'),
    'locked', COUNT(*) FILTER (WHERE status = 'locked'),
    'completed', COUNT(*) FILTER (WHERE status = 'completed'),
    'failed', COUNT(*) FILTER (WHERE status = 'failed')
  ) INTO v_queue_stats
  FROM public.job_queue;

  -- 3. Oldest queued age (seconds)
  SELECT COALESCE(
    EXTRACT(EPOCH FROM (now() - MIN(created_at)))::integer,
    0
  ) INTO v_oldest_queued_age_seconds
  FROM public.job_queue
  WHERE status = 'queued';

  -- 4. Duplicate groups in last hour
  SELECT COALESCE(COUNT(*)::integer, 0) INTO v_duplicate_groups
  FROM (
    SELECT tenant_id, workspace_id, idempotency_key
    FROM public.channel_outbox
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

GRANT EXECUTE ON FUNCTION public.get_horizontal_scaling_metrics(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_horizontal_scaling_metrics(integer) TO service_role;