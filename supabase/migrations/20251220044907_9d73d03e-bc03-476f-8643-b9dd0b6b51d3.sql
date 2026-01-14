-- SEC-2 FIX: Remove overly permissive SELECT policy on os_tenant_registry
-- This policy allowed any authenticated user to see all tenant names
DROP POLICY IF EXISTS "Authenticated users can view tenant registry" ON public.os_tenant_registry;
-- Add proper tenant-scoped SELECT policy
CREATE POLICY "Users can view their own tenant registry" 
ON public.os_tenant_registry 
FOR SELECT 
USING (user_belongs_to_tenant(tenant_id));
-- SEC-2 FIX: Remove overly permissive SELECT policy on tenant_module_access
-- This policy allowed anyone to see all tenant module configurations
DROP POLICY IF EXISTS "Authenticated users can view module access" ON public.tenant_module_access;
DROP POLICY IF EXISTS "Service role can manage module access" ON public.tenant_module_access;
-- Note: tenant_module_access already has tenant_isolation_select policy that uses user_belongs_to_tenant(tenant_id)
-- The duplicate permissive policies were the issue - now only the restrictive tenant isolation policies remain;
