-- Add metrics_mode to tenants table (defaults to 'real', can be 'demo')
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS metrics_mode text NOT NULL DEFAULT 'real'
CHECK (metrics_mode IN ('real', 'demo'));

-- Create deploy_campaign RPC function with SECURITY DEFINER
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
  v_user_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get campaign details
  SELECT c.id, c.workspace_id, c.status, c.is_locked, c.channel, w.owner_id
  INTO v_campaign
  FROM campaigns c
  JOIN workspaces w ON w.id = c.workspace_id
  WHERE c.id = p_campaign_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campaign not found');
  END IF;

  v_workspace_id := v_campaign.workspace_id;

  -- Verify user has workspace access
  IF NOT user_has_workspace_access(v_workspace_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied - not a workspace member');
  END IF;

  -- Check if already deployed/locked
  IF v_campaign.is_locked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campaign is locked - create a new version to edit');
  END IF;

  -- Get tenant_id from user_tenants
  SELECT tenant_id INTO v_tenant_id
  FROM user_tenants
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tenant found for user');
  END IF;

  -- Update campaign to deployed + locked
  UPDATE campaigns
  SET 
    status = 'deployed',
    deployed_at = now(),
    is_locked = true,
    locked_at = now(),
    locked_reason = 'Campaign deployed - create new version to edit'
  WHERE id = p_campaign_id;

  -- Create campaign_run record
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
    'queued',
    now(),
    jsonb_build_object('channel', v_campaign.channel, 'deployed_by', v_user_id)
  )
  RETURNING id INTO v_run_id;

  -- Initialize campaign_metrics with zeros
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
    now()
  )
  ON CONFLICT (campaign_id) DO UPDATE SET
    last_synced_at = now();

  -- Log to agent_runs for audit
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
    jsonb_build_object('run_id', v_run_id, 'deployed_at', now()),
    now(),
    0
  );

  RETURN jsonb_build_object(
    'success', true,
    'run_id', v_run_id,
    'campaign_id', p_campaign_id,
    'deployed_at', now()
  );
END;
$function$;

-- Create function to get tenant metrics mode
CREATE OR REPLACE FUNCTION public.get_tenant_metrics_mode(p_tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(metrics_mode, 'real')
  FROM tenants
  WHERE id = p_tenant_id
$function$;