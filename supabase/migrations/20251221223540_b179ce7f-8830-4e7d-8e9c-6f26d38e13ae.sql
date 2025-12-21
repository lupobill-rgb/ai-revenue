-- Fix platform admin RLS checks by using a non-ambiguous SECURITY DEFINER helper

CREATE OR REPLACE FUNCTION public.is_platform_admin_safe()
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
  );
$$;

DROP POLICY IF EXISTS "platform_admin_select_all" ON public.channel_outbox;
CREATE POLICY "platform_admin_select_all"
ON public.channel_outbox
FOR SELECT
TO authenticated
USING (public.is_platform_admin_safe());
