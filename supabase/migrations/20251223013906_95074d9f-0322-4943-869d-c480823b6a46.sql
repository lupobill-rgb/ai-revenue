-- =============================================
-- CRM SINGLE SOURCE OF TRUTH ARCHITECTURE
-- =============================================

-- 1) Add explicit status column to deals (normalizes won/lost detection)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS status text 
  GENERATED ALWAYS AS (
    CASE 
      WHEN stage = 'closed_won' THEN 'won'
      WHEN stage = 'closed_lost' THEN 'lost'
      ELSE 'open'
    END
  ) STORED;
-- 2) Add won_at and lost_at timestamps to deals
ALTER TABLE deals ADD COLUMN IF NOT EXISTS won_at timestamptz;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS lost_at timestamptz;
-- 3) Create lead_stage_events table for velocity tracking
CREATE TABLE IF NOT EXISTS lead_stage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  stage text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor text DEFAULT 'system',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Enable RLS
ALTER TABLE lead_stage_events ENABLE ROW LEVEL SECURITY;
-- RLS policies for lead_stage_events
CREATE POLICY "tenant_isolation_select" ON lead_stage_events
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON lead_stage_events
  FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON lead_stage_events
  FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON lead_stage_events
  FOR DELETE USING (user_belongs_to_tenant(tenant_id));
-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_lead_stage_events_lead ON lead_stage_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_stage_events_workspace ON lead_stage_events(workspace_id);
-- 4) Trigger to auto-populate won_at/lost_at on deals
CREATE OR REPLACE FUNCTION fn_deal_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Set won_at when stage becomes closed_won
  IF NEW.stage = 'closed_won' AND (OLD.stage IS NULL OR OLD.stage != 'closed_won') THEN
    NEW.won_at := now();
    NEW.closed_won_at := now();
  END IF;
  
  -- Set lost_at when stage becomes closed_lost
  IF NEW.stage = 'closed_lost' AND (OLD.stage IS NULL OR OLD.stage != 'closed_lost') THEN
    NEW.lost_at := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_deal_status_timestamps ON deals;
CREATE TRIGGER trg_deal_status_timestamps
  BEFORE INSERT OR UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION fn_deal_status_timestamps();
-- 5) Trigger to auto-create lead_stage_events on lead status changes
CREATE OR REPLACE FUNCTION fn_lead_stage_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire if status actually changed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO lead_stage_events (workspace_id, tenant_id, lead_id, stage, occurred_at)
    VALUES (NEW.workspace_id, COALESCE(NEW.tenant_id, NEW.workspace_id), NEW.id, NEW.status, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_lead_stage_event ON leads;
CREATE TRIGGER trg_lead_stage_event
  AFTER INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION fn_lead_stage_event();
-- 6) Create v_data_quality_by_workspace (authoritative quality flags)
CREATE OR REPLACE VIEW v_data_quality_by_workspace AS
SELECT
  w.id AS workspace_id,
  w.tenant_id,
  w.demo_mode,
  COALESCE(stripe.is_connected, false) AS stripe_connected,
  COALESCE(social.is_connected, false) AS analytics_connected,
  COALESCE(voice.is_connected, false) AS voice_provider_configured,
  COALESCE(email.is_connected, false) AS email_provider_configured,
  CASE
    WHEN w.demo_mode = true THEN 'DEMO_MODE'
    WHEN COALESCE(stripe.is_connected, false) = false THEN 'NO_STRIPE_CONNECTED'
    WHEN COALESCE(social.is_connected, false) = false THEN 'NO_ANALYTICS_CONNECTED'
    ELSE 'LIVE_OK'
  END AS data_quality_status
