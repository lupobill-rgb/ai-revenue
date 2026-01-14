-- Fix the existing is_platform_admin function in place (don't drop, just replace)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;
-- Drop the recursive policy on user_tenants
DROP POLICY IF EXISTS "Users can view tenant memberships" ON public.user_tenants;
-- Create a non-recursive policy
CREATE POLICY "Users can view own tenant memberships"
ON public.user_tenants
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_platform_admin()
);
-- Other policies for user_tenants
DROP POLICY IF EXISTS "Users can insert own tenant memberships" ON public.user_tenants;
CREATE POLICY "Users can insert own tenant memberships"
ON public.user_tenants
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR public.is_platform_admin()
);
DROP POLICY IF EXISTS "Users can update own tenant memberships" ON public.user_tenants;
CREATE POLICY "Users can update own tenant memberships"
ON public.user_tenants
FOR UPDATE
USING (
  user_id = auth.uid()
  OR public.is_platform_admin()
);
DROP POLICY IF EXISTS "Users can delete own tenant memberships" ON public.user_tenants;
CREATE POLICY "Users can delete own tenant memberships"
ON public.user_tenants
FOR DELETE
USING (
  user_id = auth.uid()
  OR public.is_platform_admin()
);
