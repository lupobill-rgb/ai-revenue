-- DAY 1 (SMS MVP): Minimal additive tables for new channel contracts.
-- NOTE: We intentionally keep these tables isolated and service-role-only (RLS enabled, no user policies)
-- to avoid changing existing tenancy/RLS behavior.

-- 1) Opt-outs (per-tenant, per-channel, per-identifier)
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
-- 2) Usage events (billable units)
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
-- 3) Campaign assets (generated content stored per campaign)
-- This intentionally does NOT FK to avoid coupling to legacy vs CMO campaign tables.
CREATE TABLE IF NOT EXISTS public.campaign_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  type text NOT NULL, -- e.g. 'sms'
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_assets_campaign_type_created_at
  ON public.campaign_assets (campaign_id, type, created_at DESC);
ALTER TABLE public.campaign_assets ENABLE ROW LEVEL SECURITY;
