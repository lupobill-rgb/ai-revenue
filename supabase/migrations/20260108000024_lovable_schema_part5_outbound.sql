-- ============================================
-- LOVABLE CLOUD SCHEMA MIGRATION - PART 5
-- Outbound/Sequence Management Module
-- Source: BACKUP_SCHEMA.sql
-- ============================================

-- ============================================
-- PROSPECTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.prospects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
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
  persona_tag text,
  external_id text,
  enrichment_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- ============================================
-- OUTBOUND SEQUENCES
-- ============================================

CREATE TABLE IF NOT EXISTS public.outbound_sequences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL,
  name text NOT NULL,
  channel text NOT NULL,
  created_at timestamptz DEFAULT now()
);
-- ============================================
-- OUTBOUND SEQUENCE STEPS
-- ============================================

CREATE TABLE IF NOT EXISTS public.outbound_sequence_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES public.outbound_sequences(id) ON DELETE CASCADE,
  step_number integer NOT NULL DEFAULT 1,
  delay_days integer DEFAULT 0,
  channel text NOT NULL,
  subject text,
  body text,
  template_id uuid,
  created_at timestamptz DEFAULT now()
);
-- ============================================
-- SEQUENCE ENROLLMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.sequence_enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sequence_id uuid REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE CASCADE,
  current_step integer DEFAULT 1,
  status text DEFAULT 'active',
  next_email_at timestamptz,
  enrolled_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- ============================================
-- SEQUENCE RUNS
-- ============================================

CREATE TABLE IF NOT EXISTS public.sequence_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
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
-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_prospects_workspace_id ON public.prospects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_prospects_tenant_id ON public.prospects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prospects_email ON public.prospects(email);
CREATE INDEX IF NOT EXISTS idx_outbound_sequences_tenant_id ON public.outbound_sequences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_outbound_sequence_steps_sequence_id ON public.outbound_sequence_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_workspace_id ON public.sequence_enrollments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON public.sequence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_sequence_runs_enrollment_id ON public.sequence_runs(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_sequence_runs_status ON public.sequence_runs(status);
-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_runs ENABLE ROW LEVEL SECURITY;
-- ============================================
-- RLS POLICIES
-- ============================================

-- Prospects
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prospects' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.prospects FOR SELECT
      USING (user_has_workspace_access(workspace_id));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prospects' AND policyname = 'workspace_access_insert') THEN
    CREATE POLICY "workspace_access_insert" ON public.prospects FOR INSERT
      WITH CHECK (user_has_workspace_access(workspace_id));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prospects' AND policyname = 'workspace_access_update') THEN
    CREATE POLICY "workspace_access_update" ON public.prospects FOR UPDATE
      USING (user_has_workspace_access(workspace_id));
  END IF;
END $$;
-- Outbound Sequences (tenant-based)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'outbound_sequences' AND policyname = 'tenant_access_select') THEN
    CREATE POLICY "tenant_access_select" ON public.outbound_sequences FOR SELECT
      USING (tenant_id IS NULL OR user_belongs_to_tenant(tenant_id));
  END IF;
END $$;
-- Sequence Enrollments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sequence_enrollments' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.sequence_enrollments FOR SELECT
      USING (workspace_id IS NULL OR user_has_workspace_access(workspace_id));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sequence_enrollments' AND policyname = 'workspace_access_insert') THEN
    CREATE POLICY "workspace_access_insert" ON public.sequence_enrollments FOR INSERT
      WITH CHECK (workspace_id IS NULL OR user_has_workspace_access(workspace_id));
  END IF;
END $$;
-- Sequence Runs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sequence_runs' AND policyname = 'tenant_access_select') THEN
    CREATE POLICY "tenant_access_select" ON public.sequence_runs FOR SELECT
      USING (tenant_id IS NULL OR user_belongs_to_tenant(tenant_id));
  END IF;
END $$;
-- ============================================
-- MIGRATION COMPLETE: PART 5
-- Outbound/Sequence tables created
-- ============================================;
