-- Drop and recreate v_impressions_clicks_by_workspace with integration checks and data_quality_status
DROP VIEW IF EXISTS v_impressions_clicks_by_workspace;

CREATE OR REPLACE VIEW v_impressions_clicks_by_workspace AS
WITH ws AS (
  SELECT 
    w.id AS workspace_id, 
    w.tenant_id, 
    w.demo_mode,
    w.stripe_connected,
    -- Check if analytics providers are connected via ai_settings_social or social_integrations
    EXISTS (
      SELECT 1 FROM social_integrations si 
      WHERE si.workspace_id = w.id 
      AND si.is_active = true 
      AND si.platform IN ('google_analytics', 'meta', 'facebook', 'linkedin')
    ) AS analytics_connected
  FROM workspaces w
),
mode AS (
  SELECT 
    workspace_id, 
    tenant_id,
    demo_mode,
    stripe_connected,
    analytics_connected,
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
  m.workspace_id,
  m.tenant_id,
  m.demo_mode,
  m.stripe_connected,
  m.analytics_connected,
  
  -- Data quality status for UI
  CASE 
    WHEN m.demo_mode THEN 'DEMO_MODE'
    WHEN NOT m.analytics_connected AND NOT m.stripe_connected THEN 'NO_PROVIDER_CONNECTED'
    WHEN NOT m.analytics_connected THEN 'NO_ANALYTICS_CONNECTED'
    WHEN NOT m.stripe_connected THEN 'NO_STRIPE_CONNECTED'
    ELSE 'LIVE_OK'
  END AS data_quality_status,
  
  -- Email metrics (always show if data exists)
  COALESCE(e.email_sends, 0) AS email_sends,
  COALESCE(e.email_opens, 0) AS email_opens,
  COALESCE(e.email_clicks, 0) AS email_clicks,
  
  -- Paid ads metrics: HARD ZERO if analytics not connected in live mode
  CASE 
    WHEN NOT m.demo_mode AND NOT m.analytics_connected THEN 0
    ELSE COALESCE(p.paid_impressions, 0)
  END AS paid_impressions,
  CASE 
    WHEN NOT m.demo_mode AND NOT m.analytics_connected THEN 0
    ELSE COALESCE(p.paid_clicks, 0)
  END AS paid_clicks,
  
  -- CMO metrics: HARD ZERO if analytics not connected in live mode
  CASE 
    WHEN NOT m.demo_mode AND NOT m.analytics_connected THEN 0
    ELSE COALESCE(c.cmo_impressions, 0)
  END AS cmo_impressions,
  CASE 
    WHEN NOT m.demo_mode AND NOT m.analytics_connected THEN 0
    ELSE COALESCE(c.cmo_clicks, 0)
  END AS cmo_clicks,
  COALESCE(c.cmo_conversions, 0) AS cmo_conversions,
  
  -- Totals: HARD ZERO if analytics not connected in live mode
  CASE 
    WHEN NOT m.demo_mode AND NOT m.analytics_connected THEN 0
    ELSE COALESCE(p.paid_impressions, 0) + COALESCE(c.cmo_impressions, 0)
  END AS total_impressions,
  CASE 
    WHEN NOT m.demo_mode AND NOT m.analytics_connected THEN 0
    ELSE COALESCE(e.email_clicks, 0) + COALESCE(p.paid_clicks, 0) + COALESCE(c.cmo_clicks, 0)
  END AS total_clicks

FROM mode m
LEFT JOIN email_stats e ON e.workspace_id = m.workspace_id AND e.tenant_id = m.tenant_id
LEFT JOIN paid_stats p ON p.workspace_id = m.workspace_id AND p.tenant_id = m.tenant_id
LEFT JOIN cmo_stats c ON c.workspace_id = m.workspace_id AND c.tenant_id = m.tenant_id;

-- Set security invoker for RLS enforcement
ALTER VIEW v_impressions_clicks_by_workspace SET (security_invoker = on);

-- Also update v_revenue_by_workspace to include data_quality_status
DROP VIEW IF EXISTS v_revenue_by_workspace;

CREATE OR REPLACE VIEW v_revenue_by_workspace AS
SELECT
  w.id AS workspace_id,
  w.tenant_id,
  w.demo_mode,
  w.stripe_connected,
  CASE 
    WHEN w.demo_mode THEN 'DEMO_MODE'
    WHEN w.stripe_connected = false THEN 'NO_STRIPE_CONNECTED'
    ELSE 'LIVE_OK'
  END AS data_quality_status,
  CASE
    WHEN NOT w.demo_mode AND w.stripe_connected = false THEN 0
    ELSE COALESCE(SUM((e.payload->>'amount')::numeric), 0)
  END AS revenue
FROM workspaces w
LEFT JOIN stripe_events e
  ON e.workspace_id = w.id
 AND e.tenant_id = w.tenant_id
 AND e.data_mode = CASE WHEN w.demo_mode THEN 'demo'::data_mode ELSE 'live'::data_mode END
GROUP BY w.id, w.tenant_id, w.demo_mode, w.stripe_connected;

ALTER VIEW v_revenue_by_workspace SET (security_invoker = on);