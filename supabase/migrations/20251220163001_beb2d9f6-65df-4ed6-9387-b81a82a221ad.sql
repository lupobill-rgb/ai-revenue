-- Add provider selection columns to ai_settings tables
ALTER TABLE public.ai_settings_email 
ADD COLUMN IF NOT EXISTS email_provider text DEFAULT 'resend' CHECK (email_provider IN ('resend', 'gmail', 'smtp')),
ADD COLUMN IF NOT EXISTS is_connected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_tested_at timestamptz,
ADD COLUMN IF NOT EXISTS last_test_result jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.ai_settings_voice 
ADD COLUMN IF NOT EXISTS voice_provider text DEFAULT 'vapi' CHECK (voice_provider IN ('vapi')),
ADD COLUMN IF NOT EXISTS default_phone_number_id uuid,
ADD COLUMN IF NOT EXISTS is_connected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_tested_at timestamptz,
ADD COLUMN IF NOT EXISTS last_test_result jsonb DEFAULT '{}'::jsonb;
-- Create social settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ai_settings_social (
  tenant_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  social_provider text CHECK (social_provider IN ('linkedin', 'twitter', 'facebook', 'coming_soon')),
  is_connected boolean DEFAULT false,
  account_name text,
  account_url text,
  last_tested_at timestamptz,
  last_test_result jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);
