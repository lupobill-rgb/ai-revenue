-- Patch v_revenue_by_workspace with event_type filter and proper amount extraction
DROP VIEW IF EXISTS public.v_revenue_by_workspace;
CREATE OR REPLACE VIEW public.v_revenue_by_workspace AS
WITH ws AS (
  SELECT 
    w.id AS workspace_id,
    w.tenant_id,
    w.demo_mode,
    w.stripe_connected,
    CASE WHEN w.demo_mode THEN 'demo'::data_mode ELSE 'live'::data_mode END AS required_mode
  FROM workspaces w
),
rev AS (
  SELECT 
    e.tenant_id,
    e.workspace_id,
    SUM(
      CASE
        -- Only count settled revenue events
        WHEN e.event_type IN ('invoice.paid','checkout.session.completed','payment_intent.succeeded','charge.succeeded')
          -- Avoid counting test-mode when in live
          AND COALESCE((e.payload->>'livemode')::boolean, true) = true
        THEN COALESCE(
          -- Try multiple common Stripe amount paths
          (e.payload->'data'->'object'->>'amount_paid')::numeric,
          (e.payload->'data'->'object'->>'amount_total')::numeric,
          (e.payload->'data'->'object'->>'amount')::numeric,
          (e.payload->>'amount')::numeric,
          0
        ) / 100.0
        ELSE 0
      END
    ) AS revenue
  FROM stripe_events e
  JOIN ws 
    ON ws.tenant_id = e.tenant_id 
   AND ws.workspace_id = e.workspace_id 
   AND ws.required_mode = e.data_mode
  GROUP BY e.tenant_id, e.workspace_id
)
SELECT
  ws.workspace_id,
  ws.tenant_id,
  ws.demo_mode,
  ws.stripe_connected,
  CASE
    WHEN ws.demo_mode THEN 'DEMO_MODE'
    WHEN NOT ws.stripe_connected THEN 'NO_STRIPE_CONNECTED'
    ELSE 'LIVE_OK'
  END AS data_quality_status,
  CASE
    WHEN ws.demo_mode THEN COALESCE(rev.revenue, 0)
    WHEN NOT ws.stripe_connected THEN 0
    ELSE COALESCE(rev.revenue, 0)
  END AS revenue
FROM ws
LEFT JOIN rev 
  ON rev.tenant_id = ws.tenant_id 
 AND rev.workspace_id = ws.workspace_id;
