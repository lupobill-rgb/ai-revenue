-- ============================================
-- LOVABLE CLOUD SCHEMA MIGRATION - PART 3
-- CRO Module (Chief Revenue Officer)
-- Source: BACKUP_SCHEMA.sql
-- ============================================

-- ============================================
-- CRO TARGETS
-- ============================================

CREATE TABLE IF NOT EXISTS public.cro_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period text NOT NULL,
  owner_type text NOT NULL,
  owner_id text NOT NULL,
  target_new_arr numeric DEFAULT 0,
  target_pipeline numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- ============================================
-- CRO FORECASTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.cro_forecasts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period text NOT NULL,
  scenario text NOT NULL,
  forecast_new_arr numeric DEFAULT 0,
  confidence numeric DEFAULT 0.5,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- ============================================
-- CRO DEAL REVIEWS
-- ============================================

CREATE TABLE IF NOT EXISTS public.cro_deal_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id),
  review_type text NOT NULL,
  score integer DEFAULT 50,
  summary text,
  risks jsonb DEFAULT '[]'::jsonb,
  next_steps jsonb DEFAULT '[]'::jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
-- ============================================
-- CRO RECOMMENDATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS public.cro_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  recommendation_type text NOT NULL,
  priority text DEFAULT 'medium',
  title text NOT NULL,
  description text,
  action_items jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'pending',
  implemented_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- ============================================
-- INDEXES (Conditional on column existence)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cro_targets_workspace_id ON public.cro_targets(workspace_id);
-- Conditional index on tenant_id if column exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cro_targets' AND column_name = 'tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_cro_targets_tenant_id ON public.cro_targets(tenant_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_cro_forecasts_workspace_id ON public.cro_forecasts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cro_deal_reviews_workspace_id ON public.cro_deal_reviews(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cro_deal_reviews_deal_id ON public.cro_deal_reviews(deal_id);
CREATE INDEX IF NOT EXISTS idx_cro_recommendations_workspace_id ON public.cro_recommendations(workspace_id);
-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE public.cro_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cro_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cro_deal_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cro_recommendations ENABLE ROW LEVEL SECURITY;
-- ============================================
-- RLS POLICIES
-- ============================================

-- CRO Targets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cro_targets' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.cro_targets FOR SELECT
      USING (user_has_workspace_access(workspace_id));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cro_targets' AND policyname = 'workspace_access_insert') THEN
    CREATE POLICY "workspace_access_insert" ON public.cro_targets FOR INSERT
      WITH CHECK (user_has_workspace_access(workspace_id));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cro_targets' AND policyname = 'workspace_access_update') THEN
    CREATE POLICY "workspace_access_update" ON public.cro_targets FOR UPDATE
      USING (user_has_workspace_access(workspace_id));
  END IF;
END $$;
-- CRO Forecasts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cro_forecasts' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.cro_forecasts FOR SELECT
      USING (user_has_workspace_access(workspace_id));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cro_forecasts' AND policyname = 'workspace_access_insert') THEN
    CREATE POLICY "workspace_access_insert" ON public.cro_forecasts FOR INSERT
      WITH CHECK (user_has_workspace_access(workspace_id));
  END IF;
END $$;
-- CRO Deal Reviews
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cro_deal_reviews' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.cro_deal_reviews FOR SELECT
      USING (user_has_workspace_access(workspace_id));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cro_deal_reviews' AND policyname = 'workspace_access_insert') THEN
    CREATE POLICY "workspace_access_insert" ON public.cro_deal_reviews FOR INSERT
      WITH CHECK (user_has_workspace_access(workspace_id));
  END IF;
END $$;
-- CRO Recommendations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cro_recommendations' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.cro_recommendations FOR SELECT
      USING (user_has_workspace_access(workspace_id));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cro_recommendations' AND policyname = 'workspace_access_insert') THEN
    CREATE POLICY "workspace_access_insert" ON public.cro_recommendations FOR INSERT
      WITH CHECK (user_has_workspace_access(workspace_id));
  END IF;
END $$;
-- ============================================
-- MIGRATION COMPLETE: PART 3
-- CRO module tables created
-- ============================================;
