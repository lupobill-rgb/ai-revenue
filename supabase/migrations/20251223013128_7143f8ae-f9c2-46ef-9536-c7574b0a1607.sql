
-- =============================================================================
-- CRM SOURCE OF TRUTH: Complete Data Integrity Enforcement
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LEADS TABLE: Add lifecycle state timestamps and data_mode
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS data_mode public.data_mode NOT NULL DEFAULT 'live',
ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Backfill tenant_id from workspace
UPDATE public.leads l
SET tenant_id = w.tenant_id
FROM public.workspaces w
WHERE l.workspace_id = w.id
  AND l.tenant_id IS NULL;

-- Create trigger to auto-set tenant_id, data_mode, and lifecycle timestamps
CREATE OR REPLACE FUNCTION public.set_lead_lifecycle_state()
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
  
  -- Auto-set lifecycle timestamps on status transitions
  IF OLD IS NULL OR OLD.status != NEW.status THEN
    CASE NEW.status
      WHEN 'contacted' THEN
        NEW.contacted_at := COALESCE(NEW.contacted_at, now());
      WHEN 'working' THEN
        NEW.contacted_at := COALESCE(NEW.contacted_at, now());
      WHEN 'qualified' THEN
        NEW.qualified_at := COALESCE(NEW.qualified_at, now());
      WHEN 'converted' THEN
        NEW.converted_at := COALESCE(NEW.converted_at, now());
      WHEN 'lost' THEN
        NEW.lost_at := COALESCE(NEW.lost_at, now());
      ELSE
        NULL; -- no action for 'new' or other statuses
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_lifecycle ON public.leads;
CREATE TRIGGER trg_lead_lifecycle
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lead_lifecycle_state();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CRM SOURCE OF TRUTH VIEW: Master authoritative view
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_crm_source_of_truth AS
WITH ws AS (
  SELECT 
    w.id AS workspace_id,
    w.tenant_id,
    w.demo_mode,
    w.stripe_connected,
    CASE WHEN w.demo_mode THEN 'demo'::public.data_mode ELSE 'live'::public.data_mode END AS required_mode
  FROM public.workspaces w
),
-- Lead counts by workspace (filtered by data_mode)
lead_counts AS (
  SELECT
    l.workspace_id,
    COUNT(*) AS total_leads,
    COUNT(*) FILTER (WHERE l.status = 'new') AS new_leads,
    COUNT(*) FILTER (WHERE l.status IN ('contacted', 'working')) AS contacted_leads,
    COUNT(*) FILTER (WHERE l.status = 'qualified') AS qualified_leads,
    COUNT(*) FILTER (WHERE l.status = 'converted') AS converted_leads,
    COUNT(*) FILTER (WHERE l.status = 'lost') AS lost_leads,
    -- Velocity metrics (only from real timestamps)
    AVG(EXTRACT(EPOCH FROM (l.contacted_at - l.created_at)) / 86400) 
      FILTER (WHERE l.contacted_at IS NOT NULL) AS avg_days_to_contact,
    AVG(EXTRACT(EPOCH FROM (l.qualified_at - l.created_at)) / 86400) 
      FILTER (WHERE l.qualified_at IS NOT NULL) AS avg_days_to_qualify,
    AVG(EXTRACT(EPOCH FROM (l.converted_at - l.created_at)) / 86400) 
      FILTER (WHERE l.converted_at IS NOT NULL) AS avg_days_to_convert
  FROM public.leads l
  JOIN ws ON ws.workspace_id = l.workspace_id 
    AND (l.data_mode = ws.required_mode OR l.data_mode IS NULL) -- Handle NULL during backfill
  GROUP BY l.workspace_id
),
-- Deal counts by workspace (filtered by data_mode)
deal_counts AS (
  SELECT
    d.workspace_id,
    COUNT(*) AS total_deals,
    COUNT(*) FILTER (WHERE d.stage NOT IN ('closed_won', 'closed_lost')) AS active_deals,
    COUNT(*) FILTER (WHERE d.stage = 'closed_won') AS won_deals,
    COUNT(*) FILTER (WHERE d.stage = 'closed_lost') AS lost_deals,
    SUM(CASE WHEN d.stage NOT IN ('closed_won', 'closed_lost') THEN d.value ELSE 0 END) AS pipeline_value,
    SUM(CASE WHEN d.stage = 'closed_won' THEN d.value ELSE 0 END) AS won_value,
    SUM(CASE WHEN d.stage = 'closed_won' AND d.revenue_verified THEN d.value ELSE 0 END) AS verified_won_value,
    COUNT(*) FILTER (WHERE d.stage = 'closed_won' AND d.revenue_verified) AS verified_won_count
  FROM public.deals d
  JOIN ws ON ws.workspace_id = d.workspace_id AND d.data_mode = ws.required_mode
  GROUP BY d.workspace_id
),
-- Stripe revenue (only from real events)
stripe_revenue AS (
  SELECT
    e.workspace_id,
    SUM(
      CASE
        WHEN e.event_type IN ('invoice.paid', 'checkout.session.completed', 'payment_intent.succeeded', 'charge.succeeded')
          AND COALESCE((e.payload->>'livemode')::boolean, true) = true
        THEN COALESCE(
          ((e.payload->'data'->'object'->>'amount_paid')::numeric),
          ((e.payload->'data'->'object'->>'amount_total')::numeric),
          ((e.payload->'data'->'object'->>'amount')::numeric),
          (e.payload->>'amount')::numeric,
          0
        ) / 100.0
        ELSE 0
      END
    ) AS stripe_revenue
  FROM public.stripe_events e
  JOIN ws ON ws.workspace_id = e.workspace_id AND e.data_mode = ws.required_mode
  GROUP BY e.workspace_id
)
SELECT
  ws.workspace_id,
  ws.tenant_id,
  ws.demo_mode,
  ws.stripe_connected,
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- LEAD METRICS (from CRM truth only)
  -- ═══════════════════════════════════════════════════════════════════════════
  COALESCE(lc.total_leads, 0) AS total_leads,
  COALESCE(lc.new_leads, 0) AS new_leads,
  COALESCE(lc.contacted_leads, 0) AS contacted_leads,
  COALESCE(lc.qualified_leads, 0) AS qualified_leads,
  COALESCE(lc.converted_leads, 0) AS converted_leads,
  COALESCE(lc.lost_leads, 0) AS lost_leads,
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- CONVERSION RATES (explicit 0 when no data, never NULL or inferred)
  -- ═══════════════════════════════════════════════════════════════════════════
  CASE 
    WHEN COALESCE(lc.total_leads, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(lc.contacted_leads, 0)::numeric / lc.total_leads) * 100, 2)
  END AS lead_to_contact_rate,
  
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
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- PIPELINE METRICS (from CRM truth only)
  -- ═══════════════════════════════════════════════════════════════════════════
  COALESCE(dc.total_deals, 0) AS total_deals,
  COALESCE(dc.active_deals, 0) AS active_deals,
  COALESCE(dc.won_deals, 0) AS won_deals,
  COALESCE(dc.lost_deals, 0) AS lost_deals,
  COALESCE(dc.pipeline_value, 0) AS pipeline_value,
  
  -- Win rate (explicit 0 when no deals)
  CASE
    WHEN COALESCE(dc.total_deals, 0) = 0 THEN 0
    WHEN (COALESCE(dc.won_deals, 0) + COALESCE(dc.lost_deals, 0)) = 0 THEN 0
    ELSE ROUND((COALESCE(dc.won_deals, 0)::numeric / (dc.won_deals + dc.lost_deals)) * 100, 2)
  END AS win_rate,
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- REVENUE (STRICT RULES)
  -- Won revenue = 0 in live mode unless Stripe connected AND verified
  -- ═══════════════════════════════════════════════════════════════════════════
  CASE
    WHEN ws.demo_mode THEN COALESCE(dc.won_value, 0)
    WHEN NOT ws.stripe_connected THEN 0
    ELSE COALESCE(dc.verified_won_value, 0)
  END AS won_revenue,
  
  -- Stripe-verified revenue (always from real events)
  CASE
    WHEN ws.demo_mode THEN COALESCE(sr.stripe_revenue, 0)
    WHEN NOT ws.stripe_connected THEN 0
    ELSE COALESCE(sr.stripe_revenue, 0)
  END AS stripe_revenue,
  
  COALESCE(dc.verified_won_count, 0) AS verified_won_count,
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- VELOCITY METRICS (only from real timestamps, never fabricated)
  -- ═══════════════════════════════════════════════════════════════════════════
  ROUND(COALESCE(lc.avg_days_to_contact, 0)::numeric, 1) AS avg_days_to_contact,
  ROUND(COALESCE(lc.avg_days_to_qualify, 0)::numeric, 1) AS avg_days_to_qualify,
  ROUND(COALESCE(lc.avg_days_to_convert, 0)::numeric, 1) AS avg_days_to_convert,
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- DATA QUALITY STATUS (explicit indicator)
  -- ═══════════════════════════════════════════════════════════════════════════
  CASE
    WHEN ws.demo_mode THEN 'DEMO_MODE'
    WHEN NOT ws.stripe_connected AND COALESCE(dc.won_deals, 0) > 0 THEN 'REVENUE_UNVERIFIED'
    WHEN NOT ws.stripe_connected THEN 'NO_STRIPE_CONNECTED'
    WHEN COALESCE(lc.total_leads, 0) = 0 AND COALESCE(dc.total_deals, 0) = 0 THEN 'EMPTY_CRM'
    ELSE 'LIVE_OK'
  END AS data_quality_status

