
-- 1) Drop any broad / service_role policy you added (if present)
DROP POLICY IF EXISTS "service_role_bypass" ON public.campaign_runs;
DROP POLICY IF EXISTS "service_role_full_access" ON public.campaign_runs;

-- 2) Ensure RLS is enabled
ALTER TABLE public.campaign_runs ENABLE ROW LEVEL SECURITY;

-- 3) Replace INSERT policy with a strict workspace + campaign linkage check
DROP POLICY IF EXISTS "allow_rpc_insert" ON public.campaign_runs;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON public.campaign_runs;

CREATE POLICY "campaign_runs_insert_workspace_scoped"
ON public.campaign_runs
FOR INSERT
WITH CHECK (
  user_has_workspace_access(workspace_id)
  AND EXISTS (
    SELECT 1
    FROM public.campaigns c
    WHERE c.id = campaign_id
      AND c.workspace_id = campaign_runs.workspace_id
  )
);

-- 4) Keep/ensure SELECT policy
DROP POLICY IF EXISTS "campaign_runs_select_workspace_scoped" ON public.campaign_runs;
DROP POLICY IF EXISTS "tenant_isolation_select" ON public.campaign_runs;

CREATE POLICY "campaign_runs_select_workspace_scoped"
ON public.campaign_runs
FOR SELECT
USING (user_has_workspace_access(workspace_id));

-- 5) Ensure UPDATE/DELETE policies are workspace-scoped too
DROP POLICY IF EXISTS "tenant_isolation_update" ON public.campaign_runs;
DROP POLICY IF EXISTS "tenant_isolation_delete" ON public.campaign_runs;

CREATE POLICY "campaign_runs_update_workspace_scoped"
ON public.campaign_runs
FOR UPDATE
USING (user_has_workspace_access(workspace_id));

CREATE POLICY "campaign_runs_delete_workspace_scoped"
ON public.campaign_runs
FOR DELETE
USING (user_has_workspace_access(workspace_id));
