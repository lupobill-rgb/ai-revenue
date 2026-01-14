-- Create RPC function to validate campaign integrations before activation
CREATE OR REPLACE FUNCTION public.validate_campaign_integrations(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_campaign record;
  v_errors text[] := '{}';
  v_email_settings record;
  v_linkedin_settings record;
  v_calendar_settings record;
  v_crm_settings record;
  v_has_booking_step boolean := false;
  v_has_email_channel boolean := false;
  v_has_linkedin_channel boolean := false;
  v_crm_required boolean := false;
BEGIN
  -- Get the campaign and tenant_id
  SELECT * INTO v_campaign
  FROM outbound_campaigns
  WHERE id = p_campaign_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'errors', ARRAY['Campaign not found']);
  END IF;
  
  v_tenant_id := v_campaign.tenant_id;
  
  -- Check if campaign channel includes email
  IF v_campaign.channel = 'email' OR v_campaign.channel ILIKE '%email%' THEN
    v_has_email_channel := true;
  END IF;
  
  -- Check if campaign channel includes linkedin
  IF v_campaign.channel = 'linkedin' OR v_campaign.channel ILIKE '%linkedin%' THEN
    v_has_linkedin_channel := true;
  END IF;
  
  -- Check for booking steps in sequences
  SELECT EXISTS (
    SELECT 1 
    FROM outbound_sequences os
    JOIN outbound_sequence_steps oss ON oss.sequence_id = os.id
    WHERE os.campaign_id = p_campaign_id
      AND oss.step_type = 'booking'
  ) INTO v_has_booking_step;
  
  -- Check if CRM is required from config
  IF v_campaign.config IS NOT NULL AND (v_campaign.config->>'crm_required')::boolean = true THEN
    v_crm_required := true;
  END IF;
  
  -- Validate Email Settings
  IF v_has_email_channel THEN
    SELECT * INTO v_email_settings
    FROM ai_settings_email
    WHERE tenant_id = v_tenant_id;
    
    IF NOT FOUND THEN
      v_errors := array_append(v_errors, 'Email settings not configured. Please set up email integration.');
    ELSE
      IF v_email_settings.sender_name IS NULL OR v_email_settings.sender_name = '' THEN
        v_errors := array_append(v_errors, 'Missing email sender name');
      END IF;
      IF v_email_settings.from_address IS NULL OR v_email_settings.from_address = '' THEN
        v_errors := array_append(v_errors, 'Missing email from address');
      END IF;
      IF v_email_settings.reply_to_address IS NULL OR v_email_settings.reply_to_address = '' THEN
        v_errors := array_append(v_errors, 'Missing email reply-to address');
      END IF;
    END IF;
  END IF;
  
  -- Validate LinkedIn Settings
  IF v_has_linkedin_channel THEN
    SELECT * INTO v_linkedin_settings
    FROM ai_settings_linkedin
    WHERE tenant_id = v_tenant_id;
    
    IF NOT FOUND THEN
      v_errors := array_append(v_errors, 'LinkedIn settings not configured. Please set up LinkedIn integration.');
    ELSIF v_linkedin_settings.linkedin_profile_url IS NULL OR v_linkedin_settings.linkedin_profile_url = '' THEN
      v_errors := array_append(v_errors, 'Missing LinkedIn profile URL');
    END IF;
  END IF;
  
  -- Validate Calendar Settings for booking steps
  IF v_has_booking_step THEN
    SELECT * INTO v_calendar_settings
    FROM ai_settings_calendar
    WHERE tenant_id = v_tenant_id;
    
    IF NOT FOUND THEN
      v_errors := array_append(v_errors, 'Calendar settings not configured. Required for booking steps.');
    ELSIF v_calendar_settings.booking_url IS NULL OR v_calendar_settings.booking_url = '' THEN
      v_errors := array_append(v_errors, 'Missing booking URL. Required for booking steps.');
    END IF;
  END IF;
  
  -- Validate CRM Webhook Settings
  IF v_crm_required THEN
    SELECT * INTO v_crm_settings
    FROM ai_settings_crm_webhooks
    WHERE tenant_id = v_tenant_id;
    
    IF NOT FOUND THEN
      v_errors := array_append(v_errors, 'CRM webhook settings not configured');
    ELSIF v_crm_settings.outbound_webhook_url IS NULL OR v_crm_settings.outbound_webhook_url = '' THEN
      v_errors := array_append(v_errors, 'Missing CRM outbound webhook URL');
    END IF;
  END IF;
  
  -- Return result
  IF array_length(v_errors, 1) IS NULL OR array_length(v_errors, 1) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'errors', '[]'::jsonb);
  ELSE
    RETURN jsonb_build_object('ok', false, 'errors', to_jsonb(v_errors));
  END IF;
END;
$$;
