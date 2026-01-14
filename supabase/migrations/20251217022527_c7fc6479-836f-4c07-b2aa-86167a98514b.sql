-- Create SECURITY DEFINER function to check workspace ownership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_workspace_owner(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspaces 
    WHERE id = _workspace_id AND owner_id = _user_id
  );
$$;
-- Create SECURITY DEFINER function to check workspace membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  );
$$;
-- Drop existing policies on workspace_members to recreate them
DROP POLICY IF EXISTS "Users can view workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Workspace owners can manage members" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_select_policy" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_policy" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_update_policy" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete_policy" ON workspace_members;
-- Recreate policies using SECURITY DEFINER functions to avoid recursion
CREATE POLICY "workspace_members_select_policy" ON workspace_members
  FOR SELECT USING (
    user_id = auth.uid() 
    OR is_workspace_owner(workspace_id, auth.uid())
  );
CREATE POLICY "workspace_members_insert_policy" ON workspace_members
  FOR INSERT WITH CHECK (
    is_workspace_owner(workspace_id, auth.uid())
  );
CREATE POLICY "workspace_members_update_policy" ON workspace_members
  FOR UPDATE USING (
    is_workspace_owner(workspace_id, auth.uid())
  );
CREATE POLICY "workspace_members_delete_policy" ON workspace_members
  FOR DELETE USING (
    is_workspace_owner(workspace_id, auth.uid())
  );
-- Also fix workspaces policies if they have recursion issues
DROP POLICY IF EXISTS "Users can view workspaces they own or are members of" ON workspaces;
DROP POLICY IF EXISTS "workspaces_select_policy" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert_policy" ON workspaces;
DROP POLICY IF EXISTS "workspaces_update_policy" ON workspaces;
DROP POLICY IF EXISTS "workspaces_delete_policy" ON workspaces;
CREATE POLICY "workspaces_select_policy" ON workspaces
  FOR SELECT USING (
    owner_id = auth.uid() 
    OR is_workspace_member(id, auth.uid())
  );
CREATE POLICY "workspaces_insert_policy" ON workspaces
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
  );
CREATE POLICY "workspaces_update_policy" ON workspaces
  FOR UPDATE USING (
    owner_id = auth.uid()
  );
CREATE POLICY "workspaces_delete_policy" ON workspaces
  FOR DELETE USING (
    owner_id = auth.uid()
  );
