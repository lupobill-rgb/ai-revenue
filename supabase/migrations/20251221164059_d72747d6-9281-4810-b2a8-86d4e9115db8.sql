-- Fix check_tenant_rate_limit failing when tenant row is missing
-- Preserve existing parameter default (p_amount DEFAULT 1)

CREATE OR REPLACE FUNCTION public.check_tenant_rate_limit(
  p_tenant_id uuid,
  p_channel text,
  p_amount integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits RECORD;
  v_now timestamptz := now();
  v_daily_limit integer;
  v_hourly_limit integer;
  v_daily_used integer;
  v_hourly_used integer;
  v_needs_daily_reset boolean := false;
  v_needs_hourly_reset boolean := false;
BEGIN
  -- Ensure tenant exists (prevents tenant_rate_limits FK violation)
  INSERT INTO tenants (id, slug, name)
  VALUES (
    p_tenant_id,
    'auto-' || substring(p_tenant_id::text, 1, 8),
    'Auto Tenant ' || substring(p_tenant_id::text, 1, 8)
  )
  ON CONFLICT (id) DO NOTHING;

  -- Get or create limits for tenant
  SELECT * INTO v_limits
  FROM tenant_rate_limits
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Create default limits
    INSERT INTO tenant_rate_limits (tenant_id)
    VALUES (p_tenant_id)
    RETURNING * INTO v_limits;
  END IF;

  -- Check if windows need reset
  IF v_now >= v_limits.daily_reset_at THEN
    v_needs_daily_reset := true;
  END IF;

  IF v_now >= v_limits.hourly_reset_at THEN
    v_needs_hourly_reset := true;
  END IF;

  -- Get correct limits based on channel
  IF p_channel = 'email' THEN
    v_daily_limit := v_limits.email_daily_limit;
    v_hourly_limit := v_limits.email_hourly_limit;
    v_daily_used := CASE WHEN v_needs_daily_reset THEN 0 ELSE v_limits.email_daily_used END;
    v_hourly_used := CASE WHEN v_needs_hourly_reset THEN 0 ELSE v_limits.email_hourly_used END;
  ELSIF p_channel = 'voice' THEN
    v_daily_limit := v_limits.voice_daily_minutes;
    v_hourly_limit := v_limits.voice_hourly_minutes;
    v_daily_used := CASE WHEN v_needs_daily_reset THEN 0 ELSE v_limits.voice_daily_minutes_used END;
    v_hourly_used := CASE WHEN v_needs_hourly_reset THEN 0 ELSE v_limits.voice_hourly_minutes_used END;
  ELSE
    RETURN jsonb_build_object('allowed', true, 'reason', 'Channel not rate limited');
  END IF;

  -- Check daily limit
  IF v_daily_used + p_amount > v_daily_limit THEN
    INSERT INTO rate_limit_events (tenant_id, event_type, channel, limit_type, current_usage, limit_value)
    VALUES (p_tenant_id, 'cap_hit', p_channel, 'daily', v_daily_used, v_daily_limit);

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Daily %s limit reached: %s/%s', p_channel, v_daily_used, v_daily_limit),
      'limit_type', 'daily',
      'current_usage', v_daily_used,
      'limit_value', v_daily_limit,
      'resets_at', v_limits.daily_reset_at
    );
  END IF;

  -- Check hourly limit
  IF v_hourly_used + p_amount > v_hourly_limit THEN
    INSERT INTO rate_limit_events (tenant_id, event_type, channel, limit_type, current_usage, limit_value)
    VALUES (p_tenant_id, 'cap_hit', p_channel, 'hourly', v_hourly_used, v_hourly_limit);

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Hourly %s limit reached: %s/%s', p_channel, v_hourly_used, v_hourly_limit),
      'limit_type', 'hourly',
      'current_usage', v_hourly_used,
      'limit_value', v_hourly_limit,
      'resets_at', v_limits.hourly_reset_at
    );
  END IF;

  -- Check warning threshold
  IF v_limits.soft_cap_enabled THEN
    DECLARE
      v_daily_pct integer := (v_daily_used * 100 / NULLIF(v_daily_limit, 0));
      v_hourly_pct integer := (v_hourly_used * 100 / NULLIF(v_hourly_limit, 0));
    BEGIN
      IF v_daily_pct >= v_limits.notify_at_percentage OR v_hourly_pct >= v_limits.notify_at_percentage THEN
        INSERT INTO rate_limit_events (tenant_id, event_type, channel, limit_type, current_usage, limit_value)
        VALUES (p_tenant_id, 'warning_threshold', p_channel,
          CASE WHEN v_daily_pct >= v_limits.notify_at_percentage THEN 'daily' ELSE 'hourly' END,
          CASE WHEN v_daily_pct >= v_limits.notify_at_percentage THEN v_daily_used ELSE v_hourly_used END,
          CASE WHEN v_daily_pct >= v_limits.notify_at_percentage THEN v_daily_limit ELSE v_hourly_limit END);
      END IF;
    END;
  END IF;

  -- Increment usage and reset windows if needed
  IF p_channel = 'email' THEN
    UPDATE tenant_rate_limits
    SET
      email_daily_used = CASE WHEN v_needs_daily_reset THEN p_amount ELSE email_daily_used + p_amount END,
      email_hourly_used = CASE WHEN v_needs_hourly_reset THEN p_amount ELSE email_hourly_used + p_amount END,
      daily_reset_at = CASE WHEN v_needs_daily_reset THEN date_trunc('day', v_now) + interval '1 day' ELSE daily_reset_at END,
      hourly_reset_at = CASE WHEN v_needs_hourly_reset THEN date_trunc('hour', v_now) + interval '1 hour' ELSE hourly_reset_at END,
      updated_at = v_now
    WHERE tenant_id = p_tenant_id;
  ELSIF p_channel = 'voice' THEN
    UPDATE tenant_rate_limits
    SET
      voice_daily_minutes_used = CASE WHEN v_needs_daily_reset THEN p_amount ELSE voice_daily_minutes_used + p_amount END,
      voice_hourly_minutes_used = CASE WHEN v_needs_hourly_reset THEN p_amount ELSE voice_hourly_minutes_used + p_amount END,
      daily_reset_at = CASE WHEN v_needs_daily_reset THEN date_trunc('day', v_now) + interval '1 day' ELSE daily_reset_at END,
      hourly_reset_at = CASE WHEN v_needs_hourly_reset THEN date_trunc('hour', v_now) + interval '1 hour' ELSE hourly_reset_at END,
      updated_at = v_now
    WHERE tenant_id = p_tenant_id;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'daily_remaining', v_daily_limit - v_daily_used - p_amount,
    'hourly_remaining', v_hourly_limit - v_hourly_used - p_amount
  );
END;
$$;