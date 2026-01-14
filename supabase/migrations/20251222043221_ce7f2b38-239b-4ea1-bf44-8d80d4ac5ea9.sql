-- 1) Create enum for data mode
DO $$ BEGIN
  CREATE TYPE data_mode AS ENUM ('live','demo');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
-- 2) Add column to core event tables
ALTER TABLE IF EXISTS campaign_runs ADD COLUMN IF NOT EXISTS data_mode data_mode NOT NULL DEFAULT 'live';
ALTER TABLE IF EXISTS channel_outbox ADD COLUMN IF NOT EXISTS data_mode data_mode NOT NULL DEFAULT 'live';
ALTER TABLE IF EXISTS job_queue ADD COLUMN IF NOT EXISTS data_mode data_mode NOT NULL DEFAULT 'live';
ALTER TABLE IF EXISTS crm_activities ADD COLUMN IF NOT EXISTS data_mode data_mode NOT NULL DEFAULT 'live';
-- 3) Helpful indexes for filtering by tenant + mode + time
CREATE INDEX IF NOT EXISTS idx_outbox_tenant_mode_time
  ON channel_outbox (tenant_id, data_mode, created_at);
CREATE INDEX IF NOT EXISTS idx_runs_tenant_mode_time
  ON campaign_runs (tenant_id, data_mode, created_at);
