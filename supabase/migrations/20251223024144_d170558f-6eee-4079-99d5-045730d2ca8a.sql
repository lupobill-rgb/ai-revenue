-- Admin function to cleanup non-user deals from live workspaces
CREATE OR REPLACE FUNCTION public.admin_cleanup_nonuser_deals(p_workspace_id uuid DEFAULT NULL)
RETURNS TABLE(deleted_count bigint, workspace_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only platform admins can run this
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Only platform admins can run deal cleanup';
  END IF;

  RETURN QUERY
  WITH deleted AS (
    DELETE FROM deals d
    USING workspaces w
    WHERE d.workspace_id = w.id
      AND w.demo_mode = false
      AND d.source != 'user'
      AND (p_workspace_id IS NULL OR d.workspace_id = p_workspace_id)
    RETURNING d.workspace_id
  )
  SELECT count(*)::bigint as deleted_count, del.workspace_id
  FROM deleted del
  GROUP BY del.workspace_id;
END;
$function$;

-- Grant execute to authenticated users (RLS in function handles auth)
GRANT EXECUTE ON FUNCTION public.admin_cleanup_nonuser_deals(uuid) TO authenticated;