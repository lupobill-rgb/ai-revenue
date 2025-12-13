-- Create channel_spend_daily table for ad spend + topline performance
CREATE TABLE channel_spend_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id uuid NOT NULL,
  channel_id uuid NOT NULL,             -- FK → cmo_campaign_channels.id

  date date NOT NULL,                   -- day of spend

  currency text NOT NULL DEFAULT 'USD', -- ISO code

  spend numeric(14, 2) NOT NULL DEFAULT 0,       -- ad spend for the day
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,

  leads integer NOT NULL DEFAULT 0,              -- marketing qualified or raw leads
  opportunities integer NOT NULL DEFAULT 0,      -- opps created from this channel that day
  revenue_booked numeric(14, 2) NOT NULL DEFAULT 0, -- closed-won revenue tied to this channel/day

  attribution_window_days integer NOT NULL DEFAULT 7,  -- what window was used to tie opps/revenue
  attribution_model text NOT NULL DEFAULT 'simple_last_touch',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Foreign keys
ALTER TABLE channel_spend_daily
  ADD CONSTRAINT channel_spend_daily_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE;

ALTER TABLE channel_spend_daily
  ADD CONSTRAINT channel_spend_daily_channel_fk
  FOREIGN KEY (channel_id) REFERENCES cmo_campaign_channels (id) ON DELETE CASCADE;

-- Unique constraint for upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_spend_daily_unique
  ON channel_spend_daily (tenant_id, channel_id, date);

-- Query optimization index
CREATE INDEX IF NOT EXISTS idx_channel_spend_daily_tenant_date
  ON channel_spend_daily (tenant_id, date);

-- Enable RLS
ALTER TABLE channel_spend_daily ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY "tenant_isolation" ON channel_spend_daily
  FOR ALL
  USING (
    (tenant_id = auth.uid()) OR 
    (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
  );

-- Updated_at trigger
CREATE TRIGGER update_channel_spend_daily_updated_at
  BEFORE UPDATE ON channel_spend_daily
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Documentation
COMMENT ON TABLE channel_spend_daily IS 'Daily ad spend and performance facts per channel. Metric jobs read this to derive cac_paid, spend_total_paid, etc.';
COMMENT ON COLUMN channel_spend_daily.attribution_model IS 'Attribution model used: simple_last_touch, first_touch, linear, etc.';