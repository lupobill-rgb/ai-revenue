-- Daily rollup for campaign channel stats including replies
CREATE TABLE public.campaign_channel_stats_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email','sms','voice','landing','linkedin')),
  day date NOT NULL,
  sends integer NOT NULL DEFAULT 0,
  deliveries integer NOT NULL DEFAULT 0,
  opens integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  replies integer NOT NULL DEFAULT 0,
  bounces integer NOT NULL DEFAULT 0,
  meetings_booked integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, campaign_id, channel, day)
);

-- Enable RLS with tenant isolation pattern
ALTER TABLE public.campaign_channel_stats_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.campaign_channel_stats_daily
FOR ALL
USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
);

-- Indexes for analytics queries
CREATE INDEX idx_campaign_stats_tenant ON public.campaign_channel_stats_daily(tenant_id);
CREATE INDEX idx_campaign_stats_campaign ON public.campaign_channel_stats_daily(campaign_id);
CREATE INDEX idx_campaign_stats_day ON public.campaign_channel_stats_daily(day DESC);
CREATE INDEX idx_campaign_stats_channel ON public.campaign_channel_stats_daily(channel);

-- Composite index for common queries
CREATE INDEX idx_campaign_stats_lookup ON public.campaign_channel_stats_daily(campaign_id, channel, day DESC);

-- Function to upsert daily stats atomically
CREATE OR REPLACE FUNCTION public.upsert_campaign_daily_stat(
  p_tenant_id uuid,
  p_campaign_id uuid,
  p_channel text,
  p_day date,
  p_stat_type text, -- 'sends', 'deliveries', 'opens', 'clicks', 'replies', 'bounces', 'meetings_booked'
  p_increment integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO campaign_channel_stats_daily (
    tenant_id, campaign_id, channel, day,
    sends, deliveries, opens, clicks, replies, bounces, meetings_booked
  )
  VALUES (
    p_tenant_id, p_campaign_id, p_channel, p_day,
    CASE WHEN p_stat_type = 'sends' THEN p_increment ELSE 0 END,
    CASE WHEN p_stat_type = 'deliveries' THEN p_increment ELSE 0 END,
    CASE WHEN p_stat_type = 'opens' THEN p_increment ELSE 0 END,
    CASE WHEN p_stat_type = 'clicks' THEN p_increment ELSE 0 END,
    CASE WHEN p_stat_type = 'replies' THEN p_increment ELSE 0 END,
    CASE WHEN p_stat_type = 'bounces' THEN p_increment ELSE 0 END,
    CASE WHEN p_stat_type = 'meetings_booked' THEN p_increment ELSE 0 END
  )
  ON CONFLICT (tenant_id, campaign_id, channel, day)
  DO UPDATE SET
    sends = campaign_channel_stats_daily.sends + CASE WHEN p_stat_type = 'sends' THEN p_increment ELSE 0 END,
    deliveries = campaign_channel_stats_daily.deliveries + CASE WHEN p_stat_type = 'deliveries' THEN p_increment ELSE 0 END,
    opens = campaign_channel_stats_daily.opens + CASE WHEN p_stat_type = 'opens' THEN p_increment ELSE 0 END,
    clicks = campaign_channel_stats_daily.clicks + CASE WHEN p_stat_type = 'clicks' THEN p_increment ELSE 0 END,
    replies = campaign_channel_stats_daily.replies + CASE WHEN p_stat_type = 'replies' THEN p_increment ELSE 0 END,
    bounces = campaign_channel_stats_daily.bounces + CASE WHEN p_stat_type = 'bounces' THEN p_increment ELSE 0 END,
    meetings_booked = campaign_channel_stats_daily.meetings_booked + CASE WHEN p_stat_type = 'meetings_booked' THEN p_increment ELSE 0 END,
    updated_at = now();
END;
$$;