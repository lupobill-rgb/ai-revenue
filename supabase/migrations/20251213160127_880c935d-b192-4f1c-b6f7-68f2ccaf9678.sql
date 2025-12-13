-- Create opportunity_channel_attribution bridge table
CREATE TABLE opportunity_channel_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,      -- FK → opportunities.id
  channel_id uuid NOT NULL,          -- FK → cmo_campaign_channels.id

  role text NOT NULL DEFAULT 'primary',  -- 'primary' | 'assist'
  weight numeric(5, 4) NOT NULL DEFAULT 1.0, -- simple weighting if needed

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Foreign keys
ALTER TABLE opportunity_channel_attribution
  ADD CONSTRAINT opp_channel_attr_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE;

ALTER TABLE opportunity_channel_attribution
  ADD CONSTRAINT opp_channel_attr_opp_fk
  FOREIGN KEY (opportunity_id) REFERENCES opportunities (id) ON DELETE CASCADE;

ALTER TABLE opportunity_channel_attribution
  ADD CONSTRAINT opp_channel_attr_channel_fk
  FOREIGN KEY (channel_id) REFERENCES cmo_campaign_channels (id) ON DELETE CASCADE;

-- Query indexes
CREATE INDEX IF NOT EXISTS idx_opp_channel_attr_tenant_opp
  ON opportunity_channel_attribution (tenant_id, opportunity_id);

CREATE INDEX IF NOT EXISTS idx_opp_channel_attr_tenant_channel
  ON opportunity_channel_attribution (tenant_id, channel_id);

-- Enable RLS
ALTER TABLE opportunity_channel_attribution ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY "tenant_isolation" ON opportunity_channel_attribution
  FOR ALL
  USING (
    (tenant_id = auth.uid()) OR 
    (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
  );

-- Documentation
COMMENT ON TABLE opportunity_channel_attribution IS 'Bridge table for opportunity-to-channel attribution. Supports primary/assist roles and weighting.';
COMMENT ON COLUMN opportunity_channel_attribution.role IS 'Attribution role: primary or assist';
COMMENT ON COLUMN opportunity_channel_attribution.weight IS 'Attribution weight (0-1) for multi-touch models';