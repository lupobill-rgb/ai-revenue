-- Fix user_has_workspace_access to check both ownership and membership
-- We can safely check ownership via a direct join without recursion since
-- the security definer function bypasses RLS
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  has_access boolean;
BEGIN
  -- Check if user is owner (direct query, bypasses RLS due to SECURITY DEFINER)
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND owner_id = auth.uid()
  ) INTO has_access;
  
  IF has_access THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is member
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = auth.uid()
  ) INTO has_access;
  
  RETURN has_access;
END;
$$;
