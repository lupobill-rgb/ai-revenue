-- Standalone utility logging for SMS
-- Required by launch smoke tests: always log every SMS attempt (including blocked).

CREATE TABLE IF NOT EXISTS public.message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Multi-tenant scoping (extra columns are allowed; required fields below must exist)
  workspace_id uuid,
  tenant_id uuid,

  -- REQUIRED FIELDS
  channel text NOT NULL,
  to_phone text NOT NULL,
  status text NOT NULL,
  reason text NULL,
  provider_message_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful indexes (not required)
CREATE INDEX IF NOT EXISTS idx_message_logs_workspace_created_at
  ON public.message_logs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_logs_to_phone_created_at
  ON public.message_logs (to_phone, created_at DESC);

-- Enable RLS for safety; edge functions use service role for inserts
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

-- Minimal policies: allow workspace members to read their logs (if workspace_id is populated)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_logs'
      AND policyname = 'workspace_access_select'
  ) THEN
    CREATE POLICY "workspace_access_select"
      ON public.message_logs
      FOR SELECT
      USING (workspace_id IS NULL OR user_has_workspace_access(workspace_id));
  END IF;
END $$;

