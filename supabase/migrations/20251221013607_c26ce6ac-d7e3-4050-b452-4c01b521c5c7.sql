-- Create a parameter-less version of is_platform_admin that uses auth.uid()
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id = auth.uid()
      AND is_active = true
  )
$$;
