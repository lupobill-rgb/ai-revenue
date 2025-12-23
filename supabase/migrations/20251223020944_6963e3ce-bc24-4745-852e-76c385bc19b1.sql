-- 1. Add source flag to deals table
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user';

-- 2. Add check constraint for valid source values
ALTER TABLE deals 
ADD CONSTRAINT deals_source_check 
CHECK (source IN ('user', 'seed', 'test'));

-- 3. Update existing test workspace deals to be flagged
UPDATE deals 
SET source = 'test' 
WHERE workspace_id IN (
  SELECT id FROM workspaces 
  WHERE name LIKE '%QA%' OR name LIKE '%Test%' OR name LIKE '%Scale%'
);

-- 4. Recreate the view to exclude test/seed data in live mode
CREATE OR REPLACE VIEW v_pipeline_metrics_by_workspace AS
SELECT 
  w.id AS workspace_id,
  w.tenant_id,
  w.demo_mode,
  COALESCE(lead_counts.total_leads, 0) AS total_leads,
  COALESCE(lead_counts.contacted, 0) AS contacted,
  COALESCE(lead_counts.qualified, 0) AS qualified,
  COALESCE(lead_counts.converted, 0) AS converted,
  COALESCE(lead_counts.lost_leads, 0) AS lost_leads,
  COALESCE(deal_counts.won, 0) AS won,
  COALESCE(deal_counts.lost, 0) AS lost,
  -- Revenue is only from verified won deals
  CASE 
    WHEN s.is_connected = true THEN COALESCE(deal_counts.verified_revenue, 0)
    ELSE 0
  END AS verified_revenue,
  -- Conversion rate: converted leads / total leads
  CASE 
    WHEN COALESCE(lead_counts.total_leads, 0) > 0 
    THEN ROUND((COALESCE(lead_counts.converted, 0)::numeric / lead_counts.total_leads) * 100, 1)
    ELSE 0
  END AS conversion_rate,
  -- Win rate: won / (won + lost)
  CASE 
    WHEN (COALESCE(deal_counts.won, 0) + COALESCE(deal_counts.lost, 0)) > 0 
    THEN ROUND((COALESCE(deal_counts.won, 0)::numeric / (deal_counts.won + deal_counts.lost)) * 100, 1)
    ELSE 0
  END AS win_rate,
  deal_counts.avg_conversion_time_days,
  COALESCE(deal_counts.stage_breakdown, '{}'::jsonb) AS stage_breakdown,
  CASE
    WHEN w.demo_mode = true THEN 'DEMO_MODE'
    WHEN s.is_connected = true THEN 'LIVE_OK'
    ELSE 'NO_STRIPE_CONNECTED'
  END AS data_quality_status
FROM workspaces w
LEFT JOIN ai_settings_stripe s ON s.tenant_id = w.id
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) AS total_leads,
    COUNT(*) FILTER (WHERE status IN ('contacted', 'qualified', 'converted', 'won')) AS contacted,
    COUNT(*) FILTER (WHERE status IN ('qualified', 'converted', 'won')) AS qualified,
    COUNT(*) FILTER (WHERE status IN ('converted', 'won')) AS converted,
    COUNT(*) FILTER (WHERE status IN ('lost', 'unqualified')) AS lost_leads
  FROM leads l
  WHERE l.workspace_id = w.id
    AND (w.demo_mode = true OR l.data_mode = 'live')
) lead_counts ON true
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) FILTER (WHERE d.stage = 'closed_won') AS won,
    COUNT(*) FILTER (WHERE d.stage = 'closed_lost') AS lost,
    SUM(d.value) FILTER (WHERE d.stage = 'closed_won' AND d.revenue_verified = true) AS verified_revenue,
    ROUND(AVG(EXTRACT(EPOCH FROM (d.won_at - d.created_at)) / 86400) FILTER (WHERE d.stage = 'closed_won' AND d.won_at IS NOT NULL), 1) AS avg_conversion_time_days,
    jsonb_object_agg(
      d.stage, 
      jsonb_build_object('count', stage_agg.cnt, 'avg_days', 0)
    ) FILTER (WHERE stage_agg.cnt > 0) AS stage_breakdown
  FROM deals d
  LEFT JOIN LATERAL (
    SELECT d.stage, COUNT(*) as cnt
    FROM deals d2 
    WHERE d2.workspace_id = w.id 
      -- CRITICAL: Exclude test/seed data in live mode
      AND (w.demo_mode = true OR d2.source = 'user')
    GROUP BY d2.stage
  ) stage_agg ON stage_agg.stage = d.stage
  WHERE d.workspace_id = w.id
    -- CRITICAL: Exclude test/seed data in live mode
    AND (w.demo_mode = true OR d.source = 'user')
) deal_counts ON true;