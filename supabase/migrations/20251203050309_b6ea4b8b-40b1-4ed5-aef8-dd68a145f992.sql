-- Create function to verify workspace password using pgcrypto
CREATE OR REPLACE FUNCTION public.verify_workspace_password(
  workspace_uuid uuid,
  password_input text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = workspace_uuid
      AND public_form_password_hash IS NOT NULL
      AND public_form_password_hash = extensions.crypt(password_input, public_form_password_hash)
  );
$$;
