-- Drop existing broad policies
DROP POLICY IF EXISTS "tenant_isolation" ON channel_spend_daily;
DROP POLICY IF EXISTS "tenant_isolation" ON opportunity_channel_attribution;

-- channel_spend_daily: Tenant isolation for authenticated users
CREATE POLICY tenant_isolation_select_channel_spend_daily
  ON channel_spend_daily
  FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY tenant_isolation_insert_channel_spend_daily
  ON channel_spend_daily
  FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY tenant_isolation_update_channel_spend_daily
  ON channel_spend_daily
  FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY tenant_isolation_delete_channel_spend_daily
  ON channel_spend_daily
  FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

-- opportunity_channel_attribution: Tenant isolation for authenticated users
CREATE POLICY tenant_isolation_select_opp_attr
  ON opportunity_channel_attribution
  FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY tenant_isolation_insert_opp_attr
  ON opportunity_channel_attribution
  FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY tenant_isolation_update_opp_attr
  ON opportunity_channel_attribution
  FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY tenant_isolation_delete_opp_attr
  ON opportunity_channel_attribution
  FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));