-- Section A: Create errors_email_webhook table with service-role-only RLS
CREATE TABLE IF NOT EXISTS errors_email_webhook (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  provider_event_id text,
  provider_message_id text,
  provider_type text,
  error_type text NOT NULL,
  error_message text NOT NULL,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE errors_email_webhook ENABLE ROW LEVEL SECURITY;

-- Block all user access - only service role can access
CREATE POLICY "errors internal only"
  ON errors_email_webhook
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Section C: Add event type normalization fields to email_events
ALTER TABLE email_events 
  ADD COLUMN IF NOT EXISTS event_type_internal text,
  ADD COLUMN IF NOT EXISTS provider_event_type text;

-- Section D: Create optimizer_configs table for weighting + versioning
CREATE TABLE IF NOT EXISTS optimizer_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  channel text NOT NULL,
  reply_weight numeric NOT NULL DEFAULT 3,
  click_weight numeric NOT NULL DEFAULT 2,
  open_weight numeric NOT NULL DEFAULT 1,
  prompt_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE optimizer_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON optimizer_configs
  FOR ALL
  USING ((tenant_id = auth.uid()) OR (tenant_id IN (
    SELECT user_tenants.tenant_id FROM user_tenants WHERE user_tenants.user_id = auth.uid()
  )));

-- Add unique constraint for tenant+channel
CREATE UNIQUE INDEX IF NOT EXISTS optimizer_configs_tenant_channel_idx 
  ON optimizer_configs (tenant_id, channel);

-- Section E: RPC to rebuild historical stats
CREATE OR REPLACE FUNCTION rebuild_campaign_daily_stats(
  _tenant_id uuid,
  _date_from date,
  _date_to date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Delete existing stats for the date range
  DELETE FROM campaign_channel_stats_daily
  WHERE tenant_id = _tenant_id
    AND day BETWEEN _date_from AND _date_to
    AND channel = 'email';

  -- Rebuild from email_events using internal event types
  INSERT INTO campaign_channel_stats_daily (
    tenant_id,
    campaign_id,
    channel,
    day,
    deliveries,
    opens,
    clicks,
    replies,
    sends,
    bounces
  )
  SELECT
    tenant_id,
    campaign_id,
    'email',
    occurred_at::date,
    COUNT(*) FILTER (WHERE event_type_internal = 'delivered'),
    COUNT(*) FILTER (WHERE event_type_internal = 'opened'),
    COUNT(*) FILTER (WHERE event_type_internal = 'clicked'),
    COUNT(*) FILTER (WHERE event_type_internal = 'replied'),
    COUNT(*) FILTER (WHERE event_type_internal = 'sent'),
    COUNT(*) FILTER (WHERE event_type_internal = 'bounced')
  FROM email_events
  WHERE tenant_id = _tenant_id
    AND occurred_at::date BETWEEN _date_from AND _date_to
    AND campaign_id IS NOT NULL
  GROUP BY tenant_id, campaign_id, occurred_at::date;
END;
$$;