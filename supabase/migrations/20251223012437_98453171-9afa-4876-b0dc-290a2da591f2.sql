-- =============================================================================
-- CRM AS SOURCE OF TRUTH: Data Integrity Migration
-- =============================================================================

-- 1. Add data integrity columns to deals table
ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS data_mode public.data_mode NOT NULL DEFAULT 'live',
ADD COLUMN IF NOT EXISTS revenue_verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT,
ADD COLUMN IF NOT EXISTS closed_won_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tenant_id UUID;
-- Backfill tenant_id from workspace
UPDATE public.deals d
SET tenant_id = w.tenant_id
FROM public.workspaces w
WHERE d.workspace_id = w.id
  AND d.tenant_id IS NULL;
-- Add NOT NULL constraint after backfill (with default for new records)
-- We'll use a trigger instead to avoid breaking existing inserts

-- 2. Create trigger to auto-set tenant_id and data_mode on deals
CREATE OR REPLACE FUNCTION public.set_deal_tenant_and_mode()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ws_tenant_id uuid;
  ws_demo_mode boolean;
BEGIN
  -- Get tenant_id and demo_mode from workspace
  SELECT tenant_id, demo_mode INTO ws_tenant_id, ws_demo_mode
  FROM workspaces
  WHERE id = NEW.workspace_id;
  
  -- Set tenant_id if not provided
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := ws_tenant_id;
  END IF;
  
  -- Set data_mode based on workspace demo_mode
  IF ws_demo_mode THEN
    NEW.data_mode := 'demo';
  ELSE
    NEW.data_mode := 'live';
  END IF;
  
  -- Auto-set closed_won_at when stage changes to closed_won
  IF NEW.stage = 'closed_won' AND (OLD IS NULL OR OLD.stage != 'closed_won') THEN
    NEW.closed_won_at := COALESCE(NEW.closed_won_at, now());
  END IF;
  
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_deal_set_tenant_mode ON public.deals;
CREATE TRIGGER trg_deal_set_tenant_mode
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_deal_tenant_and_mode();
-- 3. Create v_crm_pipeline_truth view - GATED pipeline metrics
CREATE OR REPLACE VIEW public.v_crm_pipeline_truth AS
WITH ws AS (
  SELECT 
    w.id AS workspace_id,
    w.tenant_id,
    w.demo_mode,
    w.stripe_connected,
    CASE WHEN w.demo_mode THEN 'demo'::public.data_mode ELSE 'live'::public.data_mode END AS required_mode
  FROM public.workspaces w
),
deal_stats AS (
  SELECT
    d.workspace_id,
    d.stage,
    COUNT(*) AS deal_count,
    SUM(d.value) AS total_value,
    SUM(CASE WHEN d.revenue_verified THEN d.value ELSE 0 END) AS verified_value,
    COUNT(*) FILTER (WHERE d.revenue_verified) AS verified_count
  FROM public.deals d
  JOIN ws ON ws.workspace_id = d.workspace_id AND ws.required_mode = d.data_mode
  GROUP BY d.workspace_id, d.stage
)
SELECT
  ws.workspace_id,
  ws.tenant_id,
  ws.demo_mode,
  ws.stripe_connected,
  -- Pipeline metrics (all stages except closed)
  COALESCE(SUM(ds.total_value) FILTER (WHERE ds.stage NOT IN ('closed_won', 'closed_lost')), 0) AS pipeline_value,
  COALESCE(SUM(ds.deal_count) FILTER (WHERE ds.stage NOT IN ('closed_won', 'closed_lost')), 0) AS pipeline_count,
  -- Won revenue: ONLY verified revenue when Stripe connected, else 0
  CASE
    WHEN ws.demo_mode THEN COALESCE(SUM(ds.total_value) FILTER (WHERE ds.stage = 'closed_won'), 0)
    WHEN NOT ws.stripe_connected THEN 0
    ELSE COALESCE(SUM(ds.verified_value) FILTER (WHERE ds.stage = 'closed_won'), 0)
  END AS won_revenue,
  COALESCE(SUM(ds.deal_count) FILTER (WHERE ds.stage = 'closed_won'), 0) AS won_count,
  COALESCE(SUM(ds.verified_count) FILTER (WHERE ds.stage = 'closed_won'), 0) AS verified_won_count,
  -- Lost deals
  COALESCE(SUM(ds.total_value) FILTER (WHERE ds.stage = 'closed_lost'), 0) AS lost_value,
  COALESCE(SUM(ds.deal_count) FILTER (WHERE ds.stage = 'closed_lost'), 0) AS lost_count,
  -- Data quality status
  CASE
    WHEN ws.demo_mode THEN 'DEMO_MODE'
    WHEN NOT ws.stripe_connected THEN 'NO_STRIPE_CONNECTED'
    ELSE 'LIVE_OK'
  END AS data_quality_status
