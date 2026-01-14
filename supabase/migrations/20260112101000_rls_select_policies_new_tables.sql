-- Minimal RLS SELECT policies for new additive tables used by channel MVPs.
-- These enable CI smoke harness verification without granting write access from clients.
--
-- NOTE: We intentionally only add SELECT policies (no INSERT/UPDATE/DELETE) to keep writes service-role-only.

-- opt_outs
ALTER TABLE public.opt_outs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_access_select" ON public.opt_outs;
CREATE POLICY "workspace_access_select" ON public.opt_outs
FOR SELECT USING (user_has_workspace_access(tenant_id));
-- usage_events
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_access_select" ON public.usage_events;
CREATE POLICY "workspace_access_select" ON public.usage_events
FOR SELECT USING (user_has_workspace_access(tenant_id));
-- campaign_assets
ALTER TABLE public.campaign_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_access_select" ON public.campaign_assets;
CREATE POLICY "workspace_access_select" ON public.campaign_assets
FOR SELECT USING (user_has_workspace_access(tenant_id));
-- approvals
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_access_select" ON public.approvals;
CREATE POLICY "workspace_access_select" ON public.approvals
FOR SELECT USING (user_has_workspace_access(tenant_id));
-- message_logs
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_access_select" ON public.message_logs;
CREATE POLICY "workspace_access_select" ON public.message_logs
FOR SELECT USING (user_has_workspace_access(tenant_id));
