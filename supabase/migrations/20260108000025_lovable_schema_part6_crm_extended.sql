-- ============================================
-- LOVABLE CLOUD SCHEMA MIGRATION - PART 6
-- CRM Extended Module (Accounts, Opportunities, Contacts)
-- Source: BACKUP_SCHEMA.sql
-- ============================================

-- ============================================
-- ACCOUNTS (CRM)
-- ============================================

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
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
-- ============================================
-- CRM CONTACTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
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
-- ============================================
-- OPPORTUNITIES
-- ============================================

CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
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
-- ============================================
-- CRM ACTIVITIES (Extended)
-- Note: Phase 3 already has lead_activities, this is for CRM contacts
-- ============================================

CREATE TABLE IF NOT EXISTS public.crm_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id),
  activity_type text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_mode data_mode NOT NULL DEFAULT 'live',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS public.notifications (
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
-- ============================================
-- CHANNEL PREFERENCES
-- ============================================

CREATE TABLE IF NOT EXISTS public.channel_preferences (
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
-- ============================================
-- AGENT RUNS (AI Agent Tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
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
-- ============================================
-- RATE LIMIT COUNTERS
-- ============================================

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  id bigserial PRIMARY KEY,
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  window_type text,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- ============================================
-- INDEXES
-- ============================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_accounts_tenant_id ON public.accounts(tenant_id)';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_accounts_industry ON public.accounts(industry);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_contacts' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_crm_contacts_tenant_id ON public.crm_contacts(tenant_id)';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON public.crm_contacts(email);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'opportunities' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_id ON public.opportunities(tenant_id)';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_opportunities_account_id ON public.opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON public.opportunities(stage);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_activities' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_crm_activities_tenant_id ON public.crm_activities(tenant_id)';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_id ON public.crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id ON public.notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_preferences_user_id ON public.channel_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_workspace_id ON public.agent_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON public.agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_key ON public.rate_limit_counters(key);
-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
-- ============================================
-- RLS POLICIES
-- ============================================

-- Accounts
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'tenant_id'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'tenant_access_select') THEN
      CREATE POLICY "tenant_access_select" ON public.accounts FOR SELECT
        USING (user_belongs_to_tenant(tenant_id));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'tenant_access_insert') THEN
      CREATE POLICY "tenant_access_insert" ON public.accounts FOR INSERT
        WITH CHECK (user_belongs_to_tenant(tenant_id));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'tenant_access_update') THEN
      CREATE POLICY "tenant_access_update" ON public.accounts FOR UPDATE
        USING (user_belongs_to_tenant(tenant_id));
    END IF;
  END IF;
END $$;
-- CRM Contacts
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_contacts' AND column_name = 'tenant_id'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_contacts' AND policyname = 'tenant_access_select') THEN
      CREATE POLICY "tenant_access_select" ON public.crm_contacts FOR SELECT
        USING (user_belongs_to_tenant(tenant_id));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_contacts' AND policyname = 'tenant_access_insert') THEN
      CREATE POLICY "tenant_access_insert" ON public.crm_contacts FOR INSERT
        WITH CHECK (user_belongs_to_tenant(tenant_id));
    END IF;
  END IF;
END $$;
-- Opportunities
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'opportunities' AND column_name = 'tenant_id'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'opportunities' AND policyname = 'tenant_access_select') THEN
      CREATE POLICY "tenant_access_select" ON public.opportunities FOR SELECT
        USING (user_belongs_to_tenant(tenant_id));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'opportunities' AND policyname = 'tenant_access_insert') THEN
      CREATE POLICY "tenant_access_insert" ON public.opportunities FOR INSERT
        WITH CHECK (user_belongs_to_tenant(tenant_id));
    END IF;
  END IF;
END $$;
-- CRM Activities
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_activities' AND column_name = 'tenant_id'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_activities' AND policyname = 'tenant_access_select') THEN
      CREATE POLICY "tenant_access_select" ON public.crm_activities FOR SELECT
        USING (user_belongs_to_tenant(tenant_id));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_activities' AND policyname = 'tenant_access_insert') THEN
      CREATE POLICY "tenant_access_insert" ON public.crm_activities FOR INSERT
        WITH CHECK (user_belongs_to_tenant(tenant_id));
    END IF;
  END IF;
END $$;
-- Notifications
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.notifications FOR SELECT
      USING (user_has_workspace_access(workspace_id) OR user_id = auth.uid());
  END IF;
END $$;
-- Channel Preferences
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'channel_preferences' AND policyname = 'user_access_select') THEN
    CREATE POLICY "user_access_select" ON public.channel_preferences FOR SELECT
      USING (user_id = auth.uid());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'channel_preferences' AND policyname = 'user_access_insert') THEN
    CREATE POLICY "user_access_insert" ON public.channel_preferences FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
-- Agent Runs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_runs' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.agent_runs FOR SELECT
      USING (user_has_workspace_access(workspace_id));
  END IF;
END $$;
-- ============================================
-- MIGRATION COMPLETE: PART 6
-- CRM extended tables created
-- ============================================;
