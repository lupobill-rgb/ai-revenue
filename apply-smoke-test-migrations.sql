-- Apply smoke test migrations manually
-- These are needed for automation smoke tests

-- ============================================================================
-- Migration 1: SMS Opt-outs, Usage Events, Campaign Assets
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  channel text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_opt_outs_tenant_channel_phone
  ON public.opt_outs (tenant_id, channel, phone);

CREATE INDEX IF NOT EXISTS idx_opt_outs_tenant_created_at
  ON public.opt_outs (tenant_id, created_at DESC);

ALTER TABLE public.opt_outs ENABLE ROW LEVEL SECURITY;

-- Usage events
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  channel text NOT NULL,
  units integer NOT NULL DEFAULT 1,
  billable boolean NOT NULL DEFAULT true,
  campaign_id uuid,
  lead_id uuid,
  recipient_phone text,
  provider text,
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_channel_created_at
  ON public.usage_events (tenant_id, channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_campaign_created_at
  ON public.usage_events (campaign_id, created_at DESC);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Campaign assets
CREATE TABLE IF NOT EXISTS public.campaign_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_assets_campaign_type_created_at
  ON public.campaign_assets (campaign_id, type, created_at DESC);

ALTER TABLE public.campaign_assets ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Migration 2: Message Logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  channel text NOT NULL,
  provider text NOT NULL,
  status text NOT NULL,
  campaign_id uuid,
  lead_id uuid,
  recipient_phone text,
  message_text text,
  provider_message_id text,
  provider_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_logs_tenant_channel_idempotency
  ON public.message_logs (tenant_id, channel, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_message_logs_campaign_created_at
  ON public.message_logs (campaign_id, created_at DESC);

ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Migration 3: Approvals
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid
);

CREATE INDEX IF NOT EXISTS idx_approvals_campaign_status
  ON public.approvals (campaign_id, status, created_at DESC);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
