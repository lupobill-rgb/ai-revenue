-- Drop existing policies on workspaces
DROP POLICY IF EXISTS "Owners can update their workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can view their own workspaces" ON public.workspaces;
-- Drop existing policies on workspace_members
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace owners can manage members" ON public.workspace_members;
-- Ensure RLS is enabled
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
-- Workspaces: Users can see workspaces they own OR are members of
CREATE POLICY "Users see their workspaces" ON public.workspaces
FOR SELECT USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = workspaces.id
      AND m.user_id = auth.uid()
  )
);
-- Workspaces: Owners can create their own workspaces
CREATE POLICY "Owners can create workspaces" ON public.workspaces
FOR INSERT WITH CHECK (owner_id = auth.uid());
-- Workspaces: Owners can update their workspaces
CREATE POLICY "Owners can update workspaces" ON public.workspaces
FOR UPDATE USING (owner_id = auth.uid());
-- Workspaces: Owners can delete their workspaces
CREATE POLICY "Owners can delete workspaces" ON public.workspaces
FOR DELETE USING (owner_id = auth.uid());
-- Workspace Members: Members can view membership of workspaces they have access to
CREATE POLICY "Members view membership" ON public.workspace_members
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
  )
);
-- Workspace Members: Only workspace owners can manage membership
CREATE POLICY "Owners manage membership" ON public.workspace_members
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_members.workspace_id
      AND w.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_members.workspace_id
      AND w.owner_id = auth.uid()
  )
);
