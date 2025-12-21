-- UX Contract Enforcement: Database Functions

-- Function to validate campaign completion (requires terminal outbox states)
CREATE OR REPLACE FUNCTION public.validate_campaign_completion(p_run_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM channel_outbox
    WHERE run_id = p_run_id
    AND status IN ('sent', 'failed', 'skipped')
  )
$$;

-- Function to safely complete a campaign run (enforces terminal state requirement)
CREATE OR REPLACE FUNCTION public.complete_campaign_run(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_terminal boolean;
  v_pending_count integer;
  v_terminal_count integer;
BEGIN
  -- Check for terminal states
  SELECT COUNT(*) INTO v_terminal_count
  FROM channel_outbox
  WHERE run_id = p_run_id
  AND status IN ('sent', 'failed', 'skipped');

  -- Check for pending states
  SELECT COUNT(*) INTO v_pending_count
  FROM channel_outbox
  WHERE run_id = p_run_id
  AND status IN ('queued', 'pending', 'processing');

  -- Validate completion is allowed
  IF v_terminal_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot complete: No messages have reached terminal state',
      'terminal_count', v_terminal_count,
      'pending_count', v_pending_count
    );
  END IF;

  IF v_pending_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Cannot complete: %s message(s) still pending', v_pending_count),
      'terminal_count', v_terminal_count,
      'pending_count', v_pending_count
    );
  END IF;

  -- All checks passed, update status
  UPDATE campaign_runs
  SET status = 'completed',
      completed_at = now()
  WHERE id = p_run_id;

  RETURN jsonb_build_object(
    'success', true,
    'terminal_count', v_terminal_count,
    'pending_count', 0
  );
END;
$$;

