-- Add workspace_id to remaining core tables for multi-tenant scoping

-- Sequence enrollments
ALTER TABLE public.sequence_enrollments 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Deals
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Email sequences
ALTER TABLE public.email_sequences 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Content templates
ALTER TABLE public.content_templates 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Lead activities
ALTER TABLE public.lead_activities 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Campaign metrics
ALTER TABLE public.campaign_metrics 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Segments
ALTER TABLE public.segments 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Create indexes for workspace_id on all tables for query performance
CREATE INDEX IF NOT EXISTS idx_leads_workspace ON public.leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON public.campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_assets_workspace ON public.assets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_deals_workspace ON public.deals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_sequences_workspace ON public.email_sequences(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_workspace ON public.sequence_enrollments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_content_calendar_workspace ON public.content_calendar(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_workspace ON public.automation_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_content_templates_workspace ON public.content_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_workspace ON public.lead_activities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_workspace ON public.campaign_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_segments_workspace ON public.segments(workspace_id);