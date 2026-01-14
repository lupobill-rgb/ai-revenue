-- CRO Module: Minimal Schema
-- Wraps existing CRM (leads/deals) with targets, forecasts, reviews, recommendations

-- CRO Targets: quota/targets by period and owner
CREATE TABLE public.cro_targets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period      text NOT NULL,        -- "2026-Q1", "2025-12"
  owner_type  text NOT NULL,        -- "rep", "team", "global"
  owner_id    text NOT NULL,        -- rep_id or team name
  target_new_arr numeric DEFAULT 0,
  target_pipeline numeric DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
-- CRO Forecasts: revenue forecasts by scenario
CREATE TABLE public.cro_forecasts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period      text NOT NULL,
  scenario    text NOT NULL,        -- "base", "stretch", "commit"
  forecast_new_arr numeric DEFAULT 0,
  confidence  numeric DEFAULT 0.5,  -- 0-1
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
-- CRO Deal Reviews: AI-generated deal analysis
CREATE TABLE public.cro_deal_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id     uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  summary_md  text,
  risks       text,
  next_steps  text,
  score       numeric DEFAULT 50,   -- 0-100
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
-- CRO Recommendations: AI insights and actions
CREATE TABLE public.cro_recommendations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_type text,                 -- "deal", "forecast", "pipeline"
  source_id   uuid,
  severity    text DEFAULT 'medium', -- "low", "medium", "high", "critical"
  title       text NOT NULL,
  description text,
  suggested_actions text,
  status      text DEFAULT 'open',  -- "open", "in_progress", "resolved", "dismissed"
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
-- Enable RLS
ALTER TABLE public.cro_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cro_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cro_deal_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cro_recommendations ENABLE ROW LEVEL SECURITY;
-- RLS Policies: tenant isolation
CREATE POLICY "tenant_isolation" ON public.cro_targets
FOR ALL USING (
  tenant_id = auth.uid() OR 
  tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
);
CREATE POLICY "tenant_isolation" ON public.cro_forecasts
FOR ALL USING (
  tenant_id = auth.uid() OR 
  tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
);
CREATE POLICY "tenant_isolation" ON public.cro_deal_reviews
FOR ALL USING (
  tenant_id = auth.uid() OR 
  tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
);
CREATE POLICY "tenant_isolation" ON public.cro_recommendations
FOR ALL USING (
  tenant_id = auth.uid() OR 
  tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
);
-- Triggers for updated_at
CREATE TRIGGER update_cro_targets_updated_at
  BEFORE UPDATE ON public.cro_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cro_forecasts_updated_at
  BEFORE UPDATE ON public.cro_forecasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cro_deal_reviews_updated_at
  BEFORE UPDATE ON public.cro_deal_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cro_recommendations_updated_at
  BEFORE UPDATE ON public.cro_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