-- Check launch prerequisites for any campaign/channel combination
CREATE OR REPLACE FUNCTION public.check_campaign_launch_prerequisites(
  p_campaign_id uuid,
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign record;
  v_channel text;
  v_requirements jsonb := '[]'::jsonb;
  v_all_pass boolean := true;
  v_email_settings record;
  v_voice_settings record;
  v_linkedin_settings record;
  v_social_settings record;
BEGIN
  -- Get campaign details (check cmo_campaigns first, then campaigns)
  SELECT 
    COALESCE(cc.id, c.id) as id,
    COALESCE(c.channel, 'email') as channel
  INTO v_campaign
  FROM cmo_campaigns cc
  FULL OUTER JOIN campaigns c ON c.id = cc.id
  WHERE COALESCE(cc.id, c.id) = p_campaign_id
  LIMIT 1;

  IF v_campaign IS NULL THEN
    RETURN jsonb_build_object(
      'pass', false,
      'channel', 'unknown',
      'requirements', jsonb_build_array(
        jsonb_build_object(
          'id', 'campaign_exists',
          'name', 'Campaign Found',
          'pass', false,
          'message', 'Campaign not found'
        )
      )
    );
  END IF;

  v_channel := LOWER(v_campaign.channel);

  -- EMAIL CHANNEL
  IF v_channel = 'email' THEN
    SELECT * INTO v_email_settings
    FROM ai_settings_email
    WHERE tenant_id = p_tenant_id;

    -- Check: Email provider connected
    IF v_email_settings IS NULL OR NOT COALESCE(v_email_settings.is_connected, false) THEN
      v_all_pass := false;
      v_requirements := v_requirements || jsonb_build_array(
        jsonb_build_object(
          'id', 'email_connected',
          'name', 'Email Provider Connected',
          'pass', false,
          'message', 'Please connect your email provider in Settings → Integrations'
        )
      );
    ELSE
      v_requirements := v_requirements || jsonb_build_array(
        jsonb_build_object(
          'id', 'email_connected',
          'name', 'Email Provider Connected',
          'pass', true,
          'message', 'Email provider is connected'
        )
      );
    END IF;

    -- Check: From address configured
    IF v_email_settings IS NULL OR COALESCE(v_email_settings.from_address, '') = '' THEN
      v_all_pass := false;
      v_requirements := v_requirements || jsonb_build_array(
        jsonb_build_object(
          'id', 'from_address',
          'name', 'Sender Address Configured',
          'pass', false,
          'message', 'Please configure a from address in Settings → Integrations → Email'
        )
      );
    ELSE
      v_requirements := v_requirements || jsonb_build_array(
        jsonb_build_object(
          'id', 'from_address',
          'name', 'Sender Address Configured',
          'pass', true,
          'message', format('From address: %s', v_email_settings.from_address)
        )
      );
    END IF;

  -- VOICE CHANNEL
  ELSIF v_channel = 'voice' THEN
    SELECT * INTO v_voice_settings
    FROM ai_settings_voice
    WHERE tenant_id = p_tenant_id;

    -- Check: Voice provider connected
    IF v_voice_settings IS NULL OR NOT COALESCE(v_voice_settings.is_connected, false) THEN
      v_all_pass := false;
      v_requirements := v_requirements || jsonb_build_array(
        jsonb_build_object(
          'id', 'voice_connected',
          'name', 'Voice Provider Connected',
          'pass', false,
          'message', 'Please connect VAPI in Settings → Integrations → Voice'
        )
      );
    ELSE
      v_requirements := v_requirements || jsonb_build_array(
        jsonb_build_object(
          'id', 'voice_connected',
          'name', 'Voice Provider Connected',
          'pass', true,
          'message', 'VAPI is connected'
        )
      );
    END IF;

    -- Check: Phone number assigned
    IF v_voice_settings IS NULL OR v_voice_settings.default_phone_number_id IS NULL THEN
      v_all_pass := false;
      v_requirements := v_requirements || jsonb_build_array(
        jsonb_build_object(
          'id', 'phone_number',
          'name', 'Phone Number Assigned',
          'pass', false,
          'message', 'Please assign a phone number in Settings → Integrations → Voice'
        )
      );
    ELSE
      v_requirements := v_requirements || jsonb_build_array(
        jsonb_build_object(
          'id', 'phone_number',
          'name', 'Phone Number Assigned',
          'pass', true,
          'message', 'Phone number is assigned'
        )
      );
    END IF;

  -- LINKEDIN CHANNEL
  ELSIF v_channel = 'linkedin' THEN
    SELECT * INTO v_linkedin_settings
    FROM ai_settings_linkedin
    WHERE tenant_id = p_tenant_id;

    -- Check: LinkedIn profile configured
    IF v_linkedin_settings IS NULL OR COALESCE(v_linkedin_settings.linkedin_profile_url, '') = '' THEN
      v_all_pass := false;
      v_requirements := v_requirements || jsonb_build_array(
        jsonb_build_object(
          'id', 'linkedin_profile',
          'name', 'LinkedIn Profile Configured',
          'pass', false,
          'message', 'Please configure your LinkedIn profile in Settings → Integrations'
        )
      );
    ELSE
      v_requirements := v_requirements || jsonb_build_array(
        jsonb_build_object(
          'id', 'linkedin_profile',
          'name', 'LinkedIn Profile Configured',
          'pass', true,
          'message', 'LinkedIn profile is configured'
        )
      );
    END IF;

  -- SOCIAL CHANNELS (Instagram, Facebook, Twitter, TikTok) - ALWAYS BLOCKED
  ELSIF v_channel IN ('social', 'instagram', 'facebook', 'twitter', 'tiktok') THEN
    v_all_pass := false;
    v_requirements := v_requirements || jsonb_build_array(
      jsonb_build_object(
        'id', 'social_coming_soon',
        'name', 'Social Integration',
        'pass', false,
        'message', 'Social media integration is Coming Soon. Real provider connections will be available in a future release.'
      )
    );

  -- LANDING PAGES
  ELSIF v_channel = 'landing_page' OR v_channel = 'landing' THEN
    -- Check: Asset exists and is published
    IF NOT EXISTS (
      SELECT 1 FROM assets
      WHERE id = p_campaign_id
      AND status = 'approved'
    ) THEN
      v_all_pass := false;
      v_requirements := v_requirements || jsonb_build_array(
        jsonb_build_object(
          'id', 'landing_published',
          'name', 'Landing Page Published',
          'pass', false,
          'message', 'Landing page must be approved before launching'
        )
      );
    ELSE
      v_requirements := v_requirements || jsonb_build_array(
        jsonb_build_object(
          'id', 'landing_published',
          'name', 'Landing Page Published',
          'pass', true,
          'message', 'Landing page is published'
        )
      );
    END IF;

  -- UNKNOWN CHANNEL
  ELSE
    v_requirements := v_requirements || jsonb_build_array(
      jsonb_build_object(
        'id', 'channel_supported',
        'name', 'Channel Supported',
        'pass', true,
        'message', format('Channel: %s', v_channel)
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'pass', v_all_pass,
    'channel', v_channel,
    'requirements', v_requirements
  );
END;
$$;

-- Trigger to auto-complete campaign runs when all outbox entries are terminal
CREATE OR REPLACE FUNCTION public.check_run_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_count integer;
  v_terminal_count integer;
BEGIN
  -- Only check if status changed to terminal
  IF NEW.status NOT IN ('sent', 'failed', 'skipped') THEN
    RETURN NEW;
  END IF;

  -- Count pending and terminal for this run
  SELECT 
    COUNT(*) FILTER (WHERE status IN ('queued', 'pending', 'processing')),
    COUNT(*) FILTER (WHERE status IN ('sent', 'failed', 'skipped'))
  INTO v_pending_count, v_terminal_count
  FROM channel_outbox
  WHERE run_id = NEW.run_id;

  -- If no pending and has terminal, mark run as completed
  IF v_pending_count = 0 AND v_terminal_count > 0 THEN
    UPDATE campaign_runs
    SET status = 'completed',
        completed_at = now()
    WHERE id = NEW.run_id
    AND status NOT IN ('completed', 'cancelled');
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on channel_outbox
DROP TRIGGER IF EXISTS trigger_check_run_completion ON channel_outbox;
CREATE TRIGGER trigger_check_run_completion
AFTER UPDATE OF status ON channel_outbox
FOR EACH ROW
EXECUTE FUNCTION check_run_completion();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.validate_campaign_completion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_campaign_run(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_campaign_launch_prerequisites(uuid, uuid) TO authenticated;