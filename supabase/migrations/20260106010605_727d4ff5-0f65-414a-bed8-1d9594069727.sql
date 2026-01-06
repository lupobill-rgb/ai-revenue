-- Create kernel_events table with idempotency
CREATE TABLE IF NOT EXISTS public.kernel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  correlation_id TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  idempotency_key TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kernel_events_idempotency UNIQUE (tenant_id, idempotency_key)
);

-- Create kernel_decisions table
CREATE TABLE IF NOT EXISTS public.kernel_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.kernel_events(id) ON DELETE CASCADE,
  correlation_id TEXT NOT NULL,
  policy_name TEXT NOT NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('EMIT_ACTIONS', 'GUARD', 'NOOP')),
  decision_json JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'executed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ
);

-- Create kernel_actions table
CREATE TABLE IF NOT EXISTS public.kernel_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES public.kernel_decisions(id) ON DELETE CASCADE,
  correlation_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_json JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'logged' CHECK (status IN ('logged', 'executed', 'failed', 'skipped')),
  executed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kernel_events_tenant_status ON public.kernel_events(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_kernel_events_correlation ON public.kernel_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_kernel_events_type ON public.kernel_events(type);
CREATE INDEX IF NOT EXISTS idx_kernel_decisions_event ON public.kernel_decisions(event_id);
CREATE INDEX IF NOT EXISTS idx_kernel_decisions_tenant_status ON public.kernel_decisions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_kernel_actions_decision ON public.kernel_actions(decision_id);
CREATE INDEX IF NOT EXISTS idx_kernel_actions_tenant_status ON public.kernel_actions(tenant_id, status);

-- Enable RLS on all kernel tables
ALTER TABLE public.kernel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kernel_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kernel_actions ENABLE ROW LEVEL SECURITY;

-- RLS policies for kernel_events (service role only for writes, tenant-scoped reads)
CREATE POLICY "kernel_events_tenant_read" ON public.kernel_events
  FOR SELECT USING (
    tenant_id IN (
      SELECT w.id FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
      UNION
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- RLS policies for kernel_decisions
CREATE POLICY "kernel_decisions_tenant_read" ON public.kernel_decisions
  FOR SELECT USING (
    tenant_id IN (
      SELECT w.id FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
      UNION
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- RLS policies for kernel_actions
CREATE POLICY "kernel_actions_tenant_read" ON public.kernel_actions
  FOR SELECT USING (
    tenant_id IN (
      SELECT w.id FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
      UNION
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Service role insert policies (edge functions use service role)
CREATE POLICY "kernel_events_service_insert" ON public.kernel_events
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "kernel_decisions_service_insert" ON public.kernel_decisions
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "kernel_actions_service_insert" ON public.kernel_actions
  FOR INSERT TO service_role WITH CHECK (true);

-- Service role update policies
CREATE POLICY "kernel_events_service_update" ON public.kernel_events
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "kernel_decisions_service_update" ON public.kernel_decisions
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "kernel_actions_service_update" ON public.kernel_actions
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);