-- Enable RLS on social settings
ALTER TABLE public.ai_settings_social ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_access_select" ON public.ai_settings_social FOR SELECT 
USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_insert" ON public.ai_settings_social FOR INSERT 
WITH CHECK (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_update" ON public.ai_settings_social FOR UPDATE 
USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_delete" ON public.ai_settings_social FOR DELETE 
USING (user_has_workspace_access(tenant_id));
-- Create launch prerequisites check function
CREATE OR REPLACE FUNCTION public.check_campaign_launch_prerequisites(
  p_campaign_id uuid,
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_campaign RECORD;
  v_channel text;
  v_requirements jsonb := '[]'::jsonb;
  v_email_settings RECORD;
  v_voice_settings RECORD;
  v_social_settings RECORD;
  v_all_pass boolean := true;
BEGIN
  -- Get campaign
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('pass', false, 'error', 'Campaign not found', 'requirements', '[]'::jsonb);
  END IF;
  
  v_channel := COALESCE(v_campaign.channel, 'email');
  
  -- Check email prerequisites
  IF v_channel = 'email' OR v_channel ILIKE '%email%' THEN
    SELECT * INTO v_email_settings FROM ai_settings_email WHERE tenant_id = p_tenant_id;
    
    -- Requirement 1: Provider selected
    IF v_email_settings.email_provider IS NULL THEN
      v_requirements := v_requirements || jsonb_build_object(
        'id', 'email_provider',
        'name', 'Email Provider Selected',
        'pass', false,
        'message', 'Select an email provider (Resend, Gmail, or SMTP)'
      );
      v_all_pass := false;
    ELSE
      v_requirements := v_requirements || jsonb_build_object(
        'id', 'email_provider',
        'name', 'Email Provider Selected',
        'pass', true,
        'message', 'Using ' || v_email_settings.email_provider
      );
    END IF;
    
    -- Requirement 2: Provider connected
    IF NOT COALESCE(v_email_settings.is_connected, false) THEN
      v_requirements := v_requirements || jsonb_build_object(
        'id', 'email_connected',
        'name', 'Email Provider Connected',
        'pass', false,
        'message', 'Test connection to verify provider is configured correctly'
      );
      v_all_pass := false;
    ELSE
      v_requirements := v_requirements || jsonb_build_object(
        'id', 'email_connected',
        'name', 'Email Provider Connected',
        'pass', true,
        'message', 'Last tested: ' || COALESCE(to_char(v_email_settings.last_tested_at, 'YYYY-MM-DD HH24:MI'), 'Unknown')
      );
    END IF;
    
    -- Requirement 3: From address configured
    IF v_email_settings.from_address IS NULL OR v_email_settings.from_address = '' THEN
      v_requirements := v_requirements || jsonb_build_object(
        'id', 'email_from_address',
        'name', 'From Address Configured',
        'pass', false,
        'message', 'Set a from email address'
      );
      v_all_pass := false;
    ELSE
      v_requirements := v_requirements || jsonb_build_object(
        'id', 'email_from_address',
        'name', 'From Address Configured',
        'pass', true,
        'message', v_email_settings.from_address
      );
    END IF;
  END IF;
  
  -- Check voice prerequisites
  IF v_channel = 'voice' OR v_channel ILIKE '%voice%' THEN
    SELECT * INTO v_voice_settings FROM ai_settings_voice WHERE tenant_id = p_tenant_id;
    
    -- Requirement 1: Provider selected
    IF v_voice_settings.voice_provider IS NULL THEN
      v_requirements := v_requirements || jsonb_build_object(
        'id', 'voice_provider',
        'name', 'Voice Provider Selected',
        'pass', false,
        'message', 'Select a voice provider'
      );
      v_all_pass := false;
    ELSE
      v_requirements := v_requirements || jsonb_build_object(
        'id', 'voice_provider',
        'name', 'Voice Provider Selected',
        'pass', true,
        'message', 'Using ' || v_voice_settings.voice_provider
      );
    END IF;
    
    -- Requirement 2: Default phone number
    IF v_voice_settings.default_phone_number_id IS NULL THEN
      v_requirements := v_requirements || jsonb_build_object(
        'id', 'voice_phone_number',
        'name', 'Default Phone Number',
        'pass', false,
        'message', 'Select a default phone number for outbound calls'
      );
      v_all_pass := false;
    ELSE
      v_requirements := v_requirements || jsonb_build_object(
        'id', 'voice_phone_number',
        'name', 'Default Phone Number',
        'pass', true,
        'message', 'Phone number configured'
      );
    END IF;
    
    -- Requirement 3: Provider connected
    IF NOT COALESCE(v_voice_settings.is_connected, false) THEN
      v_requirements := v_requirements || jsonb_build_object(
        'id', 'voice_connected',
        'name', 'Voice Provider Connected',
        'pass', false,
        'message', 'Test connection to verify voice provider is configured'
      );
      v_all_pass := false;
    ELSE
      v_requirements := v_requirements || jsonb_build_object(
        'id', 'voice_connected',
        'name', 'Voice Provider Connected',
        'pass', true,
        'message', 'Last tested: ' || COALESCE(to_char(v_voice_settings.last_tested_at, 'YYYY-MM-DD HH24:MI'), 'Unknown')
      );
    END IF;
  END IF;
  
  -- Check social prerequisites
  IF v_channel = 'social' OR v_channel ILIKE '%social%' THEN
    SELECT * INTO v_social_settings FROM ai_settings_social WHERE tenant_id = p_tenant_id;
    
    -- Social is not fully implemented
    IF v_social_settings.social_provider IS NULL OR v_social_settings.social_provider = 'coming_soon' THEN
      v_requirements := v_requirements || jsonb_build_object(
        'id', 'social_provider',
        'name', 'Social Provider',
        'pass', false,
        'message', 'Social posting is coming soon. This channel cannot be launched yet.'
      );
      v_all_pass := false;
    ELSIF NOT COALESCE(v_social_settings.is_connected, false) THEN
      v_requirements := v_requirements || jsonb_build_object(
        'id', 'social_connected',
        'name', 'Social Provider Connected',
        'pass', false,
        'message', 'Connect your social account to enable posting'
      );
      v_all_pass := false;
    ELSE
      v_requirements := v_requirements || jsonb_build_object(
        'id', 'social_connected',
        'name', 'Social Provider Connected',
        'pass', true,
        'message', 'Connected to ' || v_social_settings.account_name
      );
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'pass', v_all_pass,
    'channel', v_channel,
    'requirements', v_requirements
  );
END;
$$;
-- Update deploy_campaign to check prerequisites first
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
  v_prerequisites jsonb;
  v_email_settings RECORD;
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
  INSERT INTO campaign_metrics (campaign_id, workspace_id, impressions, clicks, conversions, revenue, cost, last_synced_at)
  VALUES (p_campaign_id, v_workspace_id, 0, 0, 0, 0, 0, v_now)
  ON CONFLICT (campaign_id) DO UPDATE SET last_synced_at = v_now;

  -- Audit log
  INSERT INTO campaign_audit_log (tenant_id, workspace_id, campaign_id, run_id, job_id, event_type, actor_id, details)
  VALUES (v_tenant_id, v_workspace_id, p_campaign_id, v_run_id, v_job_id, 'campaign_launched', v_user_id,
    jsonb_build_object('channel', v_channel, 'scheduled_for', v_now, 'prerequisites', v_prerequisites));

  RETURN jsonb_build_object(
    'success', true, 'run_id', v_run_id, 'job_id', v_job_id,
    'campaign_id', p_campaign_id, 'channel', v_channel, 'scheduled_for', v_now,
    'prerequisites', v_prerequisites
  );
END;
$$;
