-- ============================================================================
-- Google Ads Operator v1 (production-safe MVP)
-- Tables:
--   - ad_accounts
--   - guardrails
--   - action_proposals
--   - action_events
--   - weekly_summaries
--
-- Design goals:
--   - Tenant isolation via workspace_id + RLS
--   - Full audit trail (append-only action_events)
--   - Safe execution via explicit proposal statuses + guardrails
-- ============================================================================

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ads_provider') THEN
    CREATE TYPE public.ads_provider AS ENUM ('google_ads');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_proposal_type') THEN
    CREATE TYPE public.action_proposal_type AS ENUM (
      'pause_ad_group',
      'reduce_keyword_bid',
      'increase_campaign_budget'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_proposal_status') THEN
    CREATE TYPE public.action_proposal_status AS ENUM (
      'proposed',
      'blocked',
      'needs_approval',
      'approved',
      'rejected',
      'executing',
      'executed',
      'failed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_event_type') THEN
    CREATE TYPE public.action_event_type AS ENUM (
      'proposal_created',
      'governor_blocked',
      'queued_for_approval',
      'approved',
      'rejected',
      'execution_started',
      'execution_succeeded',
      'execution_failed',
      'verification_succeeded',
      'verification_failed',
      'reverted',
      'note'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_actor_type') THEN
    CREATE TYPE public.action_actor_type AS ENUM ('ai', 'human', 'system');
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- ad_accounts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider public.ads_provider NOT NULL DEFAULT 'google_ads',
  -- Google Ads customer ID (no dashes). Example: "1234567890"
  customer_id text NOT NULL,
  -- Optional "login customer" (MCC) ID (no dashes).
  login_customer_id text,
  name text,
  currency_code text,
  time_zone text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider, customer_id)
);

ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_access_select_ad_accounts" ON public.ad_accounts;
DROP POLICY IF EXISTS "workspace_access_insert_ad_accounts" ON public.ad_accounts;
DROP POLICY IF EXISTS "workspace_access_update_ad_accounts" ON public.ad_accounts;
DROP POLICY IF EXISTS "workspace_access_delete_ad_accounts" ON public.ad_accounts;

CREATE POLICY "workspace_access_select_ad_accounts"
  ON public.ad_accounts
  FOR SELECT
  USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_access_insert_ad_accounts"
  ON public.ad_accounts
  FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_access_update_ad_accounts"
  ON public.ad_accounts
  FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id))
  WITH CHECK (public.user_has_workspace_access(workspace_id));

-- No deletes for safety; rely on is_active
CREATE POLICY "workspace_access_delete_ad_accounts"
  ON public.ad_accounts
  FOR DELETE
  USING (false);

CREATE TRIGGER update_ad_accounts_updated_at
  BEFORE UPDATE ON public.ad_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- guardrails
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guardrails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,

  -- Core performance targets
  cpa_target_micros bigint,         -- target CPA in micros of account currency (optional)
  roas_target numeric,              -- ROAS target (e.g., 3.0) (optional)

  -- Safety caps (non-negotiable defaults enforced by governor too)
  max_single_budget_change_pct numeric NOT NULL DEFAULT 0.20,      -- 20%
  approval_budget_increase_pct numeric NOT NULL DEFAULT 0.10,      -- >10% requires approval
  max_net_daily_spend_increase_pct numeric NOT NULL DEFAULT 0.15,  -- 15%

  -- Proposal thresholds
  min_conversions_for_cpa_action integer NOT NULL DEFAULT 5,
  min_clicks_for_cpa_action integer NOT NULL DEFAULT 100,
  lookback_days integer NOT NULL DEFAULT 30,

  keyword_spend_threshold_micros bigint NOT NULL DEFAULT 5000000, -- 5 currency units in micros
  bid_reduction_pct numeric NOT NULL DEFAULT 0.20,                 -- reduce by 20%

  -- Additional structured config
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, ad_account_id),
  CONSTRAINT guardrails_pct_bounds CHECK (
    max_single_budget_change_pct > 0 AND max_single_budget_change_pct <= 0.20
    AND approval_budget_increase_pct >= 0 AND approval_budget_increase_pct <= 0.10
    AND max_net_daily_spend_increase_pct > 0 AND max_net_daily_spend_increase_pct <= 0.15
    AND bid_reduction_pct > 0 AND bid_reduction_pct <= 0.50
  )
);

ALTER TABLE public.guardrails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_access_select_guardrails" ON public.guardrails;
DROP POLICY IF EXISTS "workspace_access_insert_guardrails" ON public.guardrails;
DROP POLICY IF EXISTS "workspace_access_update_guardrails" ON public.guardrails;
DROP POLICY IF EXISTS "workspace_access_delete_guardrails" ON public.guardrails;

CREATE POLICY "workspace_access_select_guardrails"
  ON public.guardrails
  FOR SELECT
  USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_access_insert_guardrails"
  ON public.guardrails
  FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_access_update_guardrails"
  ON public.guardrails
  FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id))
  WITH CHECK (public.user_has_workspace_access(workspace_id));

-- No deletes for safety; overwrite via update
CREATE POLICY "workspace_access_delete_guardrails"
  ON public.guardrails
  FOR DELETE
  USING (false);

