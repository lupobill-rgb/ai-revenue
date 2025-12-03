-- Drop existing policies on lead_activities
DROP POLICY IF EXISTS "Sales can create activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Sales can delete activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Sales can update activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Sales team can view activities" ON public.lead_activities;

-- Create new policies combining workspace access AND role checks
CREATE POLICY "Sales team can view workspace activities"
ON public.lead_activities
FOR SELECT
USING (
  user_has_workspace_access(workspace_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR 
    has_role(auth.uid(), 'sales')
  )
);

CREATE POLICY "Sales team can create workspace activities"
ON public.lead_activities
FOR INSERT
WITH CHECK (
  user_has_workspace_access(workspace_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR 
    has_role(auth.uid(), 'sales')
  )
);

CREATE POLICY "Sales team can update workspace activities"
ON public.lead_activities
FOR UPDATE
USING (
  user_has_workspace_access(workspace_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR 
    has_role(auth.uid(), 'sales')
  )
);

CREATE POLICY "Sales team can delete workspace activities"
ON public.lead_activities
FOR DELETE
USING (
  user_has_workspace_access(workspace_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR 
    has_role(auth.uid(), 'sales')
  )
);