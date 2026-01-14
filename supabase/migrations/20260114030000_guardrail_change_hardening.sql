-- ============================================================
-- Guardrail Hardening: no silent drift
-- - Require explicit user confirmation
-- - Log before/after with timestamp + user_id
-- - Block background/automatic guardrail changes
--
-- Action event:
--   type = 'GUARDRAIL_CHANGED'
--   payload = { before, after }
-- ============================================================

-- 1) Action events log (minimal, tenant-scoped)
CREATE TABLE IF NOT EXISTS public.action_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NULL,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_events_tenant_created_at
  ON public.action_events (tenant_id, created_at DESC);

ALTER TABLE public.action_events ENABLE ROW LEVEL SECURITY;

-- Tenant isolation for reads
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_select" ON public.action_events
    FOR SELECT USING (user_belongs_to_tenant(tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Inserts must be tenant-scoped (service role still allowed via auth.role check)
DO $$ BEGIN
  CREATE POLICY "tenant_isolation_insert" ON public.action_events
    FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id) OR auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Guardrail update function (explicit confirmation + before/after logging)
CREATE OR REPLACE FUNCTION public.update_tenant_targets_guardrails(
  p_tenant_id uuid,
  p_after jsonb,
  p_confirm boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_before jsonb;
  v_after jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'GUARDRAIL_CONFIRMATION_REQUIRES_AUTH';
  END IF;

  IF NOT user_belongs_to_tenant(p_tenant_id) THEN
    RAISE EXCEPTION 'GUARDRAIL_CHANGE_FORBIDDEN';
  END IF;

  IF p_confirm IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'GUARDRAIL_CONFIRMATION_REQUIRED';
  END IF;

  SELECT to_jsonb(tt.*) INTO v_before
  FROM public.tenant_targets tt
  WHERE tt.tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'GUARDRAIL_TARGETS_NOT_FOUND';
  END IF;

  -- Mark this transaction as explicitly confirmed for trigger bypass.
  PERFORM set_config('app.guardrail_change_confirmed', '1', true);

  UPDATE public.tenant_targets tt
  SET
    cash_risk_tolerance = CASE WHEN p_after ? 'cash_risk_tolerance' THEN (p_after->>'cash_risk_tolerance') ELSE tt.cash_risk_tolerance END,
    email_enabled = CASE WHEN p_after ? 'email_enabled' THEN (p_after->>'email_enabled')::boolean ELSE tt.email_enabled END,
    experiment_exposure_pct = CASE WHEN p_after ? 'experiment_exposure_pct' THEN (p_after->>'experiment_exposure_pct')::numeric ELSE tt.experiment_exposure_pct END,
    landing_pages_enabled = CASE WHEN p_after ? 'landing_pages_enabled' THEN (p_after->>'landing_pages_enabled')::boolean ELSE tt.landing_pages_enabled END,
    linkedin_enabled = CASE WHEN p_after ? 'linkedin_enabled' THEN (p_after->>'linkedin_enabled')::boolean ELSE tt.linkedin_enabled END,
    margin_floor_pct = CASE WHEN p_after ? 'margin_floor_pct' THEN (p_after->>'margin_floor_pct')::numeric ELSE tt.margin_floor_pct END,
    max_cac = CASE WHEN p_after ? 'max_cac' THEN (p_after->>'max_cac')::numeric ELSE tt.max_cac END,
    max_cac_by_segment = CASE WHEN p_after ? 'max_cac_by_segment' THEN (p_after->'max_cac_by_segment') ELSE tt.max_cac_by_segment END,
    monthly_budget_cap = CASE WHEN p_after ? 'monthly_budget_cap' THEN (p_after->>'monthly_budget_cap')::numeric ELSE tt.monthly_budget_cap END,
    sms_enabled = CASE WHEN p_after ? 'sms_enabled' THEN (p_after->>'sms_enabled')::boolean ELSE tt.sms_enabled END,
    target_bookings = CASE WHEN p_after ? 'target_bookings' THEN (p_after->>'target_bookings')::integer ELSE tt.target_bookings END,
    target_payback_months = CASE WHEN p_after ? 'target_payback_months' THEN (p_after->>'target_payback_months')::integer ELSE tt.target_payback_months END,
    target_pipeline = CASE WHEN p_after ? 'target_pipeline' THEN (p_after->>'target_pipeline')::numeric ELSE tt.target_pipeline END,
    voice_enabled = CASE WHEN p_after ? 'voice_enabled' THEN (p_after->>'voice_enabled')::boolean ELSE tt.voice_enabled END,
    updated_at = now()
  WHERE tt.tenant_id = p_tenant_id;

  SELECT to_jsonb(tt.*) INTO v_after
  FROM public.tenant_targets tt
  WHERE tt.tenant_id = p_tenant_id;

  INSERT INTO public.action_events (tenant_id, workspace_id, type, payload, user_id)
  VALUES (
    p_tenant_id,
    NULL,
    'GUARDRAIL_CHANGED',
    jsonb_build_object('before', v_before, 'after', v_after),
    v_user_id
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_tenant_targets_guardrails(uuid, jsonb, boolean) TO authenticated;

-- 3) Prevent silent drift: block direct updates unless explicitly confirmed
CREATE OR REPLACE FUNCTION public.enforce_guardrail_change_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_confirmed text;
  v_user_id uuid;
BEGIN
  v_confirmed := current_setting('app.guardrail_change_confirmed', true);
  IF v_confirmed = '1' THEN
    RETURN NEW;
  END IF;

  -- No background/automatic changes allowed.
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    v_user_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  -- Log blocked attempt (best-effort)
  BEGIN
    INSERT INTO public.action_events (tenant_id, workspace_id, type, payload, user_id)
    VALUES (
      NEW.tenant_id,
      NULL,
      'GUARDRAIL_CHANGE_BLOCKED',
      jsonb_build_object('before', to_jsonb(OLD.*), 'after', to_jsonb(NEW.*)),
      v_user_id
    );
  EXCEPTION WHEN others THEN
    -- ignore
  END;

  RAISE EXCEPTION 'GUARDRAIL_UPDATE_BLOCKED_CONFIRMATION_REQUIRED';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_guardrail_change_confirmed ON public.tenant_targets;
CREATE TRIGGER trg_enforce_guardrail_change_confirmed
BEFORE UPDATE ON public.tenant_targets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_guardrail_change_confirmed();

