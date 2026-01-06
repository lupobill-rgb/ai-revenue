
-- Fix business_profiles UPDATE policy to include WITH CHECK
DROP POLICY IF EXISTS "workspace_access_update" ON public.business_profiles;

CREATE POLICY "workspace_access_update"
ON public.business_profiles
FOR UPDATE
USING (user_has_workspace_access(workspace_id))
WITH CHECK (user_has_workspace_access(workspace_id));
