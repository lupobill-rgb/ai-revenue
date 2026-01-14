-- ============================================================
-- Post-Observation Decision Gate
--
-- After the 14-day observation window ends, require an explicit decision
-- before any code-path changes:
-- - SCALE_EXISTING
-- - EXPAND_PROPOSALS
-- - HOLD_STEADY
--
-- The decision is logged (action_events) and is internal-only.
-- ============================================================

-- 1) Decision latch table (singleton)
CREATE TABLE IF NOT EXISTS public.observation_decision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision text NOT NULL CHECK (decision IN ('SCALE_EXISTING', 'EXPAND_PROPOSALS', 'HOLD_STEADY')),
  decided_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure singleton
CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_decision_singleton
  ON public.observation_decision ((1));

ALTER TABLE public.observation_decision ENABLE ROW LEVEL SECURITY;

-- Platform admin read/write
DO $$ BEGIN
  CREATE POLICY "platform_admins_select" ON public.observation_decision
    FOR SELECT USING (is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "platform_admins_insert" ON public.observation_decision
    FOR INSERT WITH CHECK (is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service role full access (CI / ops)
DO $$ BEGIN
  CREATE POLICY "service_role_all" ON public.observation_decision
    FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Internal status view
CREATE OR REPLACE VIEW public.v_observation_decision_status AS
SELECT
  od.decision,
  od.decided_at,
  od.decided_by,
  true AS is_set
FROM public.observation_decision od
ORDER BY od.decided_at DESC
LIMIT 1;

ALTER VIEW public.v_observation_decision_status SET (security_barrier = true);

-- 3) RPC to set decision (one-time, explicit)
CREATE OR REPLACE FUNCTION public.set_observation_decision(p_decision text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_has_window boolean;
  v_window_active boolean;
  v_has_decision boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'OBS_DECISION_REQUIRES_AUTH';
  END IF;

  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'OBS_DECISION_FORBIDDEN_PLATFORM_ADMIN_ONLY';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.observation_window) INTO v_has_window;
  IF NOT v_has_window THEN
    RAISE EXCEPTION 'OBS_DECISION_WINDOW_NOT_STARTED';
  END IF;

  SELECT (now() < ow.ends_at) INTO v_window_active
  FROM public.observation_window ow
  ORDER BY ow.started_at ASC
  LIMIT 1;

  IF v_window_active THEN
    RAISE EXCEPTION 'OBS_DECISION_WINDOW_STILL_ACTIVE';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.observation_decision) INTO v_has_decision;
  IF v_has_decision THEN
    RAISE EXCEPTION 'OBS_DECISION_ALREADY_SET';
  END IF;

  IF p_decision NOT IN ('SCALE_EXISTING', 'EXPAND_PROPOSALS', 'HOLD_STEADY') THEN
    RAISE EXCEPTION 'OBS_DECISION_INVALID';
  END IF;

  INSERT INTO public.observation_decision (decision, decided_at, decided_by)
  VALUES (p_decision, now(), v_user_id);

  -- Log decision (best effort). action_events was introduced for internal audit.
  BEGIN
    INSERT INTO public.action_events (tenant_id, workspace_id, type, payload, user_id)
    VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      NULL,
      'OBSERVATION_DECISION',
      jsonb_build_object('decision', p_decision),
      v_user_id
    );
  EXCEPTION WHEN others THEN
    -- ignore
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_observation_decision(text) TO authenticated;

