-- Agent runs table for unified event logging
CREATE TABLE public.agent_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  mode TEXT,
  input JSONB DEFAULT '{}'::jsonb,
  output JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- CMO Campaigns table
CREATE TABLE public.cmo_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  funnel_id UUID REFERENCES public.cmo_funnels(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.cmo_marketing_plans(id) ON DELETE SET NULL,
  campaign_name TEXT NOT NULL,
  campaign_type TEXT NOT NULL,
  objective TEXT,
  description TEXT,
  target_icp TEXT,
  target_offer TEXT,
  funnel_stage TEXT,
  start_date DATE,
  end_date DATE,
  budget_allocation NUMERIC DEFAULT 0,
  primary_kpi JSONB DEFAULT '{}'::jsonb,
  secondary_kpis JSONB DEFAULT '[]'::jsonb,
  success_criteria TEXT,
  status TEXT DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CMO Campaign Channels table
CREATE TABLE public.cmo_campaign_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.cmo_campaigns(id) ON DELETE CASCADE,
  channel_name TEXT NOT NULL,
  channel_type TEXT,
  priority TEXT DEFAULT 'secondary',
  budget_percentage NUMERIC DEFAULT 0,
  content_types JSONB DEFAULT '[]'::jsonb,
  posting_frequency TEXT,
  targeting_notes TEXT,
  expected_metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CMO Content Assets table
CREATE TABLE public.cmo_content_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.cmo_campaigns(id) ON DELETE SET NULL,
  content_id TEXT,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL,
  channel TEXT,
  funnel_stage TEXT,
  target_icp TEXT,
  key_message TEXT,
  supporting_points JSONB DEFAULT '[]'::jsonb,
  cta TEXT,
  tone TEXT,
  estimated_production_time TEXT,
  dependencies JSONB DEFAULT '[]'::jsonb,
  publish_date DATE,
  status TEXT DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CMO Content Variants table
CREATE TABLE public.cmo_content_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.cmo_content_assets(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  variant_type TEXT DEFAULT 'A',
  subject_line TEXT,
  headline TEXT,
  body_content TEXT,
  cta_text TEXT,
  visual_description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  performance_metrics JSONB DEFAULT '{}'::jsonb,
  is_winner BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CMO Calendar Events table
CREATE TABLE public.cmo_calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.cmo_campaigns(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.cmo_content_assets(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  channel TEXT,
  status TEXT DEFAULT 'scheduled',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CMO Metrics Snapshots table
CREATE TABLE public.cmo_metrics_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.cmo_campaigns(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES public.cmo_campaign_channels(id) ON DELETE SET NULL,
  snapshot_date DATE NOT NULL,
  metric_type TEXT NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  engagement_rate NUMERIC DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  cost NUMERIC DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  roi NUMERIC DEFAULT 0,
  custom_metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CMO Weekly Summaries table
CREATE TABLE public.cmo_weekly_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  executive_summary TEXT,
  key_wins JSONB DEFAULT '[]'::jsonb,
  challenges JSONB DEFAULT '[]'::jsonb,
  metrics_summary JSONB DEFAULT '{}'::jsonb,
  top_performing_content JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  next_week_priorities JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CMO Recommendations table
CREATE TABLE public.cmo_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.cmo_campaigns(id) ON DELETE SET NULL,
  recommendation_type TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  rationale TEXT,
  expected_impact TEXT,
  effort_level TEXT,
  action_items JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending',
  implemented_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_campaign_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_content_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_content_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_runs
CREATE POLICY "Users can view workspace agent runs" ON public.agent_runs FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace agent runs" ON public.agent_runs FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));

-- RLS Policies for cmo_campaigns
CREATE POLICY "Users can view workspace campaigns" ON public.cmo_campaigns FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace campaigns" ON public.cmo_campaigns FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace campaigns" ON public.cmo_campaigns FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace campaigns" ON public.cmo_campaigns FOR DELETE USING (user_has_workspace_access(workspace_id));

-- Helper function for campaign channel access
CREATE OR REPLACE FUNCTION public.campaign_channel_workspace_access(channel_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cmo_campaigns c
    WHERE c.id = channel_campaign_id
      AND user_has_workspace_access(c.workspace_id)
  )
$$;

-- RLS Policies for cmo_campaign_channels
CREATE POLICY "Users can view workspace campaign channels" ON public.cmo_campaign_channels FOR SELECT USING (campaign_channel_workspace_access(campaign_id));
CREATE POLICY "Users can create workspace campaign channels" ON public.cmo_campaign_channels FOR INSERT WITH CHECK (campaign_channel_workspace_access(campaign_id));
CREATE POLICY "Users can update workspace campaign channels" ON public.cmo_campaign_channels FOR UPDATE USING (campaign_channel_workspace_access(campaign_id));
CREATE POLICY "Users can delete workspace campaign channels" ON public.cmo_campaign_channels FOR DELETE USING (campaign_channel_workspace_access(campaign_id));

-- RLS Policies for cmo_content_assets
CREATE POLICY "Users can view workspace content assets" ON public.cmo_content_assets FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace content assets" ON public.cmo_content_assets FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace content assets" ON public.cmo_content_assets FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace content assets" ON public.cmo_content_assets FOR DELETE USING (user_has_workspace_access(workspace_id));

-- Helper function for content variant access
CREATE OR REPLACE FUNCTION public.content_variant_workspace_access(variant_asset_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cmo_content_assets a
    WHERE a.id = variant_asset_id
      AND user_has_workspace_access(a.workspace_id)
  )
$$;

-- RLS Policies for cmo_content_variants
CREATE POLICY "Users can view workspace content variants" ON public.cmo_content_variants FOR SELECT USING (content_variant_workspace_access(asset_id));
CREATE POLICY "Users can create workspace content variants" ON public.cmo_content_variants FOR INSERT WITH CHECK (content_variant_workspace_access(asset_id));
CREATE POLICY "Users can update workspace content variants" ON public.cmo_content_variants FOR UPDATE USING (content_variant_workspace_access(asset_id));
CREATE POLICY "Users can delete workspace content variants" ON public.cmo_content_variants FOR DELETE USING (content_variant_workspace_access(asset_id));

-- RLS Policies for cmo_calendar_events
CREATE POLICY "Users can view workspace calendar events" ON public.cmo_calendar_events FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace calendar events" ON public.cmo_calendar_events FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace calendar events" ON public.cmo_calendar_events FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace calendar events" ON public.cmo_calendar_events FOR DELETE USING (user_has_workspace_access(workspace_id));

-- RLS Policies for cmo_metrics_snapshots
CREATE POLICY "Users can view workspace metrics snapshots" ON public.cmo_metrics_snapshots FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace metrics snapshots" ON public.cmo_metrics_snapshots FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));

-- RLS Policies for cmo_weekly_summaries
CREATE POLICY "Users can view workspace weekly summaries" ON public.cmo_weekly_summaries FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace weekly summaries" ON public.cmo_weekly_summaries FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace weekly summaries" ON public.cmo_weekly_summaries FOR UPDATE USING (user_has_workspace_access(workspace_id));

-- RLS Policies for cmo_recommendations
CREATE POLICY "Users can view workspace recommendations" ON public.cmo_recommendations FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace recommendations" ON public.cmo_recommendations FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace recommendations" ON public.cmo_recommendations FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace recommendations" ON public.cmo_recommendations FOR DELETE USING (user_has_workspace_access(workspace_id));

-- Add updated_at triggers
CREATE TRIGGER update_cmo_campaigns_updated_at BEFORE UPDATE ON public.cmo_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cmo_campaign_channels_updated_at BEFORE UPDATE ON public.cmo_campaign_channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cmo_content_assets_updated_at BEFORE UPDATE ON public.cmo_content_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cmo_content_variants_updated_at BEFORE UPDATE ON public.cmo_content_variants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cmo_calendar_events_updated_at BEFORE UPDATE ON public.cmo_calendar_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cmo_weekly_summaries_updated_at BEFORE UPDATE ON public.cmo_weekly_summaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cmo_recommendations_updated_at BEFORE UPDATE ON public.cmo_recommendations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_agent_runs_workspace ON public.agent_runs(workspace_id);
CREATE INDEX idx_agent_runs_agent ON public.agent_runs(agent);
CREATE INDEX idx_cmo_campaigns_workspace ON public.cmo_campaigns(workspace_id);
CREATE INDEX idx_cmo_campaigns_funnel ON public.cmo_campaigns(funnel_id);
CREATE INDEX idx_cmo_campaign_channels_campaign ON public.cmo_campaign_channels(campaign_id);
CREATE INDEX idx_cmo_content_assets_workspace ON public.cmo_content_assets(workspace_id);
CREATE INDEX idx_cmo_content_assets_campaign ON public.cmo_content_assets(campaign_id);
CREATE INDEX idx_cmo_content_variants_asset ON public.cmo_content_variants(asset_id);
CREATE INDEX idx_cmo_calendar_events_workspace ON public.cmo_calendar_events(workspace_id);
CREATE INDEX idx_cmo_calendar_events_scheduled ON public.cmo_calendar_events(scheduled_at);
CREATE INDEX idx_cmo_metrics_snapshots_workspace ON public.cmo_metrics_snapshots(workspace_id);
CREATE INDEX idx_cmo_metrics_snapshots_date ON public.cmo_metrics_snapshots(snapshot_date);
CREATE INDEX idx_cmo_weekly_summaries_workspace ON public.cmo_weekly_summaries(workspace_id);
CREATE INDEX idx_cmo_recommendations_workspace ON public.cmo_recommendations(workspace_id);