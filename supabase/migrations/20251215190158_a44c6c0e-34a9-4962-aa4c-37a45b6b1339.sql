-- Create helper function to get user by email (for adding admins)
CREATE OR REPLACE FUNCTION public.get_user_by_email(_email text)
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.id, au.email::text
  FROM auth.users au
  WHERE au.email = _email
  LIMIT 1
$$;
