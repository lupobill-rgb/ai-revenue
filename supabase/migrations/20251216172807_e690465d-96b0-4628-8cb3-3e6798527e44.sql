-- Drop the problematic duplicate SELECT policy that causes infinite recursion
DROP POLICY IF EXISTS "Users see their workspaces" ON public.workspaces;

-- The remaining "Users can view workspaces" policy already covers all access correctly:
-- is_platform_admin() OR owner_id = auth.uid() OR id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())