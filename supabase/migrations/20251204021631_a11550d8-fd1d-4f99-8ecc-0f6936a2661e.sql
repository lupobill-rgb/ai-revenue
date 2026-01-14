-- CMO Marketing Plans table
CREATE TABLE public.cmo_marketing_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  plan_type TEXT NOT NULL DEFAULT '90-day',
  status TEXT NOT NULL DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  
  -- Strategy Overview
  executive_summary TEXT,
  primary_objectives JSONB DEFAULT '[]'::jsonb,
  key_metrics JSONB DEFAULT '[]'::jsonb,
  budget_allocation JSONB DEFAULT '{}'::jsonb,
  
  -- Monthly Breakdown
  month_1_plan JSONB DEFAULT '{}'::jsonb,
  month_2_plan JSONB DEFAULT '{}'::jsonb,
  month_3_plan JSONB DEFAULT '{}'::jsonb,
  
  -- Channel Strategy
  channel_mix JSONB DEFAULT '[]'::jsonb,
  content_calendar_outline JSONB DEFAULT '[]'::jsonb,
  
  -- Campaign Themes
  campaign_themes JSONB DEFAULT '[]'::jsonb,
  
  -- Resources & Dependencies
  resource_requirements JSONB DEFAULT '[]'::jsonb,
  dependencies JSONB DEFAULT '[]'::jsonb,
  risks_mitigations JSONB DEFAULT '[]'::jsonb,
  
  -- Targeting
  target_icp_segments JSONB DEFAULT '[]'::jsonb,
  target_offers JSONB DEFAULT '[]'::jsonb,
  
  -- AI Generation Metadata
  generation_context JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);
-- Enable RLS
ALTER TABLE public.cmo_marketing_plans ENABLE ROW LEVEL SECURITY;
-- RLS Policies
CREATE POLICY "Users can view workspace marketing plans" ON public.cmo_marketing_plans
  FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace marketing plans" ON public.cmo_marketing_plans
  FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace marketing plans" ON public.cmo_marketing_plans
  FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace marketing plans" ON public.cmo_marketing_plans
  FOR DELETE USING (user_has_workspace_access(workspace_id));
-- Trigger for updated_at
CREATE TRIGGER update_cmo_marketing_plans_updated_at
  BEFORE UPDATE ON public.cmo_marketing_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
