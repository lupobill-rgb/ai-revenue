-- Fix infinite recursion in RLS policies for platform_admins and workspace_members/workspaces

-- 1) Helper function: workspace access without invoking RLS policies recursively
CREATE OR REPLACE FUNCTION public.is_workspace_owner_or_member_sd(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = _workspace_id
      AND w.owner_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = _workspace_id
      AND wm.user_id = _user_id
  );
$$;

-- 2) PLATFORM_ADMINS: remove self-referential policies and replace with is_platform_admin()
DROP POLICY IF EXISTS "Platform admins can view all" ON public.platform_admins;
DROP POLICY IF EXISTS "Platform admins can insert" ON public.platform_admins;
DROP POLICY IF EXISTS "Platform admins can update" ON public.platform_admins;

CREATE POLICY "platform_admins_select" ON public.platform_admins
FOR SELECT
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_admins_insert" ON public.platform_admins
FOR INSERT
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_admins_update" ON public.platform_admins
FOR UPDATE
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 3) WORKSPACE_MEMBERS: remove recursive policies and recreate clean set
DROP POLICY IF EXISTS "Members view membership" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners manage membership" ON public.workspace_members;

DROP POLICY IF EXISTS "Users can view workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace owners can manage members" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_select_policy" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_policy" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_update_policy" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete_policy" ON public.workspace_members;

CREATE POLICY "workspace_members_select" ON public.workspace_members
FOR SELECT
USING (
  public.is_workspace_owner_or_member_sd(workspace_id, auth.uid())
);

CREATE POLICY "workspace_members_insert" ON public.workspace_members
FOR INSERT
WITH CHECK (
  public.is_workspace_owner(workspace_id, auth.uid())
);

CREATE POLICY "workspace_members_update" ON public.workspace_members
FOR UPDATE
USING (
  public.is_workspace_owner(workspace_id, auth.uid())
)
WITH CHECK (
  public.is_workspace_owner(workspace_id, auth.uid())
);

CREATE POLICY "workspace_members_delete" ON public.workspace_members
FOR DELETE
USING (
  public.is_workspace_owner(workspace_id, auth.uid())
);

-- 4) WORKSPACES: drop duplicates and recreate a single readable policy
DROP POLICY IF EXISTS "Users can view workspaces they own or are members of" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_select_policy" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert_policy" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update_policy" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete_policy" ON public.workspaces;

DROP POLICY IF EXISTS "Owners can create workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can update workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can delete workspaces" ON public.workspaces;

CREATE POLICY "workspaces_select" ON public.workspaces
FOR SELECT
USING (
  public.is_platform_admin(auth.uid())
  OR owner_id = auth.uid()
  OR public.is_workspace_owner_or_member_sd(id, auth.uid())
);

CREATE POLICY "workspaces_insert" ON public.workspaces
FOR INSERT
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "workspaces_update" ON public.workspaces
FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "workspaces_delete" ON public.workspaces
FOR DELETE
USING (owner_id = auth.uid());
