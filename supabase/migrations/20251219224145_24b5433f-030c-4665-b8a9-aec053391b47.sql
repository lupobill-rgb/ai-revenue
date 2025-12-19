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

-- ============================================
-- FIX RLS POLICIES FOR ALL AFFECTED TABLES
-- ============================================

-- 1. accounts
DROP POLICY IF EXISTS "tenant_isolation" ON public.accounts;
CREATE POLICY "tenant_isolation_select" ON public.accounts FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.accounts FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.accounts FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.accounts FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 2. agent_runs
DROP POLICY IF EXISTS "tenant_isolation" ON public.agent_runs;
CREATE POLICY "tenant_isolation_select" ON public.agent_runs FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.agent_runs FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.agent_runs FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.agent_runs FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 3. automation_steps
DROP POLICY IF EXISTS "tenant_isolation" ON public.automation_steps;
CREATE POLICY "tenant_isolation_select" ON public.automation_steps FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.automation_steps FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.automation_steps FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.automation_steps FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 4. campaign_channel_stats_daily
DROP POLICY IF EXISTS "tenant_isolation" ON public.campaign_channel_stats_daily;
CREATE POLICY "tenant_isolation_select" ON public.campaign_channel_stats_daily FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.campaign_channel_stats_daily FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.campaign_channel_stats_daily FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.campaign_channel_stats_daily FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 5. campaign_optimizations
DROP POLICY IF EXISTS "tenant_isolation" ON public.campaign_optimizations;
CREATE POLICY "tenant_isolation_select" ON public.campaign_optimizations FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.campaign_optimizations FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.campaign_optimizations FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.campaign_optimizations FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 6. cmo_brand_profiles
DROP POLICY IF EXISTS "tenant_isolation" ON public.cmo_brand_profiles;
CREATE POLICY "tenant_isolation_select" ON public.cmo_brand_profiles FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.cmo_brand_profiles FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.cmo_brand_profiles FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.cmo_brand_profiles FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 7. cmo_calendar_events
DROP POLICY IF EXISTS "tenant_isolation" ON public.cmo_calendar_events;
CREATE POLICY "tenant_isolation_select" ON public.cmo_calendar_events FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.cmo_calendar_events FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.cmo_calendar_events FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.cmo_calendar_events FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 8. cmo_campaigns
DROP POLICY IF EXISTS "tenant_isolation" ON public.cmo_campaigns;
CREATE POLICY "tenant_isolation_select" ON public.cmo_campaigns FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.cmo_campaigns FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.cmo_campaigns FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.cmo_campaigns FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 9. cmo_content_assets
DROP POLICY IF EXISTS "tenant_isolation" ON public.cmo_content_assets;
CREATE POLICY "tenant_isolation_select" ON public.cmo_content_assets FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.cmo_content_assets FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.cmo_content_assets FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.cmo_content_assets FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 10. cmo_funnels
DROP POLICY IF EXISTS "tenant_isolation" ON public.cmo_funnels;
CREATE POLICY "tenant_isolation_select" ON public.cmo_funnels FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.cmo_funnels FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.cmo_funnels FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.cmo_funnels FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 11. cmo_icp_segments
DROP POLICY IF EXISTS "tenant_isolation" ON public.cmo_icp_segments;
CREATE POLICY "tenant_isolation_select" ON public.cmo_icp_segments FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.cmo_icp_segments FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.cmo_icp_segments FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.cmo_icp_segments FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 12. cmo_marketing_plans
DROP POLICY IF EXISTS "tenant_isolation" ON public.cmo_marketing_plans;
CREATE POLICY "tenant_isolation_select" ON public.cmo_marketing_plans FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.cmo_marketing_plans FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.cmo_marketing_plans FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.cmo_marketing_plans FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 13. cmo_metrics_snapshots
DROP POLICY IF EXISTS "tenant_isolation" ON public.cmo_metrics_snapshots;
CREATE POLICY "tenant_isolation_select" ON public.cmo_metrics_snapshots FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.cmo_metrics_snapshots FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.cmo_metrics_snapshots FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.cmo_metrics_snapshots FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 14. cmo_offers
DROP POLICY IF EXISTS "tenant_isolation" ON public.cmo_offers;
CREATE POLICY "tenant_isolation_select" ON public.cmo_offers FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.cmo_offers FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.cmo_offers FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.cmo_offers FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 15. cmo_recommendations
DROP POLICY IF EXISTS "tenant_isolation" ON public.cmo_recommendations;
CREATE POLICY "tenant_isolation_select" ON public.cmo_recommendations FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.cmo_recommendations FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.cmo_recommendations FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.cmo_recommendations FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 16. cmo_weekly_summaries
DROP POLICY IF EXISTS "tenant_isolation" ON public.cmo_weekly_summaries;
CREATE POLICY "tenant_isolation_select" ON public.cmo_weekly_summaries FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.cmo_weekly_summaries FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.cmo_weekly_summaries FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.cmo_weekly_summaries FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 17. crm_activities
DROP POLICY IF EXISTS "tenant_delete_activities" ON public.crm_activities;
DROP POLICY IF EXISTS "tenant_insert_activities" ON public.crm_activities;
DROP POLICY IF EXISTS "tenant_select_activities" ON public.crm_activities;
DROP POLICY IF EXISTS "tenant_update_activities" ON public.crm_activities;
CREATE POLICY "tenant_isolation_select" ON public.crm_activities FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.crm_activities FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.crm_activities FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.crm_activities FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 18. crm_contacts
DROP POLICY IF EXISTS "tenant_delete_contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "tenant_insert_contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "tenant_select_contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "tenant_update_contacts" ON public.crm_contacts;
CREATE POLICY "tenant_isolation_select" ON public.crm_contacts FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.crm_contacts FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.crm_contacts FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.crm_contacts FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 19. crm_leads
DROP POLICY IF EXISTS "tenant_delete_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "tenant_insert_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "tenant_select_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "tenant_update_leads" ON public.crm_leads;
CREATE POLICY "tenant_isolation_select" ON public.crm_leads FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.crm_leads FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.crm_leads FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.crm_leads FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 20. cro_deal_reviews
DROP POLICY IF EXISTS "tenant_isolation" ON public.cro_deal_reviews;
CREATE POLICY "tenant_isolation_select" ON public.cro_deal_reviews FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.cro_deal_reviews FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.cro_deal_reviews FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.cro_deal_reviews FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 21. cro_forecasts
DROP POLICY IF EXISTS "tenant_isolation" ON public.cro_forecasts;
CREATE POLICY "tenant_isolation_select" ON public.cro_forecasts FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.cro_forecasts FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.cro_forecasts FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.cro_forecasts FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 22. cro_recommendations
DROP POLICY IF EXISTS "tenant_isolation" ON public.cro_recommendations;
CREATE POLICY "tenant_isolation_select" ON public.cro_recommendations FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.cro_recommendations FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.cro_recommendations FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.cro_recommendations FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 23. cro_targets
DROP POLICY IF EXISTS "tenant_isolation" ON public.cro_targets;
CREATE POLICY "tenant_isolation_select" ON public.cro_targets FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.cro_targets FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.cro_targets FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.cro_targets FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 24. customer_integrations
DROP POLICY IF EXISTS "tenant_isolation" ON public.customer_integrations;
CREATE POLICY "tenant_isolation_select" ON public.customer_integrations FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.customer_integrations FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.customer_integrations FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.customer_integrations FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 25. email_events
DROP POLICY IF EXISTS "tenant_isolation" ON public.email_events;
CREATE POLICY "tenant_isolation_select" ON public.email_events FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.email_events FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.email_events FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.email_events FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 26. events_raw
DROP POLICY IF EXISTS "tenant_isolation" ON public.events_raw;
CREATE POLICY "tenant_isolation_select" ON public.events_raw FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.events_raw FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.events_raw FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.events_raw FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 27. integration_audit_log
DROP POLICY IF EXISTS "tenant_isolation" ON public.integration_audit_log;
CREATE POLICY "tenant_isolation_select" ON public.integration_audit_log FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.integration_audit_log FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.integration_audit_log FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.integration_audit_log FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 28. kernel_cycle_slo
DROP POLICY IF EXISTS "tenant_isolation" ON public.kernel_cycle_slo;
CREATE POLICY "tenant_isolation_select" ON public.kernel_cycle_slo FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.kernel_cycle_slo FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.kernel_cycle_slo FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.kernel_cycle_slo FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 29. landing_pages
DROP POLICY IF EXISTS "tenant_isolation" ON public.landing_pages;
CREATE POLICY "tenant_isolation_select" ON public.landing_pages FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.landing_pages FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.landing_pages FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.landing_pages FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 30. linkedin_tasks
DROP POLICY IF EXISTS "tenant_isolation" ON public.linkedin_tasks;
CREATE POLICY "tenant_isolation_select" ON public.linkedin_tasks FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.linkedin_tasks FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.linkedin_tasks FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.linkedin_tasks FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 31. metric_snapshots_daily
DROP POLICY IF EXISTS "tenant_isolation" ON public.metric_snapshots_daily;
CREATE POLICY "tenant_isolation_select" ON public.metric_snapshots_daily FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.metric_snapshots_daily FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.metric_snapshots_daily FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.metric_snapshots_daily FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 32. opportunities
DROP POLICY IF EXISTS "tenant_isolation" ON public.opportunities;
CREATE POLICY "tenant_isolation_select" ON public.opportunities FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.opportunities FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.opportunities FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.opportunities FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 33. optimization_action_results
DROP POLICY IF EXISTS "tenant_isolation" ON public.optimization_action_results;
CREATE POLICY "tenant_isolation_select" ON public.optimization_action_results FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.optimization_action_results FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.optimization_action_results FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.optimization_action_results FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 34. optimization_actions
DROP POLICY IF EXISTS "tenant_isolation" ON public.optimization_actions;
CREATE POLICY "tenant_isolation_select" ON public.optimization_actions FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.optimization_actions FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.optimization_actions FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.optimization_actions FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 35. optimization_cycles
DROP POLICY IF EXISTS "tenant_isolation" ON public.optimization_cycles;
CREATE POLICY "tenant_isolation_select" ON public.optimization_cycles FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.optimization_cycles FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.optimization_cycles FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.optimization_cycles FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 36. optimizer_configs
DROP POLICY IF EXISTS "tenant_isolation" ON public.optimizer_configs;
CREATE POLICY "tenant_isolation_select" ON public.optimizer_configs FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.optimizer_configs FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.optimizer_configs FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.optimizer_configs FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 37. outbound_campaigns
DROP POLICY IF EXISTS "tenant_isolation" ON public.outbound_campaigns;
CREATE POLICY "tenant_isolation_select" ON public.outbound_campaigns FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.outbound_campaigns FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.outbound_campaigns FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.outbound_campaigns FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 38. outbound_message_events
DROP POLICY IF EXISTS "tenant_isolation" ON public.outbound_message_events;
CREATE POLICY "tenant_isolation_select" ON public.outbound_message_events FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.outbound_message_events FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.outbound_message_events FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.outbound_message_events FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 39. outbound_sequence_runs
DROP POLICY IF EXISTS "tenant_isolation" ON public.outbound_sequence_runs;
CREATE POLICY "tenant_isolation_select" ON public.outbound_sequence_runs FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.outbound_sequence_runs FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.outbound_sequence_runs FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.outbound_sequence_runs FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 40. outbound_sequence_steps
DROP POLICY IF EXISTS "tenant_isolation" ON public.outbound_sequence_steps;
CREATE POLICY "tenant_isolation_select" ON public.outbound_sequence_steps FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.outbound_sequence_steps FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.outbound_sequence_steps FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.outbound_sequence_steps FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 41. outbound_sequences
DROP POLICY IF EXISTS "tenant_isolation" ON public.outbound_sequences;
CREATE POLICY "tenant_isolation_select" ON public.outbound_sequences FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.outbound_sequences FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.outbound_sequences FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.outbound_sequences FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 42. prospect_scores
DROP POLICY IF EXISTS "tenant_isolation" ON public.prospect_scores;
CREATE POLICY "tenant_isolation_select" ON public.prospect_scores FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.prospect_scores FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.prospect_scores FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.prospect_scores FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 43. prospect_signals
DROP POLICY IF EXISTS "tenant_isolation" ON public.prospect_signals;
CREATE POLICY "tenant_isolation_select" ON public.prospect_signals FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.prospect_signals FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.prospect_signals FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.prospect_signals FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 44. prospects
DROP POLICY IF EXISTS "tenant_isolation" ON public.prospects;
CREATE POLICY "tenant_isolation_select" ON public.prospects FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.prospects FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.prospects FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.prospects FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 45. revenue_events
DROP POLICY IF EXISTS "tenant_isolation" ON public.revenue_events;
CREATE POLICY "tenant_isolation_select" ON public.revenue_events FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.revenue_events FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.revenue_events FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.revenue_events FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 46. spine_campaign_channels
DROP POLICY IF EXISTS "tenant_isolation" ON public.spine_campaign_channels;
CREATE POLICY "tenant_isolation_select" ON public.spine_campaign_channels FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.spine_campaign_channels FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.spine_campaign_channels FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.spine_campaign_channels FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 47. spine_campaigns
DROP POLICY IF EXISTS "tenant_isolation" ON public.spine_campaigns;
CREATE POLICY "tenant_isolation_select" ON public.spine_campaigns FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.spine_campaigns FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.spine_campaigns FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.spine_campaigns FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 48. spine_contacts
DROP POLICY IF EXISTS "tenant_isolation" ON public.spine_contacts;
CREATE POLICY "tenant_isolation_select" ON public.spine_contacts FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.spine_contacts FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.spine_contacts FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.spine_contacts FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 49. spine_crm_activities
DROP POLICY IF EXISTS "tenant_isolation" ON public.spine_crm_activities;
CREATE POLICY "tenant_isolation_select" ON public.spine_crm_activities FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.spine_crm_activities FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.spine_crm_activities FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.spine_crm_activities FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 50. team_invitations
DROP POLICY IF EXISTS "tenant_isolation" ON public.team_invitations;
CREATE POLICY "tenant_isolation_select" ON public.team_invitations FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.team_invitations FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.team_invitations FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.team_invitations FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 51. tenant_module_access
DROP POLICY IF EXISTS "tenant_isolation" ON public.tenant_module_access;
CREATE POLICY "tenant_isolation_select" ON public.tenant_module_access FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.tenant_module_access FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.tenant_module_access FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.tenant_module_access FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 52. tenant_segments
DROP POLICY IF EXISTS "tenant_isolation" ON public.tenant_segments;
CREATE POLICY "tenant_isolation_select" ON public.tenant_segments FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.tenant_segments FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.tenant_segments FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.tenant_segments FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 53. tenant_targets
DROP POLICY IF EXISTS "tenant_isolation" ON public.tenant_targets;
CREATE POLICY "tenant_isolation_select" ON public.tenant_targets FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.tenant_targets FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.tenant_targets FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.tenant_targets FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- 54. voice_agents
DROP POLICY IF EXISTS "tenant_isolation" ON public.voice_agents;
CREATE POLICY "tenant_isolation_select" ON public.voice_agents FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.voice_agents FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.voice_agents FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.voice_agents FOR DELETE USING (user_belongs_to_tenant(tenant_id));