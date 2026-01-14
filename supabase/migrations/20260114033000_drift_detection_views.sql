-- ============================================================
-- Drift detection support views (existing data only)
-- Used by slo-monitor to trigger alerts (no auto-correction)
-- ============================================================

-- 1) Daily approval rate by workspace (from approvals)
CREATE OR REPLACE VIEW public.v_approval_rate_daily_by_workspace AS
SELECT
  a.workspace_id,
  COALESCE(w.tenant_id, w.id) AS tenant_id,
  date_trunc('day', aa.created_at) AS day,
  COUNT(*) FILTER (WHERE aa.status = 'approved')::integer AS approved,
  COUNT(*) FILTER (WHERE aa.status = 'rejected')::integer AS rejected,
  COUNT(*)::integer AS total,
  CASE
    WHEN COUNT(*) = 0 THEN NULL
    ELSE (COUNT(*) FILTER (WHERE aa.status = 'approved')::numeric / COUNT(*)::numeric)
  END AS approval_rate
FROM public.asset_approvals aa
JOIN public.assets a ON a.id = aa.asset_id
JOIN public.workspaces w ON w.id = a.workspace_id
GROUP BY a.workspace_id, COALESCE(w.tenant_id, w.id), date_trunc('day', aa.created_at);

-- 2) Spend delta vs configured cap (7d vs previous 7d)
CREATE OR REPLACE VIEW public.v_spend_delta_7d_by_workspace AS
WITH caps AS (
  SELECT
    w.id AS workspace_id,
    COALESCE(w.tenant_id, w.id) AS tenant_id,
    tt.monthly_budget_cap::numeric AS monthly_budget_cap
  FROM public.workspaces w
  LEFT JOIN public.tenant_targets tt
    ON tt.tenant_id = COALESCE(w.tenant_id, w.id)
),
spend AS (
  SELECT
    workspace_id,
    SUM(CASE WHEN created_at >= now() - interval '7 days' THEN COALESCE(cost, 0) ELSE 0 END)::numeric AS cost_last_7d,
    SUM(CASE WHEN created_at >= now() - interval '14 days' AND created_at < now() - interval '7 days' THEN COALESCE(cost, 0) ELSE 0 END)::numeric AS cost_prev_7d
  FROM public.v_campaign_metrics_gated
  WHERE created_at >= now() - interval '14 days'
  GROUP BY workspace_id
)
SELECT
  c.workspace_id,
  c.tenant_id,
  c.monthly_budget_cap,
  COALESCE(s.cost_last_7d, 0) AS cost_last_7d,
  COALESCE(s.cost_prev_7d, 0) AS cost_prev_7d,
  (COALESCE(s.cost_last_7d, 0) - COALESCE(s.cost_prev_7d, 0)) AS spend_delta_7d,
  (c.monthly_budget_cap * (7.0 / 30.0)) AS cap_prorated_7d,
  CASE
    WHEN c.monthly_budget_cap IS NULL OR c.monthly_budget_cap <= 0 THEN NULL
    ELSE (COALESCE(s.cost_last_7d, 0) - COALESCE(s.cost_prev_7d, 0)) > (c.monthly_budget_cap * (7.0 / 30.0))
  END AS is_breached
FROM caps c
LEFT JOIN spend s ON s.workspace_id = c.workspace_id;

