-- Relax leads SELECT policy so any workspace member can view leads
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='leads' AND policyname='Users can view workspace leads'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view workspace leads" ON public.leads';
  END IF;
END $$;

CREATE POLICY "Users can view workspace leads"
ON public.leads
FOR SELECT
USING (
  user_has_workspace_access(workspace_id)
);
