-- Create a SECURITY DEFINER function to check workspace ownership without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_workspace_owner(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  )
$$;

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Owners manage membership" ON public.workspace_members;

-- Recreate with SECURITY DEFINER function instead of direct subquery
CREATE POLICY "Owners manage membership" ON public.workspace_members
FOR ALL
USING (is_workspace_owner(workspace_id, auth.uid()));