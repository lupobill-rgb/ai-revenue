-- CMO Brand Profiles table
CREATE TABLE public.cmo_brand_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  tagline TEXT,
  mission_statement TEXT,
  brand_voice TEXT,
  brand_tone TEXT,
  brand_personality JSONB DEFAULT '[]'::jsonb,
  core_values JSONB DEFAULT '[]'::jsonb,
  brand_colors JSONB DEFAULT '{}'::jsonb,
  brand_fonts JSONB DEFAULT '{}'::jsonb,
  logo_url TEXT,
  website_url TEXT,
  industry TEXT,
  competitors JSONB DEFAULT '[]'::jsonb,
  unique_value_proposition TEXT,
  key_differentiators JSONB DEFAULT '[]'::jsonb,
  messaging_pillars JSONB DEFAULT '[]'::jsonb,
  content_themes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);
-- CMO ICP Segments table
CREATE TABLE public.cmo_icp_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  segment_name TEXT NOT NULL,
  segment_description TEXT,
  demographics JSONB DEFAULT '{}'::jsonb,
  psychographics JSONB DEFAULT '{}'::jsonb,
  pain_points JSONB DEFAULT '[]'::jsonb,
  goals JSONB DEFAULT '[]'::jsonb,
  buying_triggers JSONB DEFAULT '[]'::jsonb,
  objections JSONB DEFAULT '[]'::jsonb,
  preferred_channels JSONB DEFAULT '[]'::jsonb,
  content_preferences JSONB DEFAULT '{}'::jsonb,
  decision_criteria JSONB DEFAULT '[]'::jsonb,
  budget_range JSONB DEFAULT '{}'::jsonb,
  company_size TEXT,
  industry_verticals JSONB DEFAULT '[]'::jsonb,
  job_titles JSONB DEFAULT '[]'::jsonb,
  is_primary BOOLEAN DEFAULT false,
  priority_score INTEGER DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);
-- CMO Offers table
CREATE TABLE public.cmo_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  offer_name TEXT NOT NULL,
  offer_type TEXT NOT NULL,
  description TEXT,
  key_benefits JSONB DEFAULT '[]'::jsonb,
  features JSONB DEFAULT '[]'::jsonb,
  pricing_model TEXT,
  price_range JSONB DEFAULT '{}'::jsonb,
  target_segments JSONB DEFAULT '[]'::jsonb,
  use_cases JSONB DEFAULT '[]'::jsonb,
  success_metrics JSONB DEFAULT '[]'::jsonb,
  testimonials JSONB DEFAULT '[]'::jsonb,
  case_studies JSONB DEFAULT '[]'::jsonb,
  competitive_positioning TEXT,
  launch_date DATE,
  status TEXT DEFAULT 'active',
  landing_page_url TEXT,
  demo_url TEXT,
  is_flagship BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);
-- Enable RLS
ALTER TABLE public.cmo_brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_icp_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_offers ENABLE ROW LEVEL SECURITY;
-- RLS Policies for cmo_brand_profiles
CREATE POLICY "Users can view workspace brand profiles" ON public.cmo_brand_profiles
  FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace brand profiles" ON public.cmo_brand_profiles
  FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace brand profiles" ON public.cmo_brand_profiles
  FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace brand profiles" ON public.cmo_brand_profiles
  FOR DELETE USING (user_has_workspace_access(workspace_id));
-- RLS Policies for cmo_icp_segments
CREATE POLICY "Users can view workspace ICP segments" ON public.cmo_icp_segments
  FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace ICP segments" ON public.cmo_icp_segments
  FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace ICP segments" ON public.cmo_icp_segments
  FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace ICP segments" ON public.cmo_icp_segments
  FOR DELETE USING (user_has_workspace_access(workspace_id));
-- RLS Policies for cmo_offers
CREATE POLICY "Users can view workspace offers" ON public.cmo_offers
  FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can create workspace offers" ON public.cmo_offers
  FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace offers" ON public.cmo_offers
  FOR UPDATE USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace offers" ON public.cmo_offers
  FOR DELETE USING (user_has_workspace_access(workspace_id));
-- Triggers for updated_at
CREATE TRIGGER update_cmo_brand_profiles_updated_at
  BEFORE UPDATE ON public.cmo_brand_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cmo_icp_segments_updated_at
  BEFORE UPDATE ON public.cmo_icp_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cmo_offers_updated_at
  BEFORE UPDATE ON public.cmo_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
