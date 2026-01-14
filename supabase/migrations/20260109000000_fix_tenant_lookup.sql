-- Fix tenant lookup to use workspace_members instead of user_tenants
-- This addresses "no tenant found for user" errors after migration

-- Helper function to get tenant_id from workspace membership
CREATE OR REPLACE FUNCTION get_tenant_id_from_user(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- First try user_tenants (for backwards compatibility)
  SELECT tenant_id INTO v_tenant_id
  FROM user_tenants
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- If not found, try workspace_members → workspaces → tenant_id
  IF v_tenant_id IS NULL THEN
    SELECT w.tenant_id INTO v_tenant_id
    FROM workspace_members wm
    JOIN workspaces w ON w.id = wm.workspace_id
    WHERE wm.user_id = p_user_id
    LIMIT 1;
  END IF;
  
  RETURN v_tenant_id;
END;
$$;
COMMENT ON FUNCTION get_tenant_id_from_user IS 'Retrieves tenant_id for a user via user_tenants or workspace membership';
