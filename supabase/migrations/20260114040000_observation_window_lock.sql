-- ============================================================
-- Observation Window Lock (14 days)
-- Starts when first customer execution_enabled becomes true.
--
-- During the window, deployment should be restricted (enforced via CI gate):
-- - Block new proposal logic
-- - Block execution logic changes
-- - Block UI changes
--
-- Allow: logging, alerting, documentation only.
-- Status is exposed internally only (platform admins + service_role).
-- ============================================================

-- 1) Single-row observation window latch
CREATE TABLE IF NOT EXISTS public.observation_window (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  started_by_workspace_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT observation_window_singleton CHECK (id IS NOT NULL)
);

-- Ensure only one row exists (singleton)
CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_window_singleton
  ON public.observation_window ((1));

ALTER TABLE public.observation_window ENABLE ROW LEVEL SECURITY;

-- Platform admin read access
DO $$ BEGIN
  CREATE POLICY "platform_admins_select" ON public.observation_window
    FOR SELECT USING (is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service role full access (edge functions / CI)
DO $$ BEGIN
  CREATE POLICY "service_role_all" ON public.observation_window
    FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Derived status view (internal only)
CREATE OR REPLACE VIEW public.v_observation_window_status AS
SELECT
  ow.started_at,
  ow.ends_at,
  ow.started_by_workspace_id,
  (now() < ow.ends_at) AS is_active,
  GREATEST(0, CEIL(EXTRACT(EPOCH FROM (ow.ends_at - now())) / 86400.0))::integer AS days_remaining
FROM public.observation_window ow
ORDER BY ow.started_at ASC
LIMIT 1;

ALTER VIEW public.v_observation_window_status SET (security_barrier = true);

-- Expose view only to platform admins + service_role
DO $$ BEGIN
  REVOKE ALL ON public.v_observation_window_status FROM PUBLIC;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Note: RLS does not apply to views directly; underlying table policies apply.

-- 3) Trigger: start window on first execution_enabled=true transition
-- We treat execution_enabled as a workspace.settings jsonb flag:
-- settings->>'execution_enabled' = 'true'
CREATE OR REPLACE FUNCTION public.start_observation_window_if_needed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has_window boolean;
  v_old_enabled boolean;
  v_new_enabled boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.observation_window) INTO v_has_window;
  IF v_has_window THEN
    RETURN NEW;
  END IF;

  v_old_enabled := COALESCE((OLD.settings->>'execution_enabled')::boolean, false);
  v_new_enabled := COALESCE((NEW.settings->>'execution_enabled')::boolean, false);

  IF v_old_enabled = false AND v_new_enabled = true THEN
    INSERT INTO public.observation_window (started_at, ends_at, started_by_workspace_id)
    VALUES (now(), now() + interval '14 days', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_start_observation_window ON public.workspaces;
CREATE TRIGGER trg_start_observation_window
AFTER UPDATE OF settings ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.start_observation_window_if_needed();

