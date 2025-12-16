-- Create SECURITY DEFINER function to get user's tenant IDs without RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tenant_id FROM public.user_tenants WHERE user_id = _user_id
$$;

-- Drop the problematic user_tenants SELECT policy
DROP POLICY IF EXISTS "Users can view tenant memberships" ON public.user_tenants;

-- Recreate with SECURITY DEFINER function to avoid recursion
CREATE POLICY "Users can view tenant memberships" ON public.user_tenants
FOR SELECT
USING (
  is_platform_admin() 
  OR user_id = auth.uid() 
  OR tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
);