-- DAY 1 (SMS MVP): Minimal message log table for direct-send channels.
-- IMPORTANT: We do NOT write to channel_outbox here. channel_outbox is reserved for dispatcher/worker pipeline.

CREATE TABLE IF NOT EXISTS public.message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  channel text NOT NULL,          -- 'sms'
  provider text NOT NULL,         -- 'twilio'
  status text NOT NULL,           -- 'sent' | 'failed'
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
-- DAY 1 (SMS MVP): Minimal message log table for direct-send functions.
-- NOTE: We do NOT write to channel_outbox here to preserve Execution Contract invariants:
-- only dispatcher/allowlist functions may write channel_outbox.

CREATE TABLE IF NOT EXISTS public.message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  channel text NOT NULL, -- 'sms', etc.
  provider text NOT NULL, -- 'twilio'
  status text NOT NULL, -- 'sent' | 'failed'
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
