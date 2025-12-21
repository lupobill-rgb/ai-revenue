-- Create the parameterized version of is_platform_admin that accepts a UUID
-- This is needed because some RLS policies call is_platform_admin(auth.uid())
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = _user_id
  );
$$;