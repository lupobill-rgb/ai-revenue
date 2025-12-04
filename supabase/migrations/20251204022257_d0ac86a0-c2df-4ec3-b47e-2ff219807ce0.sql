-- CMO Funnels table
CREATE TABLE public.cmo_funnels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.cmo_marketing_plans(id) ON DELETE SET NULL,
  funnel_name TEXT NOT NULL,
  funnel_type TEXT NOT NULL DEFAULT 'marketing',
  description TEXT,
  target_icp_segments JSONB DEFAULT '[]'::jsonb,
  target_offers JSONB DEFAULT '[]'::jsonb,
  total_budget NUMERIC DEFAULT 0,
  expected_conversion_rate NUMERIC DEFAULT 0,
  expected_revenue NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- CMO Funnel Stages table
CREATE TABLE public.cmo_funnel_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID NOT NULL REFERENCES public.cmo_funnels(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  stage_type TEXT NOT NULL,
  stage_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  objective TEXT,
  kpis JSONB DEFAULT '[]'::jsonb,
  campaign_types JSONB DEFAULT '[]'::jsonb,
  channels JSONB DEFAULT '[]'::jsonb,
  content_assets JSONB DEFAULT '[]'::jsonb,
  target_icps JSONB DEFAULT '[]'::jsonb,
  linked_offers JSONB DEFAULT '[]'::jsonb,
  entry_criteria TEXT,
  exit_criteria TEXT,
  expected_volume INTEGER DEFAULT 0,
  conversion_rate_target NUMERIC DEFAULT 0,
  budget_allocation NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cmo_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_funnel_stages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cmo_funnels
CREATE POLICY "Users can view workspace funnels" ON public.cmo_funnels
  FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace funnels" ON public.cmo_funnels
  FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace funnels" ON public.cmo_funnels
  FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace funnels" ON public.cmo_funnels
  FOR DELETE USING (user_has_workspace_access(workspace_id));

-- Helper function for funnel stage access
CREATE OR REPLACE FUNCTION public.funnel_stage_workspace_access(stage_funnel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cmo_funnels f
    WHERE f.id = stage_funnel_id
      AND user_has_workspace_access(f.workspace_id)
  )
$$;

-- RLS Policies for cmo_funnel_stages
CREATE POLICY "Users can view workspace funnel stages" ON public.cmo_funnel_stages
  FOR SELECT USING (funnel_stage_workspace_access(funnel_id));
CREATE POLICY "Users can create workspace funnel stages" ON public.cmo_funnel_stages
  FOR INSERT WITH CHECK (funnel_stage_workspace_access(funnel_id));
CREATE POLICY "Users can update workspace funnel stages" ON public.cmo_funnel_stages
  FOR UPDATE USING (funnel_stage_workspace_access(funnel_id));
CREATE POLICY "Users can delete workspace funnel stages" ON public.cmo_funnel_stages
  FOR DELETE USING (funnel_stage_workspace_access(funnel_id));

-- Triggers
CREATE TRIGGER update_cmo_funnels_updated_at
  BEFORE UPDATE ON public.cmo_funnels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cmo_funnel_stages_updated_at
  BEFORE UPDATE ON public.cmo_funnel_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();