-- Add data_mode to impressions/clicks tables
ALTER TABLE IF EXISTS campaign_channel_stats_daily 
  ADD COLUMN IF NOT EXISTS data_mode data_mode NOT NULL DEFAULT 'live';

ALTER TABLE IF EXISTS cmo_metrics_snapshots 
  ADD COLUMN IF NOT EXISTS data_mode data_mode NOT NULL DEFAULT 'live';

ALTER TABLE IF EXISTS channel_spend_daily 
  ADD COLUMN IF NOT EXISTS data_mode data_mode NOT NULL DEFAULT 'live';

-- Create indexes for efficient mode filtering
CREATE INDEX IF NOT EXISTS idx_stats_daily_tenant_mode 
  ON campaign_channel_stats_daily (tenant_id, data_mode);

CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_tenant_mode 
  ON cmo_metrics_snapshots (tenant_id, data_mode);

CREATE INDEX IF NOT EXISTS idx_channel_spend_tenant_mode 
  ON channel_spend_daily (tenant_id, data_mode);

-- Create single source of truth view for impressions/clicks
CREATE OR REPLACE VIEW v_impressions_clicks_by_workspace AS
WITH ws AS (
  SELECT id AS workspace_id, tenant_id, demo_mode
  FROM workspaces
),
mode AS (
  SELECT workspace_id, tenant_id,
         CASE WHEN demo_mode THEN 'demo'::data_mode ELSE 'live'::data_mode END AS mode
  FROM ws
),
-- Aggregate from campaign_channel_stats_daily (email clicks/opens)
email_stats AS (
  SELECT 
    s.tenant_id,
    m.workspace_id,
    SUM(s.clicks) AS email_clicks,
    SUM(s.opens) AS email_opens,
    SUM(s.sends) AS email_sends
  FROM campaign_channel_stats_daily s
  JOIN mode m ON m.tenant_id = s.tenant_id AND m.mode = s.data_mode
  WHERE s.channel = 'email'
  GROUP BY s.tenant_id, m.workspace_id
),
-- Aggregate from channel_spend_daily (paid ads impressions/clicks)
paid_stats AS (
  SELECT 
    c.tenant_id,
    m.workspace_id,
    SUM(c.impressions) AS paid_impressions,
    SUM(c.clicks) AS paid_clicks
  FROM channel_spend_daily c
  JOIN mode m ON m.tenant_id = c.tenant_id AND m.mode = c.data_mode
  GROUP BY c.tenant_id, m.workspace_id
),
-- Aggregate from cmo_metrics_snapshots (general metrics)
cmo_stats AS (
  SELECT 
    ms.tenant_id,
    ms.workspace_id,
    SUM(ms.impressions) AS cmo_impressions,
    SUM(ms.clicks) AS cmo_clicks,
    SUM(ms.conversions) AS cmo_conversions
  FROM cmo_metrics_snapshots ms
  JOIN mode m ON m.tenant_id = ms.tenant_id 
             AND m.workspace_id = ms.workspace_id 
             AND m.mode = ms.data_mode
  GROUP BY ms.tenant_id, ms.workspace_id
)
SELECT
  COALESCE(e.workspace_id, p.workspace_id, c.workspace_id) AS workspace_id,
  COALESCE(e.tenant_id, p.tenant_id, c.tenant_id) AS tenant_id,
  -- Email metrics
  COALESCE(e.email_sends, 0) AS email_sends,
  COALESCE(e.email_opens, 0) AS email_opens,
  COALESCE(e.email_clicks, 0) AS email_clicks,
  -- Paid ads metrics (GA/Meta/LinkedIn)
  COALESCE(p.paid_impressions, 0) AS paid_impressions,
  COALESCE(p.paid_clicks, 0) AS paid_clicks,
  -- CMO consolidated metrics
  COALESCE(c.cmo_impressions, 0) AS cmo_impressions,
  COALESCE(c.cmo_clicks, 0) AS cmo_clicks,
  COALESCE(c.cmo_conversions, 0) AS cmo_conversions,
  -- Totals
  COALESCE(p.paid_impressions, 0) + COALESCE(c.cmo_impressions, 0) AS total_impressions,
  COALESCE(e.email_clicks, 0) + COALESCE(p.paid_clicks, 0) + COALESCE(c.cmo_clicks, 0) AS total_clicks
FROM email_stats e
FULL OUTER JOIN paid_stats p ON p.workspace_id = e.workspace_id AND p.tenant_id = e.tenant_id
FULL OUTER JOIN cmo_stats c ON c.workspace_id = COALESCE(e.workspace_id, p.workspace_id) 
                            AND c.tenant_id = COALESCE(e.tenant_id, p.tenant_id);

-- Set security invoker for RLS enforcement
ALTER VIEW v_impressions_clicks_by_workspace SET (security_invoker = on);