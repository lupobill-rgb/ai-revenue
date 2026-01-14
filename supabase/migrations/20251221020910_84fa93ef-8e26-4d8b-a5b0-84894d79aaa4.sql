-- ============================================================
-- Step 4: Load Test Infrastructure
-- Seeds test jobs and provides metrics for pass/no-pass criteria
-- ============================================================

-- Function to seed test jobs across multiple tenants
CREATE OR REPLACE FUNCTION public.seed_load_test_jobs(
  p_total_jobs integer DEFAULT 1000,
  p_tenant_count integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_jobs_per_tenant integer;
  v_tenant_ids uuid[];
  v_workspace_ids uuid[];
  v_run_id uuid;
  v_job_id uuid;
  v_i integer;
  v_t integer;
  v_created integer := 0;
BEGIN
  v_jobs_per_tenant := p_total_jobs / p_tenant_count;
  
  -- Get existing tenant/workspace pairs (or create test ones)
  SELECT 
    array_agg(DISTINCT ut.tenant_id),
    array_agg(DISTINCT w.id)
  INTO v_tenant_ids, v_workspace_ids
  FROM user_tenants ut
  JOIN workspaces w ON w.owner_id = ut.user_id
  LIMIT p_tenant_count;
  
  IF array_length(v_tenant_ids, 1) IS NULL OR array_length(v_tenant_ids, 1) < p_tenant_count THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Need at least %s tenant/workspace pairs, found %s', 
                      p_tenant_count, COALESCE(array_length(v_tenant_ids, 1), 0))
    );
  END IF;
  
  -- Create test jobs for each tenant
  FOR v_t IN 1..p_tenant_count LOOP
    -- Create a campaign run for this batch
    INSERT INTO campaign_runs (
      tenant_id, workspace_id, campaign_id, channel, status, scheduled_for
    ) VALUES (
      v_tenant_ids[v_t], 
      v_workspace_ids[v_t], 
      gen_random_uuid(), -- Fake campaign ID for testing
      'email', 
      'queued', 
      now()
    ) RETURNING id INTO v_run_id;
    
    -- Create jobs for this tenant
    FOR v_i IN 1..v_jobs_per_tenant LOOP
      INSERT INTO job_queue (
        tenant_id, workspace_id, run_id, job_type, payload, status, scheduled_for
      ) VALUES (
        v_tenant_ids[v_t],
        v_workspace_ids[v_t],
        v_run_id,
        'email_send_batch',
        jsonb_build_object(
          'test', true,
          'batch_num', v_i,
          'tenant_num', v_t
        ),
        'queued',
        now()
      );
      v_created := v_created + 1;
    END LOOP;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'jobs_created', v_created,
    'tenants', p_tenant_count,
    'jobs_per_tenant', v_jobs_per_tenant
  );
END;
$$;
-- Function to get load test metrics
CREATE OR REPLACE FUNCTION public.get_load_test_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_queue_stats jsonb;
  v_oldest_age_seconds integer;
  v_duplicate_count integer;
  v_worker_stats jsonb;
  v_tenant_distribution jsonb;
BEGIN
  -- Queue stats
  SELECT jsonb_build_object(
    'queued', COUNT(*) FILTER (WHERE status = 'queued'),
    'locked', COUNT(*) FILTER (WHERE status = 'locked'),
    'completed', COUNT(*) FILTER (WHERE status = 'completed'),
    'failed', COUNT(*) FILTER (WHERE status = 'failed'),
    'dead', COUNT(*) FILTER (WHERE status = 'dead'),
    'total', COUNT(*)
  ) INTO v_queue_stats
  FROM job_queue
  WHERE created_at > now() - interval '1 hour';
  
  -- Oldest queued job age (LOAD3)
  SELECT EXTRACT(EPOCH FROM (now() - MIN(created_at)))::integer
  INTO v_oldest_age_seconds
  FROM job_queue
  WHERE status = 'queued';
  
  -- Duplicate check (LOAD2) - must be 0
  SELECT COUNT(*)
  INTO v_duplicate_count
  FROM (
    SELECT idempotency_key, COUNT(*) as cnt
    FROM channel_outbox
    WHERE created_at > now() - interval '1 hour'
    GROUP BY idempotency_key
    HAVING COUNT(*) > 1
  ) dups;
  
  -- Worker stats from last 5 minutes
  SELECT jsonb_build_object(
    'worker_count', COUNT(DISTINCT worker_id),
    'total_jobs_claimed', SUM(jobs_claimed),
    'total_jobs_succeeded', SUM(jobs_succeeded),
    'total_jobs_failed', SUM(jobs_failed),
    'avg_tick_duration_ms', AVG(tick_duration_ms)
  ) INTO v_worker_stats
  FROM worker_tick_metrics
  WHERE tick_started_at > now() - interval '5 minutes';
  
  -- Per-tenant distribution (fairness check)
  SELECT jsonb_object_agg(tenant_id::text, job_count)
  INTO v_tenant_distribution
  FROM (
    SELECT tenant_id, COUNT(*) as job_count
    FROM job_queue
    WHERE status IN ('completed', 'locked')
      AND created_at > now() - interval '1 hour'
    GROUP BY tenant_id
  ) t;
  
  RETURN jsonb_build_object(
    'timestamp', now(),
    'queue_stats', v_queue_stats,
    'oldest_queued_age_seconds', COALESCE(v_oldest_age_seconds, 0),
    'duplicate_count', v_duplicate_count,
    'worker_stats', v_worker_stats,
    'tenant_distribution', v_tenant_distribution,
    'pass_criteria', jsonb_build_object(
      'LOAD2_duplicates_zero', v_duplicate_count = 0,
      'LOAD3_oldest_under_180s', COALESCE(v_oldest_age_seconds, 0) < 180
    )
  );
END;
$$;
-- Function to clear test data
CREATE OR REPLACE FUNCTION public.clear_load_test_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_jobs_deleted integer;
  v_runs_deleted integer;
BEGIN
  -- Delete test jobs
  DELETE FROM job_queue 
  WHERE payload->>'test' = 'true'
  RETURNING 1 INTO v_jobs_deleted;
  
  GET DIAGNOSTICS v_jobs_deleted = ROW_COUNT;
  
  -- Delete orphaned test runs
  DELETE FROM campaign_runs
  WHERE id NOT IN (SELECT DISTINCT run_id FROM job_queue WHERE run_id IS NOT NULL)
    AND created_at > now() - interval '1 hour'
  RETURNING 1 INTO v_runs_deleted;
  
  GET DIAGNOSTICS v_runs_deleted = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'jobs_deleted', v_jobs_deleted,
    'runs_deleted', v_runs_deleted
  );
END;
$$;
COMMENT ON FUNCTION public.seed_load_test_jobs IS 'Seeds test jobs for load testing. Default: 1000 jobs across 10 tenants.';
COMMENT ON FUNCTION public.get_load_test_metrics IS 'Returns load test metrics including queue stats, duplicate count, and oldest job age.';
COMMENT ON FUNCTION public.clear_load_test_data IS 'Cleans up test data after load testing.';