FROM ws
LEFT JOIN lead_counts lc ON lc.workspace_id = ws.workspace_id
LEFT JOIN deal_counts dc ON dc.workspace_id = ws.workspace_id
LEFT JOIN stripe_revenue sr ON sr.workspace_id = ws.workspace_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. LEAD PIPELINE VIEW: Gated lead funnel for dashboards
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_crm_lead_pipeline AS
WITH ws AS (
  SELECT 
    w.id AS workspace_id,
    w.demo_mode,
    CASE WHEN w.demo_mode THEN 'demo'::public.data_mode ELSE 'live'::public.data_mode END AS required_mode
  FROM public.workspaces w
)
SELECT
  l.id,
  l.workspace_id,
  l.first_name,
  l.last_name,
  l.email,
  l.company,
  l.status,
  l.score,
  l.source,
  l.created_at,
  l.contacted_at,
  l.qualified_at,
  l.converted_at,
  l.lost_at,
  l.data_mode,
  ws.demo_mode
FROM public.leads l
JOIN ws ON ws.workspace_id = l.workspace_id
WHERE l.data_mode = ws.required_mode 
   OR (l.data_mode IS NULL AND NOT ws.demo_mode); -- Handle legacy NULL data_mode in live mode

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. INDEXES FOR PERFORMANCE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_leads_data_mode ON public.leads(data_mode);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_status ON public.leads(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_status_timestamps ON public.leads(status, contacted_at, qualified_at, converted_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. GRANT ACCESS
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT ON public.v_crm_source_of_truth TO authenticated;
GRANT SELECT ON public.v_crm_lead_pipeline TO authenticated;
