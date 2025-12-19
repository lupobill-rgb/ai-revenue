-- Create campaign_runs table for tracking deployed campaign executions
CREATE TABLE public.campaign_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  run_config JSONB DEFAULT '{}'::jsonb,
  metrics_snapshot JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- First update existing rows to have valid status values
UPDATE public.campaigns SET status = 'running' WHERE status = 'live';
UPDATE public.campaigns SET status = 'pending_approval' WHERE status = 'pending';

-- Now add the constraint
ALTER TABLE public.campaigns 
  DROP CONSTRAINT IF EXISTS campaigns_status_check;

ALTER TABLE public.campaigns 
  ADD CONSTRAINT campaigns_status_check 
  CHECK (status IN ('draft', 'pending_approval', 'approved', 'deployed', 'running', 'paused', 'completed', 'failed', 'scheduled', 'active'));

-- Add is_locked column to campaigns to prevent editing after deploy
ALTER TABLE public.campaigns 
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS locked_reason TEXT;

-- Enable RLS on campaign_runs
ALTER TABLE public.campaign_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for campaign_runs
CREATE POLICY "tenant_isolation_select" ON public.campaign_runs
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "tenant_isolation_insert" ON public.campaign_runs
  FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "tenant_isolation_update" ON public.campaign_runs
  FOR UPDATE USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "tenant_isolation_delete" ON public.campaign_runs
  FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- Create indexes for faster lookups
CREATE INDEX idx_campaign_runs_campaign_id ON public.campaign_runs(campaign_id);
CREATE INDEX idx_campaign_runs_status ON public.campaign_runs(status);
CREATE INDEX idx_campaign_runs_tenant_id ON public.campaign_runs(tenant_id);

-- Add trigger for updated_at
CREATE TRIGGER update_campaign_runs_updated_at
  BEFORE UPDATE ON public.campaign_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();