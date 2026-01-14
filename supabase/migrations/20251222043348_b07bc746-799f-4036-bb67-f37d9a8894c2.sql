-- Create single source of truth view for dashboard metrics
-- Dashboards must query this view, not ad-hoc joins
CREATE OR REPLACE VIEW v_campaign_dashboard_metrics AS
WITH ws AS (
  SELECT id AS workspace_id, owner_id, demo_mode
  FROM workspaces
),
-- Get tenant_id from user_tenants via workspace owner
ws_tenant AS (
  SELECT 
    ws.workspace_id,
    ut.tenant_id,
    ws.demo_mode
  FROM ws
  LEFT JOIN user_tenants ut ON ut.user_id = ws.owner_id
),
mode AS (
  SELECT workspace_id, tenant_id,
         CASE WHEN demo_mode THEN 'demo'::data_mode ELSE 'live'::data_mode END AS mode
  FROM ws_tenant
),
email_outbox AS (
  SELECT o.workspace_id, o.tenant_id, o.run_id,
         COUNT(*) AS outbox_total,
         COUNT(*) FILTER (WHERE o.status IN ('sent','delivered')) AS delivered_or_sent,
         COUNT(*) FILTER (WHERE o.status = 'failed') AS failed,
         COUNT(*) FILTER (WHERE o.provider_message_id IS NOT NULL) AS provider_ids
  FROM channel_outbox o
  JOIN mode m
    ON m.workspace_id = o.workspace_id
   AND m.tenant_id = o.tenant_id
   AND m.mode = o.data_mode
  WHERE o.channel = 'email'
  GROUP BY 1,2,3
),
runs AS (
  SELECT r.workspace_id, r.tenant_id, r.id AS run_id, r.status, r.created_at
  FROM campaign_runs r
  JOIN mode m
    ON m.workspace_id = r.workspace_id
   AND m.tenant_id = r.tenant_id
   AND m.mode = r.data_mode
)
SELECT
  r.workspace_id,
  r.tenant_id,
  r.run_id,
  r.status AS run_status,
  r.created_at,
  COALESCE(e.outbox_total, 0) AS outbox_total,
  COALESCE(e.delivered_or_sent, 0) AS delivered_or_sent,
  COALESCE(e.failed, 0) AS failed,
  COALESCE(e.provider_ids, 0) AS provider_ids
FROM runs r
LEFT JOIN email_outbox e
  ON e.workspace_id = r.workspace_id
 AND e.tenant_id = r.tenant_id
 AND e.run_id = r.run_id;
