
-- Add service role bypass for campaign_runs to allow deploy_campaign RPC to insert
CREATE POLICY "service_role_full_access" ON public.campaign_runs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Also add a policy that allows SECURITY DEFINER functions to insert
-- The RPC runs as the function owner, so we need to allow inserts when called from RPC
CREATE POLICY "allow_rpc_insert" ON public.campaign_runs
  FOR INSERT
  WITH CHECK (
    -- Allow if tenant_id matches user's tenant (normal flow)
    user_belongs_to_tenant(tenant_id)
    OR
    -- Allow if workspace access exists for the workspace_id
    user_has_workspace_access(workspace_id)
  );

-- Drop the restrictive tenant-only insert policy and use the new combined one
DROP POLICY IF EXISTS "tenant_isolation_insert" ON public.campaign_runs;