FROM ws
LEFT JOIN deal_stats ds ON ds.workspace_id = ws.workspace_id
GROUP BY ws.workspace_id, ws.tenant_id, ws.demo_mode, ws.stripe_connected;
-- 4. Create v_crm_conversion_funnel view - Lead to Customer conversion rates
CREATE OR REPLACE VIEW public.v_crm_conversion_funnel AS
WITH ws AS (
  SELECT 
    w.id AS workspace_id,
    w.tenant_id,
    w.demo_mode,
    w.stripe_connected
  FROM public.workspaces w
),
lead_counts AS (
  SELECT
    l.workspace_id,
    COUNT(*) AS total_leads,
    COUNT(*) FILTER (WHERE l.status = 'new') AS new_leads,
    COUNT(*) FILTER (WHERE l.status IN ('contacted', 'working')) AS contacted_leads,
    COUNT(*) FILTER (WHERE l.status = 'qualified') AS qualified_leads,
    COUNT(*) FILTER (WHERE l.status = 'converted') AS converted_leads,
    COUNT(*) FILTER (WHERE l.status = 'lost') AS lost_leads
  FROM public.leads l
  GROUP BY l.workspace_id
),
deal_counts AS (
  SELECT
    d.workspace_id,
    COUNT(*) FILTER (WHERE d.stage = 'closed_won') AS won_deals,
    COUNT(*) FILTER (WHERE d.stage = 'closed_lost') AS lost_deals,
    COUNT(*) FILTER (WHERE d.stage NOT IN ('closed_won', 'closed_lost')) AS active_deals
  FROM public.deals d
  JOIN ws ON ws.workspace_id = d.workspace_id
    AND (
      (ws.demo_mode AND d.data_mode = 'demo')
      OR (NOT ws.demo_mode AND d.data_mode = 'live')
    )
  GROUP BY d.workspace_id
)
SELECT
  ws.workspace_id,
  ws.tenant_id,
  ws.demo_mode,
  ws.stripe_connected,
  -- Lead funnel (explicit zeros, not nulls)
  COALESCE(lc.total_leads, 0) AS total_leads,
  COALESCE(lc.new_leads, 0) AS new_leads,
  COALESCE(lc.contacted_leads, 0) AS contacted_leads,
  COALESCE(lc.qualified_leads, 0) AS qualified_leads,
  COALESCE(lc.converted_leads, 0) AS converted_leads,
  COALESCE(lc.lost_leads, 0) AS lost_leads,
  -- Deal funnel
  COALESCE(dc.active_deals, 0) AS active_deals,
  COALESCE(dc.won_deals, 0) AS won_deals,
  COALESCE(dc.lost_deals, 0) AS lost_deals,
  -- Conversion rates (explicit 0 when no data)
  CASE 
    WHEN COALESCE(lc.total_leads, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(lc.qualified_leads, 0)::numeric / lc.total_leads) * 100, 2)
  END AS lead_to_qualified_rate,
  CASE 
    WHEN COALESCE(lc.qualified_leads, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(dc.won_deals, 0)::numeric / lc.qualified_leads) * 100, 2)
  END AS qualified_to_won_rate,
  CASE 
    WHEN COALESCE(lc.total_leads, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(dc.won_deals, 0)::numeric / lc.total_leads) * 100, 2)
  END AS overall_conversion_rate,
  -- Data quality
  CASE
    WHEN ws.demo_mode THEN 'DEMO_MODE'
    ELSE 'LIVE_OK'
  END AS data_quality_status
FROM ws
LEFT JOIN lead_counts lc ON lc.workspace_id = ws.workspace_id
LEFT JOIN deal_counts dc ON dc.workspace_id = ws.workspace_id;
-- 5. Add index for performance
CREATE INDEX IF NOT EXISTS idx_deals_data_mode ON public.deals(data_mode);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_workspace_stage ON public.deals(workspace_id, stage);
-- 6. Grant access to authenticated users (views inherit RLS from base tables)
GRANT SELECT ON public.v_crm_pipeline_truth TO authenticated;
GRANT SELECT ON public.v_crm_conversion_funnel TO authenticated;
