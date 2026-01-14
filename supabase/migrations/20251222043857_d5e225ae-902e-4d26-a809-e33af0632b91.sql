-- Add data_mode to impressions/clicks tables
ALTER TABLE IF EXISTS campaign_channel_stats_daily 
  ADD COLUMN IF NOT EXISTS data_mode data_mode NOT NULL DEFAULT 'live';
ALTER TABLE IF EXISTS cmo_metrics_snapshots 
  ADD COLUMN IF NOT EXISTS data_mode data_mode NOT NULL DEFAULT 'live';
ALTER TABLE IF EXISTS channel_spend_daily 
  ADD COLUMN IF NOT EXISTS data_mode data_mode NOT NULL DEFAULT 'live';
-- Create indexes for efficient mode filtering (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaign_channel_stats_daily') THEN
    CREATE INDEX IF NOT EXISTS idx_stats_daily_tenant_mode ON campaign_channel_stats_daily (tenant_id, data_mode);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cmo_metrics_snapshots') THEN
    CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_tenant_mode ON cmo_metrics_snapshots (tenant_id, data_mode);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'channel_spend_daily') THEN
    CREATE INDEX IF NOT EXISTS idx_channel_spend_tenant_mode ON channel_spend_daily (tenant_id, data_mode);
  END IF;
END $$;
-- Note: View v_impressions_clicks_by_workspace creation skipped as required tables may not exist
-- If you need this view, create it manually when all required tables (campaign_channel_stats_daily, 
-- channel_spend_daily, cmo_metrics_snapshots) are present.;