CREATE TRIGGER update_guardrails_updated_at
  BEFORE UPDATE ON public.guardrails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- action_proposals
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.action_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,

  proposal_type public.action_proposal_type NOT NULL,
  status public.action_proposal_status NOT NULL DEFAULT 'proposed',

  title text NOT NULL,
  rationale text NOT NULL,
  estimated_impact jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Canonical action details (must include before/after for reversibility)
  payload jsonb NOT NULL,
  -- Governor decision: allow/block + reasons + computed caps
  governor_decision jsonb NOT NULL DEFAULT '{}'::jsonb,

  requires_approval boolean NOT NULL DEFAULT false,

  -- Idempotency & dedupe: stable hash of (type + target + desired change) per workspace
  dedupe_key text NOT NULL,

  proposed_by public.action_actor_type NOT NULL DEFAULT 'ai',

  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at timestamptz,

  execution_attempts integer NOT NULL DEFAULT 0,
  last_error text,
  executed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.action_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_access_select_action_proposals" ON public.action_proposals;
DROP POLICY IF EXISTS "workspace_access_insert_action_proposals" ON public.action_proposals;
DROP POLICY IF EXISTS "workspace_access_update_action_proposals" ON public.action_proposals;
DROP POLICY IF EXISTS "workspace_access_delete_action_proposals" ON public.action_proposals;

CREATE POLICY "workspace_access_select_action_proposals"
  ON public.action_proposals
  FOR SELECT
  USING (public.user_has_workspace_access(workspace_id));

-- Allow inserts (AI proposals via backend/service role OR user-triggered) but workspace-scoped
CREATE POLICY "workspace_access_insert_action_proposals"
  ON public.action_proposals
  FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id));

-- Allow updates for approval + status progression; still workspace-scoped
CREATE POLICY "workspace_access_update_action_proposals"
  ON public.action_proposals
  FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id))
  WITH CHECK (public.user_has_workspace_access(workspace_id));

-- No deletes for auditability
CREATE POLICY "workspace_access_delete_action_proposals"
  ON public.action_proposals
  FOR DELETE
  USING (false);

CREATE INDEX IF NOT EXISTS idx_action_proposals_workspace_created_at
  ON public.action_proposals (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_proposals_workspace_status_created_at
  ON public.action_proposals (workspace_id, status, created_at DESC);

-- Dedupe key should be unique for active-ish statuses to avoid repeat spam
CREATE UNIQUE INDEX IF NOT EXISTS uq_action_proposals_workspace_dedupe_active
  ON public.action_proposals (workspace_id, dedupe_key)
  WHERE status IN ('proposed', 'needs_approval', 'approved', 'executing');

CREATE TRIGGER update_action_proposals_updated_at
  BEFORE UPDATE ON public.action_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- action_events (append-only audit log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.action_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.action_proposals(id) ON DELETE SET NULL,

  event_type public.action_event_type NOT NULL,
  actor_type public.action_actor_type NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Logical "run" correlation id for a batch of actions (operator loop)
  run_id uuid,

  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.action_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_access_select_action_events" ON public.action_events;
DROP POLICY IF EXISTS "workspace_access_insert_action_events" ON public.action_events;
DROP POLICY IF EXISTS "workspace_access_update_action_events" ON public.action_events;
DROP POLICY IF EXISTS "workspace_access_delete_action_events" ON public.action_events;

CREATE POLICY "workspace_access_select_action_events"
  ON public.action_events
  FOR SELECT
  USING (public.user_has_workspace_access(workspace_id));

-- Insert allowed for audit trail
CREATE POLICY "workspace_access_insert_action_events"
  ON public.action_events
  FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id));

-- Prevent updates/deletes for immutability
CREATE POLICY "workspace_access_update_action_events"
  ON public.action_events
  FOR UPDATE
  USING (false);

CREATE POLICY "workspace_access_delete_action_events"
  ON public.action_events
  FOR DELETE
  USING (false);

CREATE INDEX IF NOT EXISTS idx_action_events_workspace_created_at
  ON public.action_events (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_events_workspace_run_id
  ON public.action_events (workspace_id, run_id);

-- ----------------------------------------------------------------------------
-- weekly_summaries
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,

  week_start_date date NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, ad_account_id, week_start_date)
);

ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_access_select_weekly_summaries" ON public.weekly_summaries;
DROP POLICY IF EXISTS "workspace_access_insert_weekly_summaries" ON public.weekly_summaries;
DROP POLICY IF EXISTS "workspace_access_update_weekly_summaries" ON public.weekly_summaries;
DROP POLICY IF EXISTS "workspace_access_delete_weekly_summaries" ON public.weekly_summaries;

CREATE POLICY "workspace_access_select_weekly_summaries"
  ON public.weekly_summaries
  FOR SELECT
  USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_access_insert_weekly_summaries"
  ON public.weekly_summaries
  FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_access_update_weekly_summaries"
  ON public.weekly_summaries
  FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id))
  WITH CHECK (public.user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_access_delete_weekly_summaries"
  ON public.weekly_summaries
  FOR DELETE
  USING (false);

CREATE TRIGGER update_weekly_summaries_updated_at
  BEFORE UPDATE ON public.weekly_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Idempotent execution helpers (server-side)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_action_proposal_for_execution(
  p_proposal_id uuid
)
RETURNS public.action_proposals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.action_proposals;
BEGIN
  UPDATE public.action_proposals
    SET status = 'executing',
        execution_attempts = execution_attempts + 1,
        updated_at = now()
    WHERE id = p_proposal_id
      AND status IN ('approved')
      AND executed_at IS NULL
    RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    -- Return current row (or null-like) for caller visibility
    SELECT * INTO v_row FROM public.action_proposals WHERE id = p_proposal_id;
  END IF;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.claim_action_proposal_for_execution IS
  'Atomically moves an approved proposal to executing and increments attempts (idempotent claim).';

