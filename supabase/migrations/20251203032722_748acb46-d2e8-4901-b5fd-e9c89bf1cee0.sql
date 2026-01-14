-- Security definer function to check workspace membership
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = auth.uid()
  )
$$;
-- Content Calendar RLS
DROP POLICY IF EXISTS "Authenticated users can view calendar" ON public.content_calendar;
DROP POLICY IF EXISTS "Authenticated users can create calendar items" ON public.content_calendar;
DROP POLICY IF EXISTS "Authenticated users can update calendar items" ON public.content_calendar;
DROP POLICY IF EXISTS "Authenticated users can delete calendar items" ON public.content_calendar;
CREATE POLICY "Users can view workspace content" ON public.content_calendar
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace content" ON public.content_calendar
  FOR INSERT WITH CHECK (public.user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace content" ON public.content_calendar
  FOR UPDATE USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace content" ON public.content_calendar
  FOR DELETE USING (public.user_has_workspace_access(workspace_id));
-- Automation Jobs RLS
DROP POLICY IF EXISTS "Authenticated users can view jobs" ON public.automation_jobs;
DROP POLICY IF EXISTS "Authenticated users can create jobs" ON public.automation_jobs;
DROP POLICY IF EXISTS "Authenticated users can update jobs" ON public.automation_jobs;
CREATE POLICY "Users can view workspace jobs" ON public.automation_jobs
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace jobs" ON public.automation_jobs
  FOR INSERT WITH CHECK (public.user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace jobs" ON public.automation_jobs
  FOR UPDATE USING (public.user_has_workspace_access(workspace_id));
-- Leads RLS (workspace-scoped)
DROP POLICY IF EXISTS "Sales team can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Sales can create leads" ON public.leads;
DROP POLICY IF EXISTS "Sales can update their assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Admins and managers can delete leads" ON public.leads;
CREATE POLICY "Users can view workspace leads" ON public.leads
  FOR SELECT USING (
    public.user_has_workspace_access(workspace_id) AND
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'sales'))
  );
CREATE POLICY "Users can create workspace leads" ON public.leads
  FOR INSERT WITH CHECK (
    public.user_has_workspace_access(workspace_id) AND
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'sales'))
  );
CREATE POLICY "Users can update workspace leads" ON public.leads
  FOR UPDATE USING (
    public.user_has_workspace_access(workspace_id) AND
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR assigned_to = auth.uid())
  );
CREATE POLICY "Admins can delete workspace leads" ON public.leads
  FOR DELETE USING (
    public.user_has_workspace_access(workspace_id) AND
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  );
-- Campaigns RLS (workspace-scoped)
DROP POLICY IF EXISTS "Authenticated users can view all campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Authenticated users can create campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Authenticated users can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Authenticated users can delete campaigns" ON public.campaigns;
CREATE POLICY "Users can view workspace campaigns" ON public.campaigns
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace campaigns" ON public.campaigns
  FOR INSERT WITH CHECK (public.user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace campaigns" ON public.campaigns
  FOR UPDATE USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace campaigns" ON public.campaigns
  FOR DELETE USING (public.user_has_workspace_access(workspace_id));
-- Assets RLS (workspace-scoped)
DROP POLICY IF EXISTS "Authenticated users can view all assets" ON public.assets;
DROP POLICY IF EXISTS "Authenticated users can create assets" ON public.assets;
DROP POLICY IF EXISTS "Authenticated users can update assets" ON public.assets;
DROP POLICY IF EXISTS "Authenticated users can delete assets" ON public.assets;
CREATE POLICY "Users can view workspace assets" ON public.assets
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace assets" ON public.assets
  FOR INSERT WITH CHECK (public.user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace assets" ON public.assets
  FOR UPDATE USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace assets" ON public.assets
  FOR DELETE USING (public.user_has_workspace_access(workspace_id));
