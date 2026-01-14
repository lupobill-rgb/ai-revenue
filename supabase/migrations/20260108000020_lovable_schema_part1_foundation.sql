-- ============================================
-- LOVABLE CLOUD SCHEMA MIGRATION - PART 1
-- Foundation: Enums, Helper Functions, Core Tables
-- Source: BACKUP_SCHEMA.sql
-- ============================================

-- ============================================
-- SECTION 1: CUSTOM ENUMS
-- ============================================

-- App role enum (if not exists)
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'sales', 'manager');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
-- Asset status enum (if not exists)
DO $$ BEGIN
  CREATE TYPE asset_status AS ENUM ('draft', 'review', 'approved', 'live');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
-- Asset type enum (if not exists) 
DO $$ BEGIN
  CREATE TYPE asset_type AS ENUM ('video', 'email', 'voice', 'landing_page', 'website');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
-- Data mode enum (if not exists)
DO $$ BEGIN
  CREATE TYPE data_mode AS ENUM ('live', 'demo');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
-- ============================================
-- SECTION 2: TENANTS TABLE (Core Multi-Tenancy)
-- Note: Phase 3 uses workspaces as primary, but Lovable needs tenants
-- We'll create tenants and link them to workspaces
-- ============================================

CREATE TABLE IF NOT EXISTS public.tenants (
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
-- Add tenant_id to workspaces if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'workspaces' 
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.workspaces ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
-- ============================================
-- SECTION 3: USER-TENANT RELATIONSHIP
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);
-- ============================================
-- SECTION 4: USER ROLES
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
-- ============================================
-- SECTION 5: PLATFORM ADMINS
-- ============================================

CREATE TABLE IF NOT EXISTS public.platform_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- ============================================
-- SECTION 6: HELPER FUNCTIONS FOR RLS
-- Note: These functions already exist in Phase 3, skipping to avoid breaking existing policies
-- ============================================

-- Functions user_belongs_to_tenant, is_platform_admin, has_role, get_user_tenant_ids already exist
-- Skipping recreation to preserve existing RLS policy dependencies

-- ============================================
-- SECTION 7: INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id ON public.user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_id ON public.user_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
-- ============================================
-- SECTION 8: ENABLE RLS ON NEW TABLES
-- ============================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
-- ============================================
-- SECTION 9: BASIC RLS POLICIES
-- ============================================

-- Tenants policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenants' AND policyname = 'tenant_access') THEN
    CREATE POLICY "tenant_access" ON public.tenants FOR ALL
      USING (id = auth.uid() OR id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
  END IF;
END $$;
-- User tenants policies  
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_tenants' AND policyname = 'Users can view own tenant memberships') THEN
    CREATE POLICY "Users can view own tenant memberships" ON public.user_tenants FOR SELECT
      USING (user_id = auth.uid() OR is_platform_admin());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_tenants' AND policyname = 'Users can insert own tenant memberships') THEN
    CREATE POLICY "Users can insert own tenant memberships" ON public.user_tenants FOR INSERT
      WITH CHECK (user_id = auth.uid() OR is_platform_admin());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_tenants' AND policyname = 'Users can update own tenant memberships') THEN
    CREATE POLICY "Users can update own tenant memberships" ON public.user_tenants FOR UPDATE
      USING (user_id = auth.uid() OR is_platform_admin());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_tenants' AND policyname = 'Users can delete own tenant memberships') THEN
    CREATE POLICY "Users can delete own tenant memberships" ON public.user_tenants FOR DELETE
      USING (user_id = auth.uid() OR is_platform_admin());
  END IF;
END $$;
-- User roles policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Users can view their own roles') THEN
    CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT
      USING (user_id = auth.uid());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Admins can manage all roles') THEN
    CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL
      USING (has_role(auth.uid(), 'admin'));
  END IF;
END $$;
-- ============================================
-- MIGRATION COMPLETE: PART 1
-- Foundation tables and functions created
-- ============================================;
