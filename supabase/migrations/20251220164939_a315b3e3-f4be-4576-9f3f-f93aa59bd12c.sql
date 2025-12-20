-- Update deploy_campaign to block unsupported channels (video, landing_page)
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

  -- Get the selected provider for the channel
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

  -- Create campaign_run
  BEGIN
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
          WHEN 'voice' THEN 'vapi'
          WHEN 'social' THEN COALESCE(v_social_settings.social_provider, 'internal')
          ELSE 'internal'
        END
      ), 
      v_user_id
    )
    RETURNING id INTO v_run_id;
  EXCEPTION WHEN others THEN
    INSERT INTO campaign_audit_log (tenant_id, workspace_id, campaign_id, event_type, actor_id, details)
    VALUES (v_tenant_id, v_workspace_id, p_campaign_id, 'launch_failed', v_user_id,
      jsonb_build_object('error', SQLERRM, 'error_code', SQLSTATE));

    RETURN jsonb_build_object('success', false, 'error', 'Failed to create campaign run: ' || SQLERRM, 'error_code', SQLSTATE);
  END;

  -- Create job based on channel with provider info
  BEGIN
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
          WHEN 'voice' THEN 'vapi'
          WHEN 'social' THEN COALESCE(v_social_settings.social_provider, 'internal')
          ELSE 'internal'
        END
      ),
      'queued',
      v_now
    )
    RETURNING id INTO v_job_id;
  EXCEPTION WHEN others THEN
    UPDATE campaign_runs SET status = 'failed', error_message = SQLERRM, error_code = SQLSTATE
    WHERE id = v_run_id;

    RETURN jsonb_build_object('success', false, 'error', 'Failed to create job: ' || SQLERRM);
  END;

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
    jsonb_build_object('channel', v_channel, 'run_id', v_run_id, 'job_id', v_job_id));

  RETURN jsonb_build_object(
    'success', true, 
    'run_id', v_run_id, 
    'job_id', v_job_id,
    'channel', v_channel,
    'message', 'Campaign deployed successfully'
  );
END;
$function$;