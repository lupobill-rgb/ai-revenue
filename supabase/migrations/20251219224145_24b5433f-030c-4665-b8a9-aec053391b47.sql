-- ============================================
-- CRITICAL SECURITY FIX: Tenant Isolation RLS
-- ============================================
-- ISSUE: Many RLS policies incorrectly use (tenant_id = auth.uid())
-- This is WRONG because tenant_id is NOT the user's auth id.
-- The correct check is ONLY via the user_tenants mapping table.

-- Create a SECURITY DEFINER helper function for tenant membership check
-- This avoids infinite recursion and is performant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_tenants
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
  )
  OR public.is_platform_admin(auth.uid())
$$;
-- Helper function to safely drop and create policies (only if table exists)
CREATE OR REPLACE FUNCTION pg_temp.safe_create_tenant_policies(table_name text)
RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND tables.table_name = safe_create_tenant_policies.table_name) THEN
    -- Drop old policies
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_delete_%s" ON public.%I', replace(table_name, 'crm_', ''), table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_insert_%s" ON public.%I', replace(table_name, 'crm_', ''), table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_select_%s" ON public.%I', replace(table_name, 'crm_', ''), table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_update_%s" ON public.%I', replace(table_name, 'crm_', ''), table_name);
    
    -- Create new tenant isolation policies
    EXECUTE format('CREATE POLICY "tenant_isolation_select" ON public.%I FOR SELECT USING (user_belongs_to_tenant(tenant_id))', table_name);
    EXECUTE format('CREATE POLICY "tenant_isolation_insert" ON public.%I FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id))', table_name);
    EXECUTE format('CREATE POLICY "tenant_isolation_update" ON public.%I FOR UPDATE USING (user_belongs_to_tenant(tenant_id))', table_name);
    EXECUTE format('CREATE POLICY "tenant_isolation_delete" ON public.%I FOR DELETE USING (user_belongs_to_tenant(tenant_id))', table_name);
    
    RAISE NOTICE 'Applied tenant isolation policies to %', table_name;
  ELSE
    RAISE NOTICE 'Skipping % - table does not exist', table_name;
  END IF;
END;
$$ LANGUAGE plpgsql;
-- ============================================
-- FIX RLS POLICIES FOR ALL AFFECTED TABLES
-- ============================================

-- Apply tenant isolation to all relevant tables (only if they exist)
SELECT pg_temp.safe_create_tenant_policies('accounts');
SELECT pg_temp.safe_create_tenant_policies('agent_runs');
SELECT pg_temp.safe_create_tenant_policies('automation_steps');
SELECT pg_temp.safe_create_tenant_policies('campaign_channel_stats_daily');
SELECT pg_temp.safe_create_tenant_policies('campaign_optimizations');
SELECT pg_temp.safe_create_tenant_policies('cmo_brand_profiles');
SELECT pg_temp.safe_create_tenant_policies('cmo_calendar_events');
SELECT pg_temp.safe_create_tenant_policies('cmo_campaigns');
SELECT pg_temp.safe_create_tenant_policies('cmo_content_assets');
SELECT pg_temp.safe_create_tenant_policies('cmo_funnels');
SELECT pg_temp.safe_create_tenant_policies('cmo_icp_segments');
SELECT pg_temp.safe_create_tenant_policies('cmo_marketing_plans');
SELECT pg_temp.safe_create_tenant_policies('cmo_metrics_snapshots');
SELECT pg_temp.safe_create_tenant_policies('cmo_offers');
SELECT pg_temp.safe_create_tenant_policies('cmo_recommendations');
SELECT pg_temp.safe_create_tenant_policies('cmo_weekly_summaries');
SELECT pg_temp.safe_create_tenant_policies('crm_activities');
SELECT pg_temp.safe_create_tenant_policies('crm_contacts');
SELECT pg_temp.safe_create_tenant_policies('crm_leads');
SELECT pg_temp.safe_create_tenant_policies('cro_deal_reviews');
SELECT pg_temp.safe_create_tenant_policies('cro_forecasts');
SELECT pg_temp.safe_create_tenant_policies('cro_recommendations');
SELECT pg_temp.safe_create_tenant_policies('cro_targets');
SELECT pg_temp.safe_create_tenant_policies('customer_integrations');
SELECT pg_temp.safe_create_tenant_policies('email_events');
SELECT pg_temp.safe_create_tenant_policies('events_raw');
SELECT pg_temp.safe_create_tenant_policies('integration_audit_log');
SELECT pg_temp.safe_create_tenant_policies('kernel_cycle_slo');
SELECT pg_temp.safe_create_tenant_policies('landing_pages');
SELECT pg_temp.safe_create_tenant_policies('linkedin_tasks');
SELECT pg_temp.safe_create_tenant_policies('metric_snapshots_daily');
SELECT pg_temp.safe_create_tenant_policies('opportunities');
SELECT pg_temp.safe_create_tenant_policies('optimization_action_results');
SELECT pg_temp.safe_create_tenant_policies('optimization_actions');
SELECT pg_temp.safe_create_tenant_policies('optimization_cycles');
SELECT pg_temp.safe_create_tenant_policies('optimizer_configs');
SELECT pg_temp.safe_create_tenant_policies('outbound_campaigns');
SELECT pg_temp.safe_create_tenant_policies('outbound_message_events');
SELECT pg_temp.safe_create_tenant_policies('outbound_sequence_runs');
SELECT pg_temp.safe_create_tenant_policies('outbound_sequence_steps');
SELECT pg_temp.safe_create_tenant_policies('outbound_sequences');
SELECT pg_temp.safe_create_tenant_policies('prospect_scores');
SELECT pg_temp.safe_create_tenant_policies('prospect_signals');
SELECT pg_temp.safe_create_tenant_policies('prospects');
SELECT pg_temp.safe_create_tenant_policies('revenue_events');
SELECT pg_temp.safe_create_tenant_policies('spine_campaign_channels');
SELECT pg_temp.safe_create_tenant_policies('spine_campaigns');
SELECT pg_temp.safe_create_tenant_policies('spine_contacts');
SELECT pg_temp.safe_create_tenant_policies('spine_crm_activities');
SELECT pg_temp.safe_create_tenant_policies('team_invitations');
SELECT pg_temp.safe_create_tenant_policies('tenant_module_access');
SELECT pg_temp.safe_create_tenant_policies('tenant_segments');
SELECT pg_temp.safe_create_tenant_policies('tenant_targets');
SELECT pg_temp.safe_create_tenant_policies('voice_agents');
