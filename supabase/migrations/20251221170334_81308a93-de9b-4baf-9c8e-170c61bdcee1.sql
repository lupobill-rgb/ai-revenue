-- Add RLS policy for platform admins to view all channel_outbox rows (needed for QA tests)
CREATE POLICY "platform_admin_select_all"
ON public.channel_outbox
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_admins 
    WHERE user_id = auth.uid()
  )
);