-- Create platform_admins table for UbiGrowth team members
CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email text NOT NULL,
  name text,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
-- Enable RLS (only platform admins can manage this table)
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
-- Only existing platform admins can view/manage this table
CREATE POLICY "Platform admins can view all"
ON public.platform_admins
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "Platform admins can insert"
ON public.platform_admins
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "Platform admins can update"
ON public.platform_admins
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND is_active = true)
);
-- Security definer function to check platform admin status (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id = _user_id
      AND is_active = true
  )
$$;
-- Update tenant_segments RLS to include platform admin access
DROP POLICY IF EXISTS "Users can view segments" ON public.tenant_segments;
CREATE POLICY "Users can view segments"
ON public.tenant_segments
FOR SELECT
USING (
  is_platform_admin()
  OR is_global = true 
  OR tenant_id = auth.uid() 
  OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
);
-- Update key tables RLS policies to include platform admin access

-- tenants table (skip if doesn't exist - legacy table)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') THEN
    EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation" ON public.tenants';
    EXECUTE 'CREATE POLICY "tenant_isolation" ON public.tenants FOR ALL USING (
      is_platform_admin()
      OR id = auth.uid()
      OR id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
    )';
  END IF;
END $$;
-- user_tenants table - allow platform admins to see all mappings
DROP POLICY IF EXISTS "Users can view their tenant memberships" ON public.user_tenants;
DROP POLICY IF EXISTS "tenant_isolation" ON public.user_tenants;
CREATE POLICY "Users can view tenant memberships"
ON public.user_tenants
FOR SELECT
USING (
  is_platform_admin()
  OR user_id = auth.uid()
  OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
);
-- workspaces table
DROP POLICY IF EXISTS "Users can view their own workspaces" ON public.workspaces;
CREATE POLICY "Users can view workspaces"
ON public.workspaces
FOR SELECT
USING (
  is_platform_admin()
  OR owner_id = auth.uid()
  OR id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);
-- Update user_has_workspace_access function to include platform admin check
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  has_access boolean;
BEGIN
  -- Platform admins have access to all workspaces
  IF public.is_platform_admin(auth.uid()) THEN
    RETURN TRUE;
  END IF;

  -- Check if user is owner
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND owner_id = auth.uid()
  ) INTO has_access;
  
  IF has_access THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is member
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = auth.uid()
  ) INTO has_access;
  
  RETURN has_access;
END;
$$;
-- Create index for performance
CREATE INDEX idx_platform_admins_user_id ON public.platform_admins(user_id) WHERE is_active = true;
CREATE INDEX idx_platform_admins_email ON public.platform_admins(email);
