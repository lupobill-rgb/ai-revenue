-- ============================================
-- LOVABLE CLOUD SCHEMA MIGRATION - PART 2
-- CMO Extended Tables (Missing from Phase 3)
-- Source: BACKUP_SCHEMA.sql
-- ============================================

-- ============================================
-- CMO PLAN MILESTONES
-- ============================================

CREATE TABLE IF NOT EXISTS public.cmo_plan_milestones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.cmo_marketing_plans(id) ON DELETE CASCADE,
  milestone_name text NOT NULL,
  description text,
  target_date date,
  status text DEFAULT 'pending',
  kpis jsonb DEFAULT '[]'::jsonb,
  deliverables jsonb DEFAULT '[]'::jsonb,
  dependencies jsonb DEFAULT '[]'::jsonb,
  milestone_order integer DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- ============================================
-- CMO FUNNEL STAGES
-- ============================================

CREATE TABLE IF NOT EXISTS public.cmo_funnel_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id uuid NOT NULL REFERENCES public.cmo_funnels(id) ON DELETE CASCADE,
  stage_name text NOT NULL,
  stage_type text NOT NULL,
  stage_order integer NOT NULL DEFAULT 0,
  description text,
  objective text,
  entry_criteria text,
  exit_criteria text,
  kpis jsonb DEFAULT '[]'::jsonb,
  campaign_types jsonb DEFAULT '[]'::jsonb,
  channels jsonb DEFAULT '[]'::jsonb,
  content_assets jsonb DEFAULT '[]'::jsonb,
  target_icps jsonb DEFAULT '[]'::jsonb,
  linked_offers jsonb DEFAULT '[]'::jsonb,
  expected_volume integer DEFAULT 0,
  conversion_rate_target numeric DEFAULT 0,
  budget_allocation numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Helper function for funnel stages (skip if exists to avoid parameter name conflicts)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'funnel_stage_workspace_access') THEN
    EXECUTE 'CREATE FUNCTION public.funnel_stage_workspace_access(p_funnel_id uuid)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    AS $func$
      SELECT EXISTS (
        SELECT 1 FROM public.cmo_funnels f
        WHERE f.id = p_funnel_id
          AND user_has_workspace_access(f.workspace_id)
      )
    $func$';
  END IF;
END $$;
-- ============================================
-- CMO CAMPAIGN CHANNELS
-- ============================================

CREATE TABLE IF NOT EXISTS public.cmo_campaign_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.cmo_campaigns(id) ON DELETE CASCADE,
  channel_name text NOT NULL,
  channel_type text,
  priority text DEFAULT 'secondary',
  budget_percentage numeric DEFAULT 0,
  content_types jsonb DEFAULT '[]'::jsonb,
  expected_metrics jsonb DEFAULT '{}'::jsonb,
  posting_frequency text,
  targeting_notes text,
  is_paid boolean DEFAULT false,
  external_source text,
  external_account_id text,
  external_campaign_id text,
  external_adset_id text,
  external_ad_id text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Helper function for campaign channels (skip if exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'campaign_channel_workspace_access') THEN
    EXECUTE 'CREATE FUNCTION public.campaign_channel_workspace_access(channel_campaign_id uuid)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    AS $func$
      SELECT EXISTS (
        SELECT 1 FROM public.cmo_campaigns c
        WHERE c.id = channel_campaign_id
          AND user_has_workspace_access(c.workspace_id)
      )
    $func$';
  END IF;
END $$;
-- ============================================
-- CMO CONTENT VARIANTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.cmo_content_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  variant_name text NOT NULL,
  variant_type text DEFAULT 'A',
  subject_line text,
  headline text,
  body_content text,
  cta_text text,
  visual_description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  performance_metrics jsonb DEFAULT '{}'::jsonb,
  is_winner boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Helper function for content variants (skip if exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'content_variant_workspace_access') THEN
    EXECUTE 'CREATE FUNCTION public.content_variant_workspace_access(p_asset_id uuid)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    AS $func$
      SELECT EXISTS (
        SELECT 1 FROM public.assets a
        WHERE a.id = p_asset_id
          AND user_has_workspace_access(a.workspace_id)
      )
    $func$';
  END IF;
