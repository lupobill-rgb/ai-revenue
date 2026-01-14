-- Create user_tenants table for tenant membership
CREATE TABLE public.user_tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);
-- Populate user_tenants from existing workspace data
INSERT INTO public.user_tenants (user_id, tenant_id, role)
SELECT owner_id, id, 'owner' FROM public.workspaces
UNION
SELECT user_id, workspace_id, role FROM public.workspace_members;
-- Enable RLS on user_tenants
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their tenant memberships" ON public.user_tenants FOR SELECT USING (user_id = auth.uid());
-- Add tenant_id column to all CMO tables and copy from workspace_id
ALTER TABLE public.cmo_brand_profiles ADD COLUMN tenant_id UUID;
UPDATE public.cmo_brand_profiles SET tenant_id = workspace_id;
ALTER TABLE public.cmo_brand_profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.cmo_icp_segments ADD COLUMN tenant_id UUID;
UPDATE public.cmo_icp_segments SET tenant_id = workspace_id;
ALTER TABLE public.cmo_icp_segments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.cmo_offers ADD COLUMN tenant_id UUID;
UPDATE public.cmo_offers SET tenant_id = workspace_id;
ALTER TABLE public.cmo_offers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.cmo_marketing_plans ADD COLUMN tenant_id UUID;
UPDATE public.cmo_marketing_plans SET tenant_id = workspace_id;
ALTER TABLE public.cmo_marketing_plans ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.cmo_funnels ADD COLUMN tenant_id UUID;
UPDATE public.cmo_funnels SET tenant_id = workspace_id;
ALTER TABLE public.cmo_funnels ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.cmo_campaigns ADD COLUMN tenant_id UUID;
UPDATE public.cmo_campaigns SET tenant_id = workspace_id;
ALTER TABLE public.cmo_campaigns ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.cmo_content_assets ADD COLUMN tenant_id UUID;
UPDATE public.cmo_content_assets SET tenant_id = workspace_id;
ALTER TABLE public.cmo_content_assets ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.cmo_calendar_events ADD COLUMN tenant_id UUID;
UPDATE public.cmo_calendar_events SET tenant_id = workspace_id;
ALTER TABLE public.cmo_calendar_events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.cmo_metrics_snapshots ADD COLUMN tenant_id UUID;
UPDATE public.cmo_metrics_snapshots SET tenant_id = workspace_id;
ALTER TABLE public.cmo_metrics_snapshots ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.cmo_weekly_summaries ADD COLUMN tenant_id UUID;
UPDATE public.cmo_weekly_summaries SET tenant_id = workspace_id;
ALTER TABLE public.cmo_weekly_summaries ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.cmo_recommendations ADD COLUMN tenant_id UUID;
UPDATE public.cmo_recommendations SET tenant_id = workspace_id;
ALTER TABLE public.cmo_recommendations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.agent_runs ADD COLUMN tenant_id UUID;
UPDATE public.agent_runs SET tenant_id = workspace_id;
ALTER TABLE public.agent_runs ALTER COLUMN tenant_id SET NOT NULL;
-- Drop existing policies and create new tenant_isolation policies
DROP POLICY IF EXISTS "Users can view workspace brand profiles" ON public.cmo_brand_profiles;
DROP POLICY IF EXISTS "Users can create workspace brand profiles" ON public.cmo_brand_profiles;
DROP POLICY IF EXISTS "Users can update workspace brand profiles" ON public.cmo_brand_profiles;
DROP POLICY IF EXISTS "Users can delete workspace brand profiles" ON public.cmo_brand_profiles;
CREATE POLICY "tenant_isolation" ON public.cmo_brand_profiles USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view workspace ICP segments" ON public.cmo_icp_segments;
DROP POLICY IF EXISTS "Users can create workspace ICP segments" ON public.cmo_icp_segments;
DROP POLICY IF EXISTS "Users can update workspace ICP segments" ON public.cmo_icp_segments;
DROP POLICY IF EXISTS "Users can delete workspace ICP segments" ON public.cmo_icp_segments;
CREATE POLICY "tenant_isolation" ON public.cmo_icp_segments USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view workspace offers" ON public.cmo_offers;
DROP POLICY IF EXISTS "Users can create workspace offers" ON public.cmo_offers;
DROP POLICY IF EXISTS "Users can update workspace offers" ON public.cmo_offers;
DROP POLICY IF EXISTS "Users can delete workspace offers" ON public.cmo_offers;
CREATE POLICY "tenant_isolation" ON public.cmo_offers USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view workspace marketing plans" ON public.cmo_marketing_plans;
DROP POLICY IF EXISTS "Users can create workspace marketing plans" ON public.cmo_marketing_plans;
DROP POLICY IF EXISTS "Users can update workspace marketing plans" ON public.cmo_marketing_plans;
DROP POLICY IF EXISTS "Users can delete workspace marketing plans" ON public.cmo_marketing_plans;
CREATE POLICY "tenant_isolation" ON public.cmo_marketing_plans USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view workspace funnels" ON public.cmo_funnels;
DROP POLICY IF EXISTS "Users can create workspace funnels" ON public.cmo_funnels;
DROP POLICY IF EXISTS "Users can update workspace funnels" ON public.cmo_funnels;
DROP POLICY IF EXISTS "Users can delete workspace funnels" ON public.cmo_funnels;
CREATE POLICY "tenant_isolation" ON public.cmo_funnels USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view workspace campaigns" ON public.cmo_campaigns;
DROP POLICY IF EXISTS "Users can create workspace campaigns" ON public.cmo_campaigns;
DROP POLICY IF EXISTS "Users can update workspace campaigns" ON public.cmo_campaigns;
DROP POLICY IF EXISTS "Users can delete workspace campaigns" ON public.cmo_campaigns;
CREATE POLICY "tenant_isolation" ON public.cmo_campaigns USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view workspace content assets" ON public.cmo_content_assets;
DROP POLICY IF EXISTS "Users can create workspace content assets" ON public.cmo_content_assets;
DROP POLICY IF EXISTS "Users can update workspace content assets" ON public.cmo_content_assets;
DROP POLICY IF EXISTS "Users can delete workspace content assets" ON public.cmo_content_assets;
CREATE POLICY "tenant_isolation" ON public.cmo_content_assets USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view workspace calendar events" ON public.cmo_calendar_events;
DROP POLICY IF EXISTS "Users can create workspace calendar events" ON public.cmo_calendar_events;
DROP POLICY IF EXISTS "Users can update workspace calendar events" ON public.cmo_calendar_events;
DROP POLICY IF EXISTS "Users can delete workspace calendar events" ON public.cmo_calendar_events;
CREATE POLICY "tenant_isolation" ON public.cmo_calendar_events USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view workspace metrics snapshots" ON public.cmo_metrics_snapshots;
DROP POLICY IF EXISTS "Users can create workspace metrics snapshots" ON public.cmo_metrics_snapshots;
CREATE POLICY "tenant_isolation" ON public.cmo_metrics_snapshots USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view workspace weekly summaries" ON public.cmo_weekly_summaries;
DROP POLICY IF EXISTS "Users can create workspace weekly summaries" ON public.cmo_weekly_summaries;
DROP POLICY IF EXISTS "Users can update workspace weekly summaries" ON public.cmo_weekly_summaries;
CREATE POLICY "tenant_isolation" ON public.cmo_weekly_summaries USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view workspace recommendations" ON public.cmo_recommendations;
DROP POLICY IF EXISTS "Users can create workspace recommendations" ON public.cmo_recommendations;
DROP POLICY IF EXISTS "Users can update workspace recommendations" ON public.cmo_recommendations;
DROP POLICY IF EXISTS "Users can delete workspace recommendations" ON public.cmo_recommendations;
CREATE POLICY "tenant_isolation" ON public.cmo_recommendations USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view workspace agent runs" ON public.agent_runs;
DROP POLICY IF EXISTS "Users can create workspace agent runs" ON public.agent_runs;
CREATE POLICY "tenant_isolation" ON public.agent_runs USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
-- Add indexes on tenant_id for performance
CREATE INDEX idx_cmo_brand_profiles_tenant ON public.cmo_brand_profiles(tenant_id);
CREATE INDEX idx_cmo_icp_segments_tenant ON public.cmo_icp_segments(tenant_id);
CREATE INDEX idx_cmo_offers_tenant ON public.cmo_offers(tenant_id);
CREATE INDEX idx_cmo_marketing_plans_tenant ON public.cmo_marketing_plans(tenant_id);
CREATE INDEX idx_cmo_funnels_tenant ON public.cmo_funnels(tenant_id);
CREATE INDEX idx_cmo_campaigns_tenant ON public.cmo_campaigns(tenant_id);
CREATE INDEX idx_cmo_content_assets_tenant ON public.cmo_content_assets(tenant_id);
CREATE INDEX idx_cmo_calendar_events_tenant ON public.cmo_calendar_events(tenant_id);
CREATE INDEX idx_cmo_metrics_snapshots_tenant ON public.cmo_metrics_snapshots(tenant_id);
CREATE INDEX idx_cmo_weekly_summaries_tenant ON public.cmo_weekly_summaries(tenant_id);
CREATE INDEX idx_cmo_recommendations_tenant ON public.cmo_recommendations(tenant_id);
CREATE INDEX idx_agent_runs_tenant ON public.agent_runs(tenant_id);
CREATE INDEX idx_user_tenants_user ON public.user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant ON public.user_tenants(tenant_id);
