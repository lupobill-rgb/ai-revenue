-- Add stripe_connected to workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS stripe_connected boolean NOT NULL DEFAULT false;

-- Create revenue view that enforces hard-zero unless Stripe connected + events exist
CREATE OR REPLACE VIEW v_revenue_by_workspace AS
SELECT
  w.id AS workspace_id,
  w.tenant_id,
  CASE
    WHEN w.stripe_connected = false THEN 0
    ELSE COALESCE(SUM((e.payload->>'amount')::numeric), 0)
  END AS revenue
FROM workspaces w
LEFT JOIN stripe_events e
  ON e.workspace_id = w.id
 AND e.tenant_id = w.tenant_id
 AND e.data_mode = CASE WHEN w.demo_mode THEN 'demo'::data_mode ELSE 'live'::data_mode END
GROUP BY w.id, w.tenant_id, w.stripe_connected;

-- Set security invoker for RLS enforcement
ALTER VIEW v_revenue_by_workspace SET (security_invoker = on);