FROM workspaces w
LEFT JOIN ai_settings_stripe stripe ON stripe.tenant_id = w.id
LEFT JOIN ai_settings_social social ON social.tenant_id = w.id
LEFT JOIN ai_settings_voice voice ON voice.tenant_id = w.id
LEFT JOIN ai_settings_email email ON email.tenant_id = w.id;
-- 7) Create v_pipeline_metrics_by_workspace (authoritative pipeline KPIs)
CREATE OR REPLACE VIEW v_pipeline_metrics_by_workspace AS
WITH workspace_mode AS (
  SELECT 
    w.id AS workspace_id,
    w.tenant_id,
    w.demo_mode,
    CASE WHEN w.demo_mode THEN 'demo'::data_mode ELSE 'live'::data_mode END AS required_mode
  FROM workspaces w
),
lead_counts AS (
  SELECT
    wm.workspace_id,
    wm.tenant_id,
    wm.demo_mode,
    COUNT(l.id) AS total_leads,
    COUNT(l.id) FILTER (WHERE l.contacted_at IS NOT NULL) AS contacted,
    COUNT(l.id) FILTER (WHERE l.qualified_at IS NOT NULL) AS qualified,
    COUNT(l.id) FILTER (WHERE l.converted_at IS NOT NULL) AS converted,
    COUNT(l.id) FILTER (WHERE l.lost_at IS NOT NULL) AS lost_leads
  FROM workspace_mode wm
  LEFT JOIN leads l ON l.workspace_id = wm.workspace_id AND l.data_mode = wm.required_mode
  GROUP BY wm.workspace_id, wm.tenant_id, wm.demo_mode
),
deal_counts AS (
  SELECT
    wm.workspace_id,
    COUNT(d.id) FILTER (WHERE d.stage = 'closed_won') AS won,
    COUNT(d.id) FILTER (WHERE d.stage = 'closed_lost') AS lost,
    SUM(CASE WHEN d.stage = 'closed_won' AND d.revenue_verified = true THEN d.value ELSE 0 END) AS verified_revenue,
    AVG(EXTRACT(EPOCH FROM (d.won_at - l.created_at)) / 86400) 
      FILTER (WHERE d.stage = 'closed_won' AND d.won_at IS NOT NULL AND l.created_at IS NOT NULL) AS avg_conversion_days
  FROM workspace_mode wm
  LEFT JOIN deals d ON d.workspace_id = wm.workspace_id AND d.data_mode = wm.required_mode
  LEFT JOIN leads l ON l.id = d.lead_id
  GROUP BY wm.workspace_id
),
stage_stats AS (
  -- Pre-calculate stage statistics without nesting aggregates
  SELECT
    lse.workspace_id,
    lse.stage,
    COUNT(*) AS stage_count,
    ROUND(AVG(
      CASE WHEN prev_time IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (lse.occurred_at - prev_time)) / 86400 
        ELSE NULL 
      END
    )::numeric, 1) AS avg_days
  FROM (
    SELECT 
      lse.*,
      LAG(lse.occurred_at) OVER (PARTITION BY lse.lead_id ORDER BY lse.occurred_at) AS prev_time
    FROM lead_stage_events lse
  ) lse
  GROUP BY lse.workspace_id, lse.stage
),
stage_velocity AS (
  SELECT
    workspace_id,
    jsonb_object_agg(
      stage,
      jsonb_build_object('count', stage_count, 'avg_days', COALESCE(avg_days, 0))
    ) AS stage_breakdown
  FROM stage_stats
  GROUP BY workspace_id
)
SELECT
  lc.workspace_id,
  lc.tenant_id,
  lc.demo_mode,
  lc.total_leads,
  lc.contacted,
  lc.qualified,
  lc.converted,
  lc.lost_leads,
  COALESCE(dc.won, 0) AS won,
  COALESCE(dc.lost, 0) AS lost,
  COALESCE(dc.verified_revenue, 0) AS verified_revenue,
  -- Conversion rate: won / total_leads (0 if no leads)
  CASE 
    WHEN lc.total_leads = 0 THEN 0
    ELSE ROUND((COALESCE(dc.won, 0)::numeric / lc.total_leads) * 100, 1)
  END AS conversion_rate,
  -- Win rate: won / (won + lost) (0 if no closed deals)
  CASE 
    WHEN COALESCE(dc.won, 0) + COALESCE(dc.lost, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(dc.won, 0)::numeric / (COALESCE(dc.won, 0) + COALESCE(dc.lost, 0))) * 100, 1)
  END AS win_rate,
  -- Avg conversion time (null if no data)
  ROUND(dc.avg_conversion_days::numeric, 1) AS avg_conversion_time_days,
  -- Stage breakdown JSON
  COALESCE(sv.stage_breakdown, '{}'::jsonb) AS stage_breakdown,
  -- Data quality status
  CASE
    WHEN lc.demo_mode = true THEN 'DEMO_MODE'
    ELSE 'LIVE_OK'
  END AS data_quality_status
FROM lead_counts lc
LEFT JOIN deal_counts dc ON dc.workspace_id = lc.workspace_id
LEFT JOIN stage_velocity sv ON sv.workspace_id = lc.workspace_id;
-- Enable realtime for lead_stage_events
ALTER PUBLICATION supabase_realtime ADD TABLE lead_stage_events;
