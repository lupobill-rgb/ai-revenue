-- First drop the uuid-parameter version with CASCADE to remove all dependent policies
DROP FUNCTION IF EXISTS public.is_platform_admin(uuid) CASCADE;

-- Drop the parameter-less one too so we can recreate it cleanly
DROP FUNCTION IF EXISTS public.is_platform_admin() CASCADE;

-- Create the single is_platform_admin function (no parameters, uses auth.uid())
CREATE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id = auth.uid()
      AND is_active = true
  )
$$;

-- Recreate all RLS policies using the new function

-- tenants policies
CREATE POLICY tenant_isolation ON public.tenants FOR ALL
USING (is_platform_admin() OR id = auth.uid() OR id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

-- workspaces policies
CREATE POLICY "Users can view workspaces" ON public.workspaces FOR SELECT
USING (is_platform_admin() OR owner_id = auth.uid() OR id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- user_tenants policies
CREATE POLICY "Users can view tenant memberships" ON public.user_tenants FOR SELECT
USING (is_platform_admin() OR user_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

-- platform_admins policies
CREATE POLICY platform_admins_select ON public.platform_admins FOR SELECT USING (is_platform_admin() OR user_id = auth.uid());
CREATE POLICY platform_admins_insert ON public.platform_admins FOR INSERT WITH CHECK (is_platform_admin());
CREATE POLICY platform_admins_update ON public.platform_admins FOR UPDATE USING (is_platform_admin());

-- rate_limit_counters policy
CREATE POLICY platform_admin_only ON public.rate_limit_counters FOR ALL USING (is_platform_admin());

-- slo_metrics policy
CREATE POLICY "Platform admins can view slo_metrics" ON public.slo_metrics FOR SELECT USING (is_platform_admin());

-- slo_alerts policies
CREATE POLICY "Platform admins can view slo_alerts" ON public.slo_alerts FOR SELECT USING (is_platform_admin());
CREATE POLICY "Platform admins can update slo_alerts" ON public.slo_alerts FOR UPDATE USING (is_platform_admin());

-- slo_config policies
CREATE POLICY "Platform admins can view slo_config" ON public.slo_config FOR SELECT USING (is_platform_admin());
CREATE POLICY "Platform admins can update slo_config" ON public.slo_config FOR UPDATE USING (is_platform_admin());

-- tenant_rate_limits policy
CREATE POLICY "Platform admins can manage all rate limits" ON public.tenant_rate_limits FOR ALL USING (is_platform_admin());

-- rate_limit_events policy  
CREATE POLICY "Platform admins can view all rate limit events" ON public.rate_limit_events FOR SELECT USING (is_platform_admin());