END $$;
-- ============================================
-- CMO CALENDAR EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.cmo_calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.cmo_campaigns(id),
  content_id uuid,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date,
  channel text,
  status text DEFAULT 'scheduled',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- ============================================
-- CMO WEEKLY SUMMARIES
-- ============================================

CREATE TABLE IF NOT EXISTS public.cmo_weekly_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  summary_text text,
  highlights jsonb DEFAULT '[]'::jsonb,
  lowlights jsonb DEFAULT '[]'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  metrics_summary jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- ============================================
-- CMO RECOMMENDATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS public.cmo_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid,
  recommendation_type text NOT NULL,
  priority text DEFAULT 'medium',
  title text NOT NULL,
  description text,
  rationale text,
  expected_impact text,
  effort_level text,
  status text DEFAULT 'pending',
  action_items jsonb DEFAULT '[]'::jsonb,
  implemented_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cmo_plan_milestones_plan_id ON public.cmo_plan_milestones(plan_id);
CREATE INDEX IF NOT EXISTS idx_cmo_funnel_stages_funnel_id ON public.cmo_funnel_stages(funnel_id);
CREATE INDEX IF NOT EXISTS idx_cmo_campaign_channels_campaign_id ON public.cmo_campaign_channels(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cmo_content_variants_asset_id ON public.cmo_content_variants(asset_id);
CREATE INDEX IF NOT EXISTS idx_cmo_calendar_events_workspace_id ON public.cmo_calendar_events(workspace_id);
-- Conditional index on start_date if column exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cmo_calendar_events' AND column_name = 'start_date') THEN
    CREATE INDEX IF NOT EXISTS idx_cmo_calendar_events_start_date ON public.cmo_calendar_events(start_date);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_cmo_weekly_summaries_workspace_id ON public.cmo_weekly_summaries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cmo_recommendations_workspace_id ON public.cmo_recommendations(workspace_id);
-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE public.cmo_plan_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_funnel_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_campaign_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_content_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_recommendations ENABLE ROW LEVEL SECURITY;
-- ============================================
-- RLS POLICIES (Workspace-based access)
-- ============================================

-- CMO Plan Milestones
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cmo_plan_milestones' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.cmo_plan_milestones FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.cmo_marketing_plans p WHERE p.id = plan_id AND user_has_workspace_access(p.workspace_id)));
  END IF;
END $$;
-- CMO Funnel Stages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cmo_funnel_stages' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.cmo_funnel_stages FOR SELECT
      USING (funnel_stage_workspace_access(funnel_id));
  END IF;
END $$;
-- CMO Campaign Channels
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cmo_campaign_channels' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.cmo_campaign_channels FOR SELECT
      USING (campaign_channel_workspace_access(campaign_id));
  END IF;
END $$;
-- CMO Content Variants
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cmo_content_variants' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.cmo_content_variants FOR SELECT
      USING (content_variant_workspace_access(asset_id));
  END IF;
END $$;
-- CMO Calendar Events
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cmo_calendar_events' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.cmo_calendar_events FOR SELECT
      USING (user_has_workspace_access(workspace_id));
  END IF;
END $$;
-- CMO Weekly Summaries
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cmo_weekly_summaries' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.cmo_weekly_summaries FOR SELECT
      USING (user_has_workspace_access(workspace_id));
  END IF;
END $$;
-- CMO Recommendations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cmo_recommendations' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.cmo_recommendations FOR SELECT
      USING (user_has_workspace_access(workspace_id));
  END IF;
END $$;
-- ============================================
-- MIGRATION COMPLETE: PART 2
-- CMO extended tables created
-- ============================================;
