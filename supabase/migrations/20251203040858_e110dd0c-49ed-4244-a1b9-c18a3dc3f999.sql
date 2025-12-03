-- Fix RLS gaps for workspace-scoped tables

-- 1. email_sequence_steps: Currently allows all authenticated users - needs workspace check via parent sequence
DROP POLICY IF EXISTS "Authenticated users can create steps" ON public.email_sequence_steps;
DROP POLICY IF EXISTS "Authenticated users can delete steps" ON public.email_sequence_steps;
DROP POLICY IF EXISTS "Authenticated users can update steps" ON public.email_sequence_steps;
DROP POLICY IF EXISTS "Authenticated users can view all steps" ON public.email_sequence_steps;

-- Create security definer function to check workspace access via sequence
CREATE OR REPLACE FUNCTION public.sequence_step_workspace_access(step_sequence_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.email_sequences es
    WHERE es.id = step_sequence_id
      AND user_has_workspace_access(es.workspace_id)
  )
$$;

CREATE POLICY "Users can view workspace sequence steps" ON public.email_sequence_steps
FOR SELECT USING (sequence_step_workspace_access(sequence_id));

CREATE POLICY "Users can insert workspace sequence steps" ON public.email_sequence_steps
FOR INSERT WITH CHECK (sequence_step_workspace_access(sequence_id));

CREATE POLICY "Users can update workspace sequence steps" ON public.email_sequence_steps
FOR UPDATE USING (sequence_step_workspace_access(sequence_id));

CREATE POLICY "Users can delete workspace sequence steps" ON public.email_sequence_steps
FOR DELETE USING (sequence_step_workspace_access(sequence_id));

-- 2. asset_approvals: Currently allows all authenticated - needs workspace check via asset
DROP POLICY IF EXISTS "Authenticated users can create approvals" ON public.asset_approvals;
DROP POLICY IF EXISTS "Authenticated users can view all approvals" ON public.asset_approvals;

-- Create security definer function to check workspace access via asset
CREATE OR REPLACE FUNCTION public.asset_approval_workspace_access(approval_asset_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assets a
    WHERE a.id = approval_asset_id
      AND user_has_workspace_access(a.workspace_id)
  )
$$;

CREATE POLICY "Users can view workspace asset approvals" ON public.asset_approvals
FOR SELECT USING (asset_approval_workspace_access(asset_id));

CREATE POLICY "Users can insert workspace asset approvals" ON public.asset_approvals
FOR INSERT WITH CHECK (asset_approval_workspace_access(asset_id));

CREATE POLICY "Users can update workspace asset approvals" ON public.asset_approvals
FOR UPDATE USING (asset_approval_workspace_access(asset_id));

CREATE POLICY "Users can delete workspace asset approvals" ON public.asset_approvals
FOR DELETE USING (asset_approval_workspace_access(asset_id));

-- 3. automation_jobs: Missing DELETE policy
CREATE POLICY "Users can delete workspace jobs" ON public.automation_jobs
FOR DELETE USING (user_has_workspace_access(workspace_id));

-- 4. lead_activities: Missing UPDATE/DELETE policies (role-based like existing policies)
CREATE POLICY "Sales can update activities" ON public.lead_activities
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'sales'::app_role)
);

CREATE POLICY "Sales can delete activities" ON public.lead_activities
FOR DELETE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'sales'::app_role)
);