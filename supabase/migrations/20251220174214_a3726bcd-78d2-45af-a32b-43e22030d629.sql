-- ============================================================
-- LOCK DOWN update_campaign_run_status() - SECURITY HARDENING
-- ============================================================

-- 1) Drop existing function
DROP FUNCTION IF EXISTS public.update_campaign_run_status(uuid, text, timestamp with time zone, timestamp with time zone, text, text, jsonb);

-- 2) Create hardened function with strict guards
CREATE OR REPLACE FUNCTION public.update_campaign_run_status(
  p_run_id uuid,
  p_status text,
  p_started_at timestamp with time zone DEFAULT NULL,
  p_completed_at timestamp with time zone DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_metrics_snapshot jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_run RECORD;
  v_caller_role text;
  v_allowed_transitions text[];
  v_rows_updated integer;
BEGIN
  -- ============================================================
  -- ACCESS CONTROL: Only service_role can execute
  -- ============================================================
  v_caller_role := current_setting('request.jwt.claim.role', true);
  
  -- Must be service_role (edge functions use service role key)
  IF v_caller_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied: only service_role can update campaign_runs. Got role: %', COALESCE(v_caller_role, 'NULL');
  END IF;

  -- ============================================================
  -- VALIDATE RUN EXISTS
  -- ============================================================
  SELECT id, tenant_id, workspace_id, status, campaign_id
  INTO v_current_run
  FROM campaign_runs
  WHERE id = p_run_id
  FOR UPDATE; -- Lock row to prevent race conditions

  IF v_current_run IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Run not found', 'run_id', p_run_id);
  END IF;

  -- ============================================================
  -- STATUS TRANSITION VALIDATION
  -- ============================================================
  -- Define allowed transitions based on current status
  CASE v_current_run.status
    WHEN 'queued' THEN
      v_allowed_transitions := ARRAY['running', 'failed'];
    WHEN 'running' THEN
      v_allowed_transitions := ARRAY['completed', 'partial', 'failed'];
    WHEN 'locked' THEN
      -- locked is an intermediate state during job claiming
      v_allowed_transitions := ARRAY['running', 'completed', 'partial', 'failed'];
    ELSE
      -- Terminal states: completed, partial, failed, dead - no further transitions
      v_allowed_transitions := ARRAY[]::text[];
  END CASE;

  -- Check if requested transition is allowed
  IF NOT (p_status = ANY(v_allowed_transitions)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Invalid status transition: %s -> %s not allowed', v_current_run.status, p_status),
      'current_status', v_current_run.status,
      'requested_status', p_status,
      'allowed_transitions', v_allowed_transitions
    );
  END IF;

  -- ============================================================
  -- UPDATE ONLY ALLOWED FIELDS
  -- ============================================================
  -- tenant_id, workspace_id, campaign_id, created_by, scheduled_for are NEVER updated
  UPDATE campaign_runs
  SET
    status = p_status,
    started_at = COALESCE(p_started_at, started_at),
    completed_at = COALESCE(p_completed_at, completed_at),
    error_message = COALESCE(p_error_message, error_message),
    error_code = COALESCE(p_error_code, error_code),
    metrics_snapshot = COALESCE(p_metrics_snapshot, metrics_snapshot),
    updated_at = now()
  WHERE id = p_run_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Update failed - no rows affected');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'run_id', p_run_id,
    'old_status', v_current_run.status,
    'new_status', p_status
  );
END;
$function$;

-- ============================================================
-- 3) REVOKE/GRANT PERMISSIONS
-- ============================================================
-- Revoke from everyone
REVOKE ALL ON FUNCTION public.update_campaign_run_status(uuid, text, timestamp with time zone, timestamp with time zone, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_campaign_run_status(uuid, text, timestamp with time zone, timestamp with time zone, text, text, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.update_campaign_run_status(uuid, text, timestamp with time zone, timestamp with time zone, text, text, jsonb) FROM anon;

-- Grant only to service_role (used by edge functions)
GRANT EXECUTE ON FUNCTION public.update_campaign_run_status(uuid, text, timestamp with time zone, timestamp with time zone, text, text, jsonb) TO service_role;

-- ============================================================
-- 4) ADD COMMENT FOR DOCUMENTATION
-- ============================================================
COMMENT ON FUNCTION public.update_campaign_run_status IS 
'SECURITY: Only callable by service_role (edge functions).
ALLOWED CALLERS: run-job-queue edge function only.
TRANSITIONS: queued->running->completed|partial|failed. No backwards transitions.
PROTECTED FIELDS: tenant_id, workspace_id, campaign_id, created_by, scheduled_for are immutable.';