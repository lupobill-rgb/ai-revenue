-- SMS additive tables: tenant-safe RLS + hot indexes
-- Aligns with existing workspace-scoped tenant pattern:
--   user_has_workspace_access(<tenant_id>)
--
-- Tables:
--   - public.opt_outs
--   - public.usage_events
--   - public.campaign_assets
--   - public.message_logs

-- ============================================================
-- Indexes (tenant_id, created_at) + hot keys
-- ============================================================

-- opt_outs already has:
--   idx_opt_outs_tenant_created_at (tenant_id, created_at desc)
--   idx_opt_outs_tenant_channel_phone (tenant_id, channel, phone) unique

-- usage_events: add tenant-wide time index + tenant+campaign lookup
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_created_at
  ON public.usage_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_campaign_created_at
  ON public.usage_events (tenant_id, campaign_id, created_at DESC);

-- campaign_assets: add tenant-wide time index + tenant+campaign hot path
CREATE INDEX IF NOT EXISTS idx_campaign_assets_tenant_created_at
  ON public.campaign_assets (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_assets_tenant_campaign_type_created_at
  ON public.campaign_assets (tenant_id, campaign_id, type, created_at DESC);

-- message_logs: add tenant-wide time index + smoke/hot lookup path
CREATE INDEX IF NOT EXISTS idx_message_logs_tenant_created_at
  ON public.message_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_logs_tenant_channel_provider_message_id
  ON public.message_logs (tenant_id, channel, provider_message_id);

-- ============================================================
-- RLS policies (tenant-scoped CRUD)
-- ============================================================

-- opt_outs
ALTER TABLE public.opt_outs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_access_select" ON public.opt_outs;
DROP POLICY IF EXISTS "workspace_access_insert" ON public.opt_outs;
DROP POLICY IF EXISTS "workspace_access_update" ON public.opt_outs;
DROP POLICY IF EXISTS "workspace_access_delete" ON public.opt_outs;
CREATE POLICY "workspace_access_select" ON public.opt_outs
  FOR SELECT USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_insert" ON public.opt_outs
  FOR INSERT WITH CHECK (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_update" ON public.opt_outs
  FOR UPDATE USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_delete" ON public.opt_outs
  FOR DELETE USING (user_has_workspace_access(tenant_id));

-- usage_events
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_access_select" ON public.usage_events;
DROP POLICY IF EXISTS "workspace_access_insert" ON public.usage_events;
DROP POLICY IF EXISTS "workspace_access_update" ON public.usage_events;
DROP POLICY IF EXISTS "workspace_access_delete" ON public.usage_events;
CREATE POLICY "workspace_access_select" ON public.usage_events
  FOR SELECT USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_insert" ON public.usage_events
  FOR INSERT WITH CHECK (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_update" ON public.usage_events
  FOR UPDATE USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_delete" ON public.usage_events
  FOR DELETE USING (user_has_workspace_access(tenant_id));

-- campaign_assets
ALTER TABLE public.campaign_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_access_select" ON public.campaign_assets;
DROP POLICY IF EXISTS "workspace_access_insert" ON public.campaign_assets;
DROP POLICY IF EXISTS "workspace_access_update" ON public.campaign_assets;
DROP POLICY IF EXISTS "workspace_access_delete" ON public.campaign_assets;
CREATE POLICY "workspace_access_select" ON public.campaign_assets
  FOR SELECT USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_insert" ON public.campaign_assets
  FOR INSERT WITH CHECK (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_update" ON public.campaign_assets
  FOR UPDATE USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_delete" ON public.campaign_assets
  FOR DELETE USING (user_has_workspace_access(tenant_id));

-- message_logs
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_access_select" ON public.message_logs;
DROP POLICY IF EXISTS "workspace_access_insert" ON public.message_logs;
DROP POLICY IF EXISTS "workspace_access_update" ON public.message_logs;
DROP POLICY IF EXISTS "workspace_access_delete" ON public.message_logs;
CREATE POLICY "workspace_access_select" ON public.message_logs
  FOR SELECT USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_insert" ON public.message_logs
  FOR INSERT WITH CHECK (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_update" ON public.message_logs
  FOR UPDATE USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_delete" ON public.message_logs
  FOR DELETE USING (user_has_workspace_access(tenant_id));

