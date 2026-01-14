-- Create a helper function that checks workspace ownership without querying workspaces table
-- This avoids infinite recursion by only checking workspace_members for membership
CREATE OR REPLACE FUNCTION public.is_workspace_owner_or_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  )
$$;
-- Drop existing policies on workspaces that might cause issues
DROP POLICY IF EXISTS "Users see their workspaces" ON public.workspaces;
-- Recreate the SELECT policy without subqueries that could cause recursion
CREATE POLICY "Users see their workspaces" ON public.workspaces
FOR SELECT USING (
  owner_id = auth.uid() 
  OR public.is_workspace_owner_or_member(id, auth.uid())
);
-- Update user_has_workspace_access to not query workspaces table directly
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = auth.uid()
  )
$$;
