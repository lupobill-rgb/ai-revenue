-- Fix deploy_campaign to use a valid campaign_runs.status value
CREATE OR REPLACE FUNCTION public.deploy_campaign(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_campaign RECORD;
  v_tenant_id uuid;
  v_workspace_id uuid;
  v_run_id uuid;
  v_user_id uuid;
  v_now timestamptz := now();
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

  -- 1) Create campaign_run first
  BEGIN
    INSERT INTO campaign_runs (
      tenant_id,
      workspace_id,
      campaign_id,
      status,
      started_at,
      run_config
    ) VALUES (
      v_tenant_id,
      v_workspace_id,
      p_campaign_id,
      'pending',
      v_now,
      jsonb_build_object('channel', v_campaign.channel, 'deployed_by', v_user_id)
    )
    RETURNING id INTO v_run_id;
  EXCEPTION WHEN others THEN
    INSERT INTO agent_runs (
      tenant_id, workspace_id, agent, mode, status, error_message, input, completed_at, duration_ms
    ) VALUES (
      v_tenant_id, v_workspace_id, 'deploy_campaign', 'execution', 'failed',
      SQLERRM,
      jsonb_build_object('campaign_id', p_campaign_id, 'user_id', v_user_id, 'error_code', SQLSTATE),
      v_now, 0
    );

    RETURN jsonb_build_object('success', false, 'error', 'Failed to create campaign run: ' || SQLERRM);
  END;

  -- 2) Only after run is created, mark campaign deployed + locked
  UPDATE campaigns
  SET 
    status = 'deployed',
    deployed_at = v_now,
    is_locked = true,
    locked_at = v_now,
    locked_reason = 'Campaign deployed - create new version to edit'
  WHERE id = p_campaign_id;

  -- 3) Initialize campaign_metrics with zeros
  INSERT INTO campaign_metrics (
    campaign_id,
    workspace_id,
    impressions,
    clicks,
    conversions,
    revenue,
    cost,
    last_synced_at
  ) VALUES (
    p_campaign_id,
    v_workspace_id,
    0, 0, 0, 0, 0,
    v_now
  )
  ON CONFLICT (campaign_id) DO UPDATE SET
    last_synced_at = v_now;

  -- 4) Audit success
  INSERT INTO agent_runs (
    tenant_id,
    workspace_id,
    agent,
    mode,
    status,
    input,
    output,
    completed_at,
    duration_ms
  ) VALUES (
    v_tenant_id,
    v_workspace_id,
    'deploy_campaign',
    'execution',
    'completed',
    jsonb_build_object('campaign_id', p_campaign_id, 'user_id', v_user_id),
    jsonb_build_object('run_id', v_run_id, 'deployed_at', v_now),
    v_now,
    0
  );

  RETURN jsonb_build_object(
    'success', true,
    'run_id', v_run_id,
    'campaign_id', p_campaign_id,
    'deployed_at', v_now
  );
END;
$$;