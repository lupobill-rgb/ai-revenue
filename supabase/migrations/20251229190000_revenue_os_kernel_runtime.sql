-- ============================================================
-- Revenue OS Kernel Runtime (events -> decisions -> actions)
-- Tables: kernel_events, kernel_decisions, kernel_actions
-- Tenant-safe (RLS via user_belongs_to_tenant(tenant_id))
-- ============================================================

-- 1) kernel_events
CREATE TABLE IF NOT EXISTS public.kernel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  type text NOT NULL,
  source text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  correlation_id text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL
);

-- Exactly-once at event level (per tenant)
CREATE UNIQUE INDEX IF NOT EXISTS idx_kernel_events_idempotency
  ON public.kernel_events (tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_kernel_events_tenant_created_at
  ON public.kernel_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kernel_events_tenant_correlation
  ON public.kernel_events (tenant_id, correlation_id);

-- 2) kernel_decisions
CREATE TABLE IF NOT EXISTS public.kernel_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.kernel_events(id) ON DELETE CASCADE,
  correlation_id text NOT NULL,
  policy_name text NOT NULL,
  decision_type text NOT NULL,
  decision_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'approved', 'executed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kernel_decisions_tenant_created_at
  ON public.kernel_decisions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kernel_decisions_tenant_correlation
  ON public.kernel_decisions (tenant_id, correlation_id);

CREATE INDEX IF NOT EXISTS idx_kernel_decisions_event_id
  ON public.kernel_decisions (event_id);

-- 3) kernel_actions
CREATE TABLE IF NOT EXISTS public.kernel_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  decision_id uuid NOT NULL REFERENCES public.kernel_decisions(id) ON DELETE CASCADE,
  correlation_id text NOT NULL,
  action_type text NOT NULL,
  action_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'logged'
    CHECK (status IN ('logged', 'executed', 'failed', 'skipped')),
  executed_at timestamptz NULL,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kernel_actions_tenant_created_at
  ON public.kernel_actions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kernel_actions_tenant_correlation
  ON public.kernel_actions (tenant_id, correlation_id);

CREATE INDEX IF NOT EXISTS idx_kernel_actions_decision_id
  ON public.kernel_actions (decision_id);

-- 4) RLS
ALTER TABLE public.kernel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kernel_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kernel_actions ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies (consistent with other tables in this repo)
CREATE POLICY "tenant_isolation_select" ON public.kernel_events
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.kernel_events
  FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.kernel_events
  FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.kernel_events
  FOR DELETE USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "tenant_isolation_select" ON public.kernel_decisions
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.kernel_decisions
  FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.kernel_decisions
  FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.kernel_decisions
  FOR DELETE USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "tenant_isolation_select" ON public.kernel_actions
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.kernel_actions
  FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.kernel_actions
  FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.kernel_actions
  FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 5) Comments (observability + intent)
COMMENT ON TABLE public.kernel_events IS
'Revenue OS Kernel events (normalized). Insert-only via emitKernelEvent; idempotent per tenant via idempotency_key.';

COMMENT ON TABLE public.kernel_decisions IS
'Revenue OS Kernel decisions produced by policies. No side effects; dispatcher executes decisions into actions.';

COMMENT ON TABLE public.kernel_actions IS
'Revenue OS Kernel actions executed (or logged in shadow mode). Each row is an auditable side-effect outcome.';


