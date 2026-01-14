-- ============================================
-- LOVABLE CLOUD SCHEMA MIGRATION - PART 4
-- Voice/Call Management Module
-- Source: BACKUP_SCHEMA.sql
-- ============================================

-- ============================================
-- VOICE AGENTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.voice_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
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
-- ============================================
-- VOICE PHONE NUMBERS
-- ============================================

CREATE TABLE IF NOT EXISTS public.voice_phone_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  provider text DEFAULT 'vapi',
  provider_number_id text,
  friendly_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- ============================================
-- VOICE CALL RECORDS
-- ============================================

CREATE TABLE IF NOT EXISTS public.voice_call_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
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
-- ============================================
-- VOICE CAMPAIGNS
-- ============================================

CREATE TABLE IF NOT EXISTS public.voice_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
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
-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_voice_agents_workspace_id ON public.voice_agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_voice_agents_tenant_id ON public.voice_agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voice_phone_numbers_workspace_id ON public.voice_phone_numbers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_voice_call_records_workspace_id ON public.voice_call_records(workspace_id);
CREATE INDEX IF NOT EXISTS idx_voice_call_records_tenant_id ON public.voice_call_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voice_call_records_lead_id ON public.voice_call_records(lead_id);
CREATE INDEX IF NOT EXISTS idx_voice_call_records_status ON public.voice_call_records(status);
CREATE INDEX IF NOT EXISTS idx_voice_campaigns_workspace_id ON public.voice_campaigns(workspace_id);
-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE public.voice_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_campaigns ENABLE ROW LEVEL SECURITY;
-- ============================================
-- RLS POLICIES
-- ============================================

-- Voice Agents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_agents' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.voice_agents FOR SELECT
      USING (user_has_workspace_access(workspace_id));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_agents' AND policyname = 'workspace_access_insert') THEN
    CREATE POLICY "workspace_access_insert" ON public.voice_agents FOR INSERT
      WITH CHECK (user_has_workspace_access(workspace_id));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_agents' AND policyname = 'workspace_access_update') THEN
    CREATE POLICY "workspace_access_update" ON public.voice_agents FOR UPDATE
      USING (user_has_workspace_access(workspace_id));
  END IF;
END $$;
-- Voice Phone Numbers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_phone_numbers' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.voice_phone_numbers FOR SELECT
      USING (user_has_workspace_access(workspace_id));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_phone_numbers' AND policyname = 'workspace_access_insert') THEN
    CREATE POLICY "workspace_access_insert" ON public.voice_phone_numbers FOR INSERT
      WITH CHECK (user_has_workspace_access(workspace_id));
  END IF;
END $$;
-- Voice Call Records
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_call_records' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.voice_call_records FOR SELECT
      USING (user_has_workspace_access(workspace_id));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_call_records' AND policyname = 'workspace_access_insert') THEN
    CREATE POLICY "workspace_access_insert" ON public.voice_call_records FOR INSERT
      WITH CHECK (user_has_workspace_access(workspace_id));
  END IF;
END $$;
-- Voice Campaigns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_campaigns' AND policyname = 'workspace_access_select') THEN
    CREATE POLICY "workspace_access_select" ON public.voice_campaigns FOR SELECT
      USING (user_has_workspace_access(workspace_id));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_campaigns' AND policyname = 'workspace_access_insert') THEN
    CREATE POLICY "workspace_access_insert" ON public.voice_campaigns FOR INSERT
      WITH CHECK (user_has_workspace_access(workspace_id));
  END IF;
END $$;
-- ============================================
-- MIGRATION COMPLETE: PART 4
-- Voice/Call management tables created
-- ============================================;
