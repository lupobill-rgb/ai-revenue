-- Drop old function and create cleaner version
DROP FUNCTION IF EXISTS public.verify_workspace_password(uuid, text);
CREATE OR REPLACE FUNCTION public.check_workspace_form_password(
  _workspace_id uuid,
  _password text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = _workspace_id
      AND (w.public_form_password_hash IS NULL
        OR extensions.crypt(_password, w.public_form_password_hash) = w.public_form_password_hash)
  );
$$;
