-- Step 1: Create stripe_events table
CREATE TABLE IF NOT EXISTS stripe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_mode data_mode NOT NULL DEFAULT 'live',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Enable RLS
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
-- Tenant isolation policies
CREATE POLICY "tenant_isolation_select" ON stripe_events FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON stripe_events FOR INSERT
  WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON stripe_events FOR UPDATE
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON stripe_events FOR DELETE
  USING (user_belongs_to_tenant(tenant_id));
-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_stripe_events_workspace_mode 
  ON stripe_events (workspace_id, tenant_id, data_mode);
