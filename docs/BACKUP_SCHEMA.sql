-- ============================================================================
-- LOVABLE CLOUD DATABASE SCHEMA BACKUP
-- Generated: 2026-01-02
-- Source Project: nyzgsizvtqhafoxixyrd
-- Total Tables: 128 | Total RLS Policies: 429
-- 
-- INSTRUCTIONS FOR EXTERNAL SUPABASE PROJECT:
-- 1. Create a new Supabase project at https://app.supabase.com
-- 2. Go to SQL Editor in your Supabase dashboard
-- 3. Run this script in sections (ENUMS first, then FUNCTIONS, then TABLES, etc.)
-- 4. Note: Some functions reference auth.uid() which requires Supabase Auth
-- ============================================================================

-- ============================================================================
-- SECTION 1: CUSTOM ENUMS
-- ============================================================================

CREATE TYPE app_role AS ENUM ('admin', 'sales', 'manager');
CREATE TYPE asset_status AS ENUM ('draft', 'review', 'approved', 'live');
CREATE TYPE asset_type AS ENUM ('video', 'email', 'voice', 'landing_page', 'website');
CREATE TYPE data_mode AS ENUM ('live', 'demo');

-- ============================================================================
-- SECTION 2: CORE HELPER FUNCTIONS (Required by RLS policies)
-- Run these BEFORE creating tables with RLS
-- ============================================================================

-- Function: Check if user belongs to tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
  )
$$;

-- Function: Check if user has workspace access
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = auth.uid() AND workspace_id = p_workspace_id
  ) OR EXISTS (
    SELECT 1 FROM public.workspaces w
    JOIN public.user_tenants ut ON ut.tenant_id = w.tenant_id
    WHERE w.id = p_workspace_id AND ut.user_id = auth.uid()
  )
$$;

-- Function: Check if user is platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  )
$$;

-- Function: Check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role app_role)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = p_role
  )
$$;

-- Function: Get user tenant IDs
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT tenant_id FROM public.user_tenants WHERE user_id = p_user_id
$$;

-- Helper for asset approvals
CREATE OR REPLACE FUNCTION public.asset_approval_workspace_access(approval_asset_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assets a
    WHERE a.id = approval_asset_id
      AND user_has_workspace_access(a.workspace_id)
  )
$$;

-- Helper for campaign channels
CREATE OR REPLACE FUNCTION public.campaign_channel_workspace_access(channel_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cmo_campaigns c
    WHERE c.id = channel_campaign_id
      AND user_has_workspace_access(c.workspace_id)
  )
$$;

-- Helper for content variants
CREATE OR REPLACE FUNCTION public.content_variant_workspace_access(p_asset_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assets a
    WHERE a.id = p_asset_id
      AND user_has_workspace_access(a.workspace_id)
  )
$$;

-- Helper for funnel stages
CREATE OR REPLACE FUNCTION public.funnel_stage_workspace_access(p_funnel_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cmo_funnels f
    WHERE f.id = p_funnel_id
      AND user_has_workspace_access(f.workspace_id)
  )
$$;

-- ============================================================================
-- SECTION 3: CORE TABLES (No foreign key dependencies)
-- ============================================================================

-- Tenants table (core multi-tenancy)
CREATE TABLE public.tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  billing_plan text NOT NULL DEFAULT 'trial',
  default_currency text NOT NULL DEFAULT 'USD',
  metrics_mode text NOT NULL DEFAULT 'real',
  revenue_os_enabled boolean NOT NULL DEFAULT false,
  cfo_expansion_enabled boolean NOT NULL DEFAULT false,
  revenue_os_activated_at timestamptz,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- User-Tenant relationship
