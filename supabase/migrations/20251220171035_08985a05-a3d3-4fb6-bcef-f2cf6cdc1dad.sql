
-- ============================================================
-- SINGLE WRITER ENFORCEMENT FOR campaign_runs
-- Only run-job-queue edge function may update status/timestamps
-- ============================================================

-- 1) Create a SECURITY DEFINER function for edge function to update campaign_runs
-- This is the ONLY pathway for updating campaign_runs status after initial insert
CREATE OR REPLACE FUNCTION public.update_campaign_run_status(
  p_run_id uuid,
  p_status text,
  p_started_at timestamptz DEFAULT NULL,
  p_completed_at timestamptz DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_metrics_snapshot jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate status transitions
  IF p_status NOT IN ('queued', 'running', 'completed', 'partial', 'failed') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE campaign_runs
  SET 
    status = p_status,
    started_at = COALESCE(p_started_at, started_at),
    completed_at = COALESCE(p_completed_at, completed_at),
    error_message = p_error_message,
    error_code = p_error_code,
    metrics_snapshot = COALESCE(p_metrics_snapshot, metrics_snapshot),
    updated_at = now()
  WHERE id = p_run_id;
END;
$function$;

-- 2) Fix retry_job to NOT update campaign_runs (edge function handles this)
CREATE OR REPLACE FUNCTION public.retry_job(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job RECORD;
BEGIN
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
  
  -- NOTE: campaign_runs.status is managed by run-job-queue edge function
  -- When the job is re-processed, the edge function will update the run status
  
  RETURN TRUE;
END;
$function$;

-- 3) Fix deploy_campaign exception handler to NOT update campaign_runs directly
-- The deploy_campaign function should fail cleanly without partial state
CREATE OR REPLACE FUNCTION public.deploy_campaign(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_campaign RECORD;
  v_tenant_id uuid;
  v_workspace_id uuid;
  v_run_id uuid;
  v_job_id uuid;
  v_user_id uuid;
  v_now timestamptz := now();
  v_channel text;
  v_prerequisites jsonb;
  v_email_settings RECORD;
  v_social_settings RECORD;
  v_voice_settings RECORD;
  v_voice_provider text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT c.id, c.workspace_id, c.status, c.is_locked, c.channel, w.owner_id
  INTO v_campaign
  FROM campaigns c
  JOIN workspaces w ON w.id = c.workspace_id
  WHERE c.id = p_campaign_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campaign not found');
  END IF;

  v_workspace_id := v_campaign.workspace_id;
  v_channel := COALESCE(v_campaign.channel, 'email');

  -- Block unsupported channels with "Coming Soon"
  IF v_channel IN ('video', 'landing_page') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Coming Soon: ' || initcap(replace(v_channel, '_', ' ')) || ' campaign deployment is not yet supported',
      'channel', v_channel,
      'coming_soon', true
    );
  END IF;

  IF NOT user_has_workspace_access(v_workspace_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied - not a workspace member');
  END IF;

  IF v_campaign.is_locked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campaign is locked - create a new version to edit');
  END IF;

  SELECT tenant_id INTO v_tenant_id
  FROM user_tenants
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tenant found for user');
  END IF;

  -- Check launch prerequisites
  v_prerequisites := check_campaign_launch_prerequisites(p_campaign_id, v_workspace_id);
  
  IF NOT (v_prerequisites->>'pass')::boolean THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Launch prerequisites not met',
      'prerequisites', v_prerequisites->'requirements'
    );
  END IF;

  -- Get settings based on channel
  SELECT * INTO v_email_settings FROM ai_settings_email WHERE tenant_id = v_workspace_id;
  
  -- Check social settings for social channel
  IF v_channel = 'social' THEN
    SELECT * INTO v_social_settings FROM ai_settings_social WHERE tenant_id = v_workspace_id;
    IF v_social_settings IS NULL OR NOT COALESCE(v_social_settings.is_connected, false) THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Social integration not connected. Please configure your social account in Settings first.',
        'channel', v_channel,
        'integration_required', true
      );
    END IF;
  END IF;

  -- Check voice settings for voice channel
  IF v_channel = 'voice' THEN
    SELECT * INTO v_voice_settings FROM ai_settings_voice WHERE tenant_id = v_workspace_id;
    v_voice_provider := COALESCE(v_voice_settings.voice_provider, 'vapi');
    
    IF v_voice_provider = 'vapi' AND v_voice_settings.default_vapi_assistant_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'VAPI not configured. Please set up a VAPI assistant in Settings → Voice.',
        'channel', v_channel,
        'integration_required', true
      );
    END IF;
    
    IF v_voice_provider = 'elevenlabs' AND v_voice_settings.default_elevenlabs_voice_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'ElevenLabs not configured. Please select a voice in Settings → Voice.',
        'channel', v_channel,
        'integration_required', true
      );
    END IF;
  ELSE
    v_voice_provider := 'vapi';
  END IF;

  -- Create campaign_run with status 'queued' (ONLY place this status is set)
  INSERT INTO campaign_runs (
    tenant_id, workspace_id, campaign_id, channel, status,
    scheduled_for, started_at, run_config, created_by
  ) VALUES (
    v_tenant_id, v_workspace_id, p_campaign_id, v_channel, 'queued',
    v_now, NULL, 
    jsonb_build_object(
      'deployed_by', v_user_id,
      'provider', CASE v_channel 
        WHEN 'email' THEN COALESCE(v_email_settings.email_provider, 'resend')
        WHEN 'voice' THEN v_voice_provider
        WHEN 'social' THEN COALESCE(v_social_settings.social_provider, 'internal')
        ELSE 'internal'
      END
    ), 
    v_user_id
  )
  RETURNING id INTO v_run_id;

  -- Create job based on channel with provider info
  INSERT INTO job_queue (
    tenant_id, workspace_id, run_id, job_type, payload, status, scheduled_for
  ) VALUES (
    v_tenant_id, v_workspace_id, v_run_id,
    CASE v_channel
      WHEN 'email' THEN 'email_send_batch'
      WHEN 'voice' THEN 'voice_call_batch'
      WHEN 'social' THEN 'social_post_batch'
      ELSE 'email_send_batch'
    END,
    jsonb_build_object(
      'campaign_id', p_campaign_id, 
      'channel', v_channel,
      'provider', CASE v_channel 
        WHEN 'email' THEN COALESCE(v_email_settings.email_provider, 'resend')
        WHEN 'voice' THEN v_voice_provider
        WHEN 'social' THEN COALESCE(v_social_settings.social_provider, 'internal')
        ELSE 'internal'
      END
    ),
    'queued',
    v_now
  )
  RETURNING id INTO v_job_id;

  -- Lock campaign
  UPDATE campaigns
  SET status = 'deployed', deployed_at = v_now, is_locked = true,
      locked_at = v_now, locked_reason = 'Campaign deployed'
  WHERE id = p_campaign_id;

  -- Initialize metrics
  INSERT INTO campaign_metrics (campaign_id, workspace_id)
  VALUES (p_campaign_id, v_workspace_id)
  ON CONFLICT DO NOTHING;

  -- Log audit
  INSERT INTO campaign_audit_log (tenant_id, workspace_id, campaign_id, run_id, event_type, actor_id, details)
  VALUES (v_tenant_id, v_workspace_id, p_campaign_id, v_run_id, 'campaign_deployed', v_user_id,
    jsonb_build_object('channel', v_channel, 'run_id', v_run_id, 'job_id', v_job_id, 'provider', 
      CASE v_channel WHEN 'voice' THEN v_voice_provider ELSE null END));

  RETURN jsonb_build_object(
    'success', true, 
    'run_id', v_run_id, 
    'job_id', v_job_id,
    'channel', v_channel,
    'provider', CASE v_channel 
      WHEN 'email' THEN COALESCE(v_email_settings.email_provider, 'resend')
      WHEN 'voice' THEN v_voice_provider
      WHEN 'social' THEN COALESCE(v_social_settings.social_provider, 'internal')
      ELSE 'internal'
    END,
    'message', 'Campaign deployed successfully'
  );
  
  -- NOTE: No exception handler that updates campaign_runs
  -- If INSERT fails, the transaction rolls back cleanly
  -- Edge function is the ONLY writer for status updates after initial insert
END;
$function$;

-- 4) Revoke direct UPDATE on campaign_runs from authenticated role
-- Only service_role and SECURITY DEFINER functions can update
REVOKE UPDATE ON public.campaign_runs FROM authenticated;

-- 5) Grant INSERT to authenticated (for deploy_campaign via its SECURITY DEFINER)
-- deploy_campaign uses SECURITY DEFINER so it runs as owner, not authenticated
-- But we need authenticated to be able to SELECT for reading
GRANT SELECT ON public.campaign_runs TO authenticated;

-- 6) Add comment documenting the single-writer rule
COMMENT ON TABLE public.campaign_runs IS 
'Campaign execution runs. SINGLE WRITER RULE: Only run-job-queue edge function may update status/timestamps via update_campaign_run_status(). deploy_campaign() may INSERT with status=queued only.';

-- 7) Add comment on the update function
COMMENT ON FUNCTION public.update_campaign_run_status IS 
'SECURITY DEFINER function for updating campaign_runs. Called ONLY by run-job-queue edge function via service_role.';
