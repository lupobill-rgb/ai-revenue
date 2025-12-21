-- Function to count duplicate groups by uniqueness key in recent window
CREATE OR REPLACE FUNCTION public.get_outbox_duplicate_groups(p_window_hours integer DEFAULT 1)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT count(*)::integer
      FROM (
        SELECT tenant_id, workspace_id, idempotency_key, count(*) as c
        FROM channel_outbox
        WHERE created_at >= now() - (p_window_hours || ' hours')::interval
        GROUP BY tenant_id, workspace_id, idempotency_key
        HAVING count(*) > 1
      ) d
    ),
    0
  );
$$;