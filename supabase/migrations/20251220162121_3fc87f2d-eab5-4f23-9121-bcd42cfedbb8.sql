-- Modify campaign_runs to add missing columns
ALTER TABLE public.campaign_runs 
ADD COLUMN IF NOT EXISTS channel text,
ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
ADD COLUMN IF NOT EXISTS error_code text,
ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by uuid;
-- Drop old constraint and add new one with all statuses
ALTER TABLE public.campaign_runs DROP CONSTRAINT IF EXISTS campaign_runs_status_check;
ALTER TABLE public.campaign_runs ADD CONSTRAINT campaign_runs_status_check 
  CHECK (status IN ('queued', 'pending', 'running', 'completed', 'failed', 'partial', 'paused'));
-- Create job_queue table
CREATE TABLE IF NOT EXISTS public.job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  run_id uuid REFERENCES public.campaign_runs(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_queue_status_check CHECK (status IN ('queued', 'locked', 'running', 'completed', 'failed', 'dead'))
);
-- Create channel_outbox table
CREATE TABLE IF NOT EXISTS public.channel_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  run_id uuid REFERENCES public.campaign_runs(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.job_queue(id) ON DELETE SET NULL,
  channel text NOT NULL,
  provider text NOT NULL,
  recipient_id uuid,
  recipient_email text,
  recipient_phone text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  provider_response jsonb DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channel_outbox_status_check CHECK (status IN ('queued', 'sent', 'posted', 'called', 'failed'))
);
-- Create audit_log table for campaign execution events
CREATE TABLE IF NOT EXISTS public.campaign_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  campaign_id uuid,
  run_id uuid,
  job_id uuid,
  event_type text NOT NULL,
  actor_id uuid,
  actor_type text DEFAULT 'user',
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_queue_status_scheduled ON public.job_queue(status, scheduled_for) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_job_queue_run_id ON public.job_queue(run_id);
CREATE INDEX IF NOT EXISTS idx_channel_outbox_run_id ON public.channel_outbox(run_id);
CREATE INDEX IF NOT EXISTS idx_channel_outbox_job_id ON public.channel_outbox(job_id);
CREATE INDEX IF NOT EXISTS idx_campaign_audit_log_campaign ON public.campaign_audit_log(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_audit_log_run ON public.campaign_audit_log(run_id);
-- Enable RLS on all tables
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_audit_log ENABLE ROW LEVEL SECURITY;
-- RLS Policies for job_queue
CREATE POLICY "workspace_access_select" ON public.job_queue FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_access_insert" ON public.job_queue FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_access_update" ON public.job_queue FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_access_delete" ON public.job_queue FOR DELETE USING (user_has_workspace_access(workspace_id));
-- RLS Policies for channel_outbox
CREATE POLICY "workspace_access_select" ON public.channel_outbox FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_access_insert" ON public.channel_outbox FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_access_update" ON public.channel_outbox FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_access_delete" ON public.channel_outbox FOR DELETE USING (user_has_workspace_access(workspace_id));
-- RLS Policies for campaign_audit_log
CREATE POLICY "workspace_access_select" ON public.campaign_audit_log FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_access_insert" ON public.campaign_audit_log FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
-- Update deploy_campaign function to use new pipeline
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
  v_job_id uuid;
  v_user_id uuid;
  v_now timestamptz := now();
  v_channel text;
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

  -- Create campaign_run
  BEGIN
    INSERT INTO campaign_runs (
      tenant_id, workspace_id, campaign_id, channel, status,
      scheduled_for, started_at, run_config, created_by
    ) VALUES (
      v_tenant_id, v_workspace_id, p_campaign_id, v_channel, 'queued',
      v_now, NULL, jsonb_build_object('deployed_by', v_user_id), v_user_id
    )
    RETURNING id INTO v_run_id;
  EXCEPTION WHEN others THEN
    -- Log error
    INSERT INTO campaign_audit_log (tenant_id, workspace_id, campaign_id, event_type, actor_id, details)
    VALUES (v_tenant_id, v_workspace_id, p_campaign_id, 'launch_failed', v_user_id,
      jsonb_build_object('error', SQLERRM, 'error_code', SQLSTATE));

    RETURN jsonb_build_object('success', false, 'error', 'Failed to create campaign run: ' || SQLERRM, 'error_code', SQLSTATE);
  END;

  -- Create job based on channel
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
      jsonb_build_object('campaign_id', p_campaign_id, 'channel', v_channel),
      'queued',
      v_now
    )
    RETURNING id INTO v_job_id;
  EXCEPTION WHEN others THEN
    -- Update run to failed
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
  INSERT INTO campaign_metrics (campaign_id, workspace_id, impressions, clicks, conversions, revenue, cost, last_synced_at)
  VALUES (p_campaign_id, v_workspace_id, 0, 0, 0, 0, 0, v_now)
  ON CONFLICT (campaign_id) DO UPDATE SET last_synced_at = v_now;

  -- Audit log
  INSERT INTO campaign_audit_log (tenant_id, workspace_id, campaign_id, run_id, job_id, event_type, actor_id, details)
  VALUES (v_tenant_id, v_workspace_id, p_campaign_id, v_run_id, v_job_id, 'campaign_launched', v_user_id,
    jsonb_build_object('channel', v_channel, 'scheduled_for', v_now));

  RETURN jsonb_build_object(
    'success', true, 'run_id', v_run_id, 'job_id', v_job_id,
    'campaign_id', p_campaign_id, 'channel', v_channel, 'scheduled_for', v_now
  );
END;
$$;
-- Function to lock and fetch jobs for processing
CREATE OR REPLACE FUNCTION public.claim_queued_jobs(p_worker_id text, p_limit integer DEFAULT 10)
RETURNS SETOF job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE job_queue
  SET status = 'locked', locked_at = now(), locked_by = p_worker_id, updated_at = now()
  WHERE id IN (
    SELECT id FROM job_queue
    WHERE status = 'queued' AND scheduled_for <= now()
    ORDER BY scheduled_for ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;
-- Function to complete a job
CREATE OR REPLACE FUNCTION public.complete_job(p_job_id uuid, p_success boolean, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job RECORD;
  v_new_status text;
BEGIN
  SELECT * INTO v_job FROM job_queue WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_success THEN
    v_new_status := 'completed';
  ELSIF v_job.attempts >= 2 THEN
    v_new_status := 'dead';
  ELSE
    v_new_status := 'failed';
  END IF;

  UPDATE job_queue
  SET status = v_new_status,
      attempts = attempts + 1,
      last_error = CASE WHEN NOT p_success THEN p_error ELSE NULL END,
      locked_at = NULL,
      locked_by = NULL,
      updated_at = now()
  WHERE id = p_job_id;

  -- Update campaign_run status based on job completion
  IF v_new_status = 'completed' THEN
    UPDATE campaign_runs SET status = 'completed', completed_at = now() WHERE id = v_job.run_id;
  ELSIF v_new_status = 'dead' THEN
    UPDATE campaign_runs SET status = 'failed', error_message = p_error, completed_at = now() WHERE id = v_job.run_id;
  END IF;
END;
$$;
-- Function to retry a failed job
CREATE OR REPLACE FUNCTION public.retry_job(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  
  UPDATE campaign_runs SET status = 'queued' WHERE id = v_job.run_id;
  
  RETURN TRUE;
END;
$$;