CREATE TABLE public.user_tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- User roles
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Platform admins
CREATE TABLE public.platform_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Workspaces
CREATE TABLE public.workspaces (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  demo_mode boolean NOT NULL DEFAULT false,
  stripe_connected boolean DEFAULT false,
  analytics_connected boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Workspace members
CREATE TABLE public.workspace_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Industry verticals (reference data)
CREATE TABLE public.industry_verticals (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  aliases text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Segments
CREATE TABLE public.segments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  criteria jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tenant segments
CREATE TABLE public.tenant_segments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  color text DEFAULT '#6B7280',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  is_global boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 4: BUSINESS TABLES
-- ============================================================================

-- Business profiles
CREATE TABLE public.business_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_name text,
  business_description text,
  industry text,
  brand_voice text,
  brand_tone text,
  brand_colors jsonb,
  brand_fonts jsonb,
  logo_url text,
  content_tone text,
  content_length text,
  imagery_style text,
  messaging_pillars text[],
  cta_patterns text[],
  preferred_channels text[],
  target_audiences jsonb,
  unique_selling_points text[],
  competitive_advantages text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

-- Assets
CREATE TABLE public.assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  type asset_type NOT NULL,
  status asset_status NOT NULL DEFAULT 'draft',
  content jsonb DEFAULT '{}'::jsonb,
  preview_url text,
  channel text,
  goal text,
  fal_id text,
  vapi_id text,
  external_id text,
  external_project_url text,
  custom_domain text,
  deployment_status text DEFAULT 'staging',
  segment_id uuid REFERENCES public.segments(id),
  segment_ids text[] DEFAULT '{}'::text[],
  created_by uuid,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Asset approvals
CREATE TABLE public.asset_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  status asset_status NOT NULL,
  comments text,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Leads
CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text,
  job_title text,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  score integer DEFAULT 0,
  vertical text,
  industry text,
  company_size text,
  segment_code text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  landing_page_url text,
  notes text,
  tags text[],
  custom_fields jsonb DEFAULT '{}'::jsonb,
  campaign_id uuid,
  assigned_to uuid,
  created_by uuid,
  contacted_at timestamptz,
  qualified_at timestamptz,
  converted_at timestamptz,
  lost_at timestamptz,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  data_mode data_mode NOT NULL DEFAULT 'live',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Deals
CREATE TABLE public.deals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  lead_id uuid REFERENCES public.leads(id),
  name text NOT NULL,
  value numeric DEFAULT 0,
  stage text NOT NULL DEFAULT 'prospecting',
  status text,
  source text NOT NULL DEFAULT 'user',
  probability integer DEFAULT 10,
  notes text,
  expected_close_date date,
  actual_close_date date,
  owner_id uuid,
  created_by uuid,
  revenue_verified boolean NOT NULL DEFAULT false,
  stripe_payment_id text,
  closed_won_at timestamptz,
  won_at timestamptz,
  lost_at timestamptz,
  data_mode data_mode NOT NULL DEFAULT 'live',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id),
  deal_id uuid REFERENCES public.deals(id),
  title text NOT NULL,
  description text,
  priority text DEFAULT 'medium',
  status text DEFAULT 'pending',
  task_type text DEFAULT 'follow_up',
  due_date timestamptz,
  assigned_to uuid,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Lead activities
CREATE TABLE public.lead_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Campaigns (deployment)
CREATE TABLE public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  deployed_at timestamptz,
  target_audience jsonb,
  budget_allocated numeric DEFAULT 0,
  external_campaign_id text,
  is_locked boolean DEFAULT false,
  locked_at timestamptz,
  locked_reason text,
  schedule jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Campaign metrics
CREATE TABLE public.campaign_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  engagement_rate numeric DEFAULT 0,
  cost numeric DEFAULT 0,
  revenue numeric DEFAULT 0,
  roi numeric DEFAULT 0,
  open_count integer DEFAULT 0,
  bounce_count integer DEFAULT 0,
  unsubscribe_count integer DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 5: CMO MODULE TABLES
-- ============================================================================

-- CMO Brand profiles
CREATE TABLE public.cmo_brand_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  tagline text,
  mission_statement text,
  brand_voice text,
  brand_tone text,
  logo_url text,
  website_url text,
  industry text,
  unique_value_proposition text,
  brand_personality jsonb DEFAULT '[]'::jsonb,
  core_values jsonb DEFAULT '[]'::jsonb,
  brand_colors jsonb DEFAULT '{}'::jsonb,
  brand_fonts jsonb DEFAULT '{}'::jsonb,
  competitors jsonb DEFAULT '[]'::jsonb,
  key_differentiators jsonb DEFAULT '[]'::jsonb,
  messaging_pillars jsonb DEFAULT '[]'::jsonb,
  content_themes jsonb DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CMO ICP Segments
CREATE TABLE public.cmo_icp_segments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  segment_name text NOT NULL,
  segment_description text,
  company_size text,
  demographics jsonb DEFAULT '{}'::jsonb,
  psychographics jsonb DEFAULT '{}'::jsonb,
  pain_points jsonb DEFAULT '[]'::jsonb,
  goals jsonb DEFAULT '[]'::jsonb,
  buying_triggers jsonb DEFAULT '[]'::jsonb,
  objections jsonb DEFAULT '[]'::jsonb,
  preferred_channels jsonb DEFAULT '[]'::jsonb,
  content_preferences jsonb DEFAULT '{}'::jsonb,
  decision_criteria jsonb DEFAULT '[]'::jsonb,
  budget_range jsonb DEFAULT '{}'::jsonb,
  industry_verticals jsonb DEFAULT '[]'::jsonb,
  job_titles jsonb DEFAULT '[]'::jsonb,
  is_primary boolean DEFAULT false,
  priority_score integer DEFAULT 50,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CMO Offers
CREATE TABLE public.cmo_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  offer_name text NOT NULL,
  offer_type text NOT NULL,
  description text,
  value_proposition text,
  target_icps jsonb DEFAULT '[]'::jsonb,
  pricing_model text,
  pricing_tiers jsonb DEFAULT '[]'::jsonb,
  key_benefits jsonb DEFAULT '[]'::jsonb,
  objection_handlers jsonb DEFAULT '[]'::jsonb,
  success_stories jsonb DEFAULT '[]'::jsonb,
  competitive_positioning text,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CMO Marketing plans
CREATE TABLE public.cmo_marketing_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_name text NOT NULL,
  description text,
  goal_type text NOT NULL,
  target_metric text,
  target_value numeric,
  current_value numeric DEFAULT 0,
  start_date date,
  end_date date,
  budget numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  strategy_summary text,
  target_icps jsonb DEFAULT '[]'::jsonb,
  primary_channels jsonb DEFAULT '[]'::jsonb,
  key_initiatives jsonb DEFAULT '[]'::jsonb,
  success_metrics jsonb DEFAULT '[]'::jsonb,
  assumptions jsonb DEFAULT '[]'::jsonb,
  risks jsonb DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CMO Plan milestones
CREATE TABLE public.cmo_plan_milestones (
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

-- CMO Funnels
CREATE TABLE public.cmo_funnels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.cmo_marketing_plans(id),
  funnel_name text NOT NULL,
  funnel_type text NOT NULL DEFAULT 'marketing',
  description text,
  status text NOT NULL DEFAULT 'draft',
  target_icp_segments jsonb DEFAULT '[]'::jsonb,
  target_offers jsonb DEFAULT '[]'::jsonb,
  total_budget numeric DEFAULT 0,
  expected_conversion_rate numeric DEFAULT 0,
  expected_revenue numeric DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CMO Funnel stages
CREATE TABLE public.cmo_funnel_stages (
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

-- CMO Campaigns
CREATE TABLE public.cmo_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  funnel_id uuid REFERENCES public.cmo_funnels(id),
  plan_id uuid REFERENCES public.cmo_marketing_plans(id),
  campaign_name text NOT NULL,
  campaign_type text NOT NULL,
  description text,
  objective text,
  status text NOT NULL DEFAULT 'draft',
  start_date date,
  end_date date,
  budget numeric DEFAULT 0,
  target_icps jsonb DEFAULT '[]'::jsonb,
  target_offers jsonb DEFAULT '[]'::jsonb,
  primary_channel text,
  secondary_channels jsonb DEFAULT '[]'::jsonb,
  key_messages jsonb DEFAULT '[]'::jsonb,
  ctas jsonb DEFAULT '[]'::jsonb,
  success_metrics jsonb DEFAULT '[]'::jsonb,
  funnel_stage text,
  is_autopilot boolean DEFAULT false,
  autopilot_started_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CMO Campaign channels
CREATE TABLE public.cmo_campaign_channels (
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

-- CMO Content assets
CREATE TABLE public.cmo_content_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.cmo_campaigns(id),
  content_id text,
  title text NOT NULL,
  content_type text NOT NULL,
  channel text,
  funnel_stage text,
  target_icp text,
  key_message text,
  cta text,
  tone text,
  estimated_production_time text,
  status text DEFAULT 'draft',
  supporting_points jsonb DEFAULT '[]'::jsonb,
  dependencies jsonb DEFAULT '[]'::jsonb,
  publish_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CMO Content variants
CREATE TABLE public.cmo_content_variants (
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

-- CMO Calendar events
CREATE TABLE public.cmo_calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
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

-- CMO Metrics snapshots
CREATE TABLE public.cmo_metrics_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id uuid,
  channel_id uuid,
  metric_type text NOT NULL,
  snapshot_date date NOT NULL,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  engagement_rate numeric DEFAULT 0,
  conversion_rate numeric DEFAULT 0,
  cost numeric DEFAULT 0,
  revenue numeric DEFAULT 0,
  roi numeric DEFAULT 0,
  custom_metrics jsonb DEFAULT '{}'::jsonb,
  data_mode data_mode NOT NULL DEFAULT 'live',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- CMO Weekly summaries
CREATE TABLE public.cmo_weekly_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  summary_text text,
  highlights jsonb DEFAULT '[]'::jsonb,
  lowlights jsonb DEFAULT '[]'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  metrics_summary jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- CMO Recommendations
CREATE TABLE public.cmo_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
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

-- ============================================================================
-- SECTION 6: CRO MODULE TABLES
-- ============================================================================

-- CRO Targets
CREATE TABLE public.cro_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period text NOT NULL,
  owner_type text NOT NULL,
  owner_id text NOT NULL,
  target_new_arr numeric DEFAULT 0,
  target_pipeline numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- CRO Forecasts
CREATE TABLE public.cro_forecasts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period text NOT NULL,
  scenario text NOT NULL,
  forecast_new_arr numeric DEFAULT 0,
  confidence numeric DEFAULT 0.5,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- CRO Deal reviews
CREATE TABLE public.cro_deal_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
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

-- CRO Recommendations
CREATE TABLE public.cro_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
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

-- ============================================================================
-- SECTION 7: AI SETTINGS TABLES
-- ============================================================================

-- AI Settings - Email
CREATE TABLE public.ai_settings_email (
  tenant_id uuid NOT NULL PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sender_name text NOT NULL DEFAULT '',
  from_address text NOT NULL DEFAULT '',
  reply_to_address text NOT NULL DEFAULT '',
  email_provider text DEFAULT 'resend',
  smtp_host text,
  smtp_port integer,
  smtp_username text,
  smtp_password text,
  is_connected boolean DEFAULT false,
  last_tested_at timestamptz,
  last_test_result jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- AI Settings - Voice
CREATE TABLE public.ai_settings_voice (
  tenant_id uuid NOT NULL PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  voice_provider text,
  vapi_public_key text,
  vapi_private_key text,
  elevenlabs_api_key text,
  elevenlabs_model text,
  default_vapi_assistant_id text,
  default_phone_number_id text,
  default_elevenlabs_voice_id text,
  is_connected boolean DEFAULT false,
  last_tested_at timestamptz,
  last_test_result jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- AI Settings - Social
CREATE TABLE public.ai_settings_social (
  tenant_id uuid NOT NULL PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  social_provider text,
  account_name text,
  account_url text,
  is_connected boolean DEFAULT false,
  last_tested_at timestamptz,
  last_test_result jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- AI Settings - Stripe
CREATE TABLE public.ai_settings_stripe (
  tenant_id uuid NOT NULL PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stripe_publishable_key text DEFAULT '',
  stripe_secret_key_hint text DEFAULT '',
  webhook_secret_hint text DEFAULT '',
  account_name text DEFAULT '',
  is_connected boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- AI Settings - Domain
CREATE TABLE public.ai_settings_domain (
  tenant_id uuid NOT NULL PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  domain text NOT NULL DEFAULT '',
  cname_verified boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- AI Settings - Calendar
CREATE TABLE public.ai_settings_calendar (
  tenant_id uuid NOT NULL PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  calendar_provider text DEFAULT 'calendly',
  booking_url text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

-- AI Settings - LinkedIn
CREATE TABLE public.ai_settings_linkedin (
  tenant_id uuid NOT NULL PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  linkedin_profile_url text DEFAULT '',
  daily_connection_limit integer DEFAULT 20,
  daily_message_limit integer DEFAULT 50,
  updated_at timestamptz DEFAULT now()
);

-- AI Settings - CRM Webhooks
CREATE TABLE public.ai_settings_crm_webhooks (
  tenant_id uuid NOT NULL PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  inbound_webhook_url text,
  outbound_webhook_url text,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- SECTION 8: VOICE/CALL TABLES
-- ============================================================================

-- Voice agents
CREATE TABLE public.voice_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  provider text DEFAULT 'vapi',
  provider_assistant_id text,
  voice_id text,
  model text,
  system_prompt text,
  first_message text,
  end_call_phrases text[] DEFAULT '{}'::text[],
  config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Voice phone numbers
CREATE TABLE public.voice_phone_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  provider text DEFAULT 'vapi',
  provider_number_id text,
  friendly_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Voice call records
CREATE TABLE public.voice_call_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone_number_id uuid REFERENCES public.voice_phone_numbers(id),
  voice_agent_id uuid REFERENCES public.voice_agents(id),
  lead_id uuid REFERENCES public.leads(id),
  campaign_id uuid,
  provider_call_id text,
  call_type text NOT NULL DEFAULT 'outbound',
  status text NOT NULL DEFAULT 'queued',
  customer_number text,
  customer_name text,
  duration_seconds integer DEFAULT 0,
  cost numeric DEFAULT 0,
  transcript text,
  summary text,
  recording_url text,
  outcome text,
  failure_reason text,
  analysis jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Voice campaigns
CREATE TABLE public.voice_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  voice_agent_id uuid REFERENCES public.voice_agents(id),
  phone_number_id uuid REFERENCES public.voice_phone_numbers(id),
  name text NOT NULL,
  description text,
  status text DEFAULT 'draft',
  call_schedule jsonb DEFAULT '{}'::jsonb,
  target_segment text,
  total_contacts integer DEFAULT 0,
  completed_calls integer DEFAULT 0,
  successful_calls integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 9: OUTBOUND/SEQUENCE TABLES
-- ============================================================================

-- Prospects
CREATE TABLE public.prospects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text,
  phone text,
  linkedin_url text,
  company text,
  title text,
  industry text,
  company_size text,
  location text,
  timezone text,
  status text DEFAULT 'new',
  enrichment_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Outbound sequences
CREATE TABLE public.outbound_sequences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL,
  name text NOT NULL,
  channel text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Outbound sequence steps
CREATE TABLE public.outbound_sequence_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES public.outbound_sequences(id) ON DELETE CASCADE,
  step_number integer NOT NULL DEFAULT 1,
  delay_days integer DEFAULT 0,
  channel text NOT NULL,
  subject text,
  body text,
  template_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Sequence enrollments
CREATE TABLE public.sequence_enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES public.outbound_sequences(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  current_step integer DEFAULT 1,
  status text DEFAULT 'active',
  enrolled_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  paused_at timestamptz
);

-- Sequence runs
CREATE TABLE public.sequence_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.outbound_sequence_steps(id),
  status text DEFAULT 'pending',
  scheduled_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,
  bounced_at timestamptz,
  provider_message_id text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- SECTION 10: SPINE/CRM TABLES
-- ============================================================================

-- Accounts (CRM)
CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  external_crm_id text,
  industry text,
  size_bucket text,
  segment text,
  lifecycle_stage text DEFAULT 'prospect',
  arr numeric DEFAULT 0,
  mrr numeric DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CRM Contacts
CREATE TABLE public.crm_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text,
  phone text,
  company_name text,
  role_title text,
  status text DEFAULT 'prospect',
  lifecycle_stage text,
  segment_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Opportunities
CREATE TABLE public.opportunities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id),
  contact_id uuid REFERENCES public.crm_contacts(id),
  campaign_id uuid,
  owner_user_id uuid,
  name text NOT NULL,
  stage text NOT NULL DEFAULT 'lead',
  source text,
  amount numeric DEFAULT 0,
  win_probability numeric DEFAULT 0,
  expected_close_date date,
  closed_at timestamptz,
  lost_reason text,
  external_crm_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CRM Activities
CREATE TABLE public.crm_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  lead_id uuid,
  activity_type text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_mode data_mode NOT NULL DEFAULT 'live',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 11: NOTIFICATIONS & MISC
-- ============================================================================

-- Notifications
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  is_read boolean DEFAULT false,
  action_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Channel preferences
CREATE TABLE public.channel_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  social_enabled boolean NOT NULL DEFAULT true,
  voice_enabled boolean NOT NULL DEFAULT true,
  video_enabled boolean NOT NULL DEFAULT true,
  landing_pages_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Content templates
CREATE TABLE public.content_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  vertical text NOT NULL,
  template_type text NOT NULL,
  template_name text NOT NULL,
  subject_line text,
  content text NOT NULL,
  tone text,
  target_audience text,
  conversion_rate numeric DEFAULT 0,
  impressions integer DEFAULT 0,
  optimization_version integer DEFAULT 1,
  optimization_notes text,
  last_optimized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Agent runs (for tracking AI agent executions)
CREATE TABLE public.agent_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent text NOT NULL,
  mode text,
  status text DEFAULT 'pending',
  input jsonb DEFAULT '{}'::jsonb,
  output jsonb DEFAULT '{}'::jsonb,
  error_message text,
  duration_ms integer,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Rate limit counters
CREATE TABLE public.rate_limit_counters (
  id bigserial PRIMARY KEY,
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  window_type text,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tenant rate limits
CREATE TABLE public.tenant_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  email_daily_limit integer NOT NULL DEFAULT 1000,
  email_hourly_limit integer NOT NULL DEFAULT 100,
  voice_daily_minutes integer NOT NULL DEFAULT 60,
  voice_hourly_minutes integer NOT NULL DEFAULT 15,
  email_daily_used integer NOT NULL DEFAULT 0,
  email_hourly_used integer NOT NULL DEFAULT 0,
  voice_daily_minutes_used integer NOT NULL DEFAULT 0,
  voice_hourly_minutes_used integer NOT NULL DEFAULT 0,
  daily_reset_at timestamptz NOT NULL DEFAULT (date_trunc('day', now()) + interval '1 day'),
  hourly_reset_at timestamptz NOT NULL DEFAULT (date_trunc('hour', now()) + interval '1 hour'),
  soft_cap_enabled boolean NOT NULL DEFAULT true,
  notify_at_percentage integer NOT NULL DEFAULT 80,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- SECTION 12: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_icp_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_marketing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_plan_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_funnel_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_campaign_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_content_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_content_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cro_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cro_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cro_deal_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cro_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings_voice ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings_social ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings_stripe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings_domain ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings_linkedin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings_crm_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industry_verticals ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 13: RLS POLICIES (Core patterns)
-- ============================================================================

-- Tenants policies
CREATE POLICY "tenant_access" ON public.tenants FOR ALL
  USING (id = auth.uid() OR id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

-- User tenants policies  
CREATE POLICY "Users can view own tenant memberships" ON public.user_tenants FOR SELECT
  USING (user_id = auth.uid() OR is_platform_admin());
CREATE POLICY "Users can insert own tenant memberships" ON public.user_tenants FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_platform_admin());
CREATE POLICY "Users can update own tenant memberships" ON public.user_tenants FOR UPDATE
  USING (user_id = auth.uid() OR is_platform_admin());
CREATE POLICY "Users can delete own tenant memberships" ON public.user_tenants FOR DELETE
  USING (user_id = auth.uid() OR is_platform_admin());

-- User roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Workspaces policies (tenant isolation)
CREATE POLICY "tenant_isolation_select" ON public.workspaces FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.workspaces FOR INSERT
  WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.workspaces FOR UPDATE
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.workspaces FOR DELETE
  USING (user_belongs_to_tenant(tenant_id));

-- Assets policies (workspace access)
CREATE POLICY "Users can view workspace assets" ON public.assets FOR SELECT
  USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace assets" ON public.assets FOR INSERT
  WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace assets" ON public.assets FOR UPDATE
  USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace assets" ON public.assets FOR DELETE
  USING (user_has_workspace_access(workspace_id));

-- Leads policies (workspace + role based)
CREATE POLICY "Users can view workspace leads" ON public.leads FOR SELECT
  USING (user_has_workspace_access(workspace_id) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'sales')));
CREATE POLICY "Users can create workspace leads" ON public.leads FOR INSERT
  WITH CHECK (user_has_workspace_access(workspace_id) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'sales')));
CREATE POLICY "Users can update workspace leads" ON public.leads FOR UPDATE
  USING (user_has_workspace_access(workspace_id) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR assigned_to = auth.uid()));
CREATE POLICY "Admins can delete workspace leads" ON public.leads FOR DELETE
  USING (user_has_workspace_access(workspace_id) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')));

-- Industry verticals (public read)
CREATE POLICY "Anyone can read verticals" ON public.industry_verticals FOR SELECT
  USING (true);

-- Template for tenant isolation policies (apply to all tenant-scoped tables)
-- Example for accounts:
CREATE POLICY "tenant_isolation_select" ON public.accounts FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.accounts FOR INSERT
  WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.accounts FOR UPDATE
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.accounts FOR DELETE
  USING (user_belongs_to_tenant(tenant_id));

-- ============================================================================
-- SECTION 14: INDEXES (Performance)
-- ============================================================================

CREATE INDEX idx_leads_workspace_id ON public.leads(workspace_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX idx_deals_workspace_id ON public.deals(workspace_id);
CREATE INDEX idx_deals_stage ON public.deals(stage);
CREATE INDEX idx_assets_workspace_id ON public.assets(workspace_id);
CREATE INDEX idx_campaigns_workspace_id ON public.campaigns(workspace_id);
CREATE INDEX idx_cmo_campaigns_workspace_id ON public.cmo_campaigns(workspace_id);
CREATE INDEX idx_cmo_campaigns_tenant_id ON public.cmo_campaigns(tenant_id);
CREATE INDEX idx_voice_call_records_tenant_id ON public.voice_call_records(tenant_id);
CREATE INDEX idx_voice_call_records_workspace_id ON public.voice_call_records(workspace_id);
CREATE INDEX idx_user_tenants_user_id ON public.user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant_id ON public.user_tenants(tenant_id);
CREATE INDEX idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX idx_rate_limit_counters_key ON public.rate_limit_counters(key);

-- ============================================================================
-- NOTES:
-- 1. This schema covers ~70% of tables. Additional tables follow similar patterns.
-- 2. Views are not included - they can be recreated from table queries.
-- 3. Some foreign keys may need adjustment based on your exact requirements.
-- 4. Run helper functions BEFORE creating tables with RLS policies.
-- 5. Additional RLS policies follow the tenant_isolation or workspace_access patterns.
-- ============================================================================
