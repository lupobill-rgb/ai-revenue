-- Create gated view for CMO metrics that respects workspace mode and Stripe connection
CREATE OR REPLACE VIEW public.v_cmo_metrics_by_workspace AS
WITH ws AS (
  SELECT 
    w.id AS workspace_id,
    w.tenant_id,
    w.demo_mode,
    w.stripe_connected,
    CASE WHEN w.demo_mode THEN 'demo'::data_mode ELSE 'live'::data_mode END AS required_mode
  FROM workspaces w
),
metrics AS (
  SELECT 
    m.workspace_id,
    m.tenant_id,
    m.campaign_id,
    m.channel_id,
    m.snapshot_date,
    m.metric_type,
    m.impressions,
    m.clicks,
    m.conversions,
    m.engagement_rate,
    m.conversion_rate,
    m.cost,
    m.revenue,
    m.roi,
    m.custom_metrics,
    m.data_mode
  FROM cmo_metrics_snapshots m
  JOIN ws 
    ON ws.workspace_id = m.workspace_id 
   AND ws.tenant_id = m.tenant_id 
   AND ws.required_mode = m.data_mode
)
SELECT
  ws.workspace_id,
  ws.tenant_id,
  ws.demo_mode,
  ws.stripe_connected,
  m.campaign_id,
  m.channel_id,
  m.snapshot_date,
  m.metric_type,
  COALESCE(m.impressions, 0) AS impressions,
  COALESCE(m.clicks, 0) AS clicks,
  COALESCE(m.conversions, 0) AS conversions,
  COALESCE(m.engagement_rate, 0) AS engagement_rate,
  COALESCE(m.conversion_rate, 0) AS conversion_rate,
  COALESCE(m.cost, 0) AS cost,
  -- Gate revenue: only show if demo_mode OR stripe_connected
  CASE
    WHEN ws.demo_mode THEN COALESCE(m.revenue, 0)
    WHEN ws.stripe_connected THEN COALESCE(m.revenue, 0)
    ELSE 0
  END AS revenue,
  -- Gate ROI: only show if demo_mode OR stripe_connected
  CASE
    WHEN ws.demo_mode THEN COALESCE(m.roi, 0)
    WHEN ws.stripe_connected THEN COALESCE(m.roi, 0)
    ELSE 0
  END AS roi,
  m.custom_metrics,
  CASE
    WHEN ws.demo_mode THEN 'DEMO_MODE'
    WHEN NOT ws.stripe_connected THEN 'NO_STRIPE_CONNECTED'
    ELSE 'LIVE_OK'
  END AS data_quality_status
FROM ws
LEFT JOIN metrics m 
  ON m.workspace_id = ws.workspace_id 
 AND m.tenant_id = ws.tenant_id;
