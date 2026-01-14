-- Multi-tenant Architecture: Workspaces
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own workspaces" ON public.workspaces
  FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can create workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners can update their workspaces" ON public.workspaces
  FOR UPDATE USING (owner_id = auth.uid());
-- Workspace members for collaboration
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view workspace members" ON public.workspace_members
  FOR SELECT USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid()
  ));
CREATE POLICY "Workspace owners can manage members" ON public.workspace_members
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = workspace_members.workspace_id AND w.owner_id = auth.uid()
  ));
-- Content Calendar for scheduling
CREATE TABLE public.content_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL, -- email, social, video, voice
  channel TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'scheduled' NOT NULL, -- scheduled, published, failed, cancelled
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  content JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
ALTER TABLE public.content_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view calendar" ON public.content_calendar
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create calendar items" ON public.content_calendar
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update calendar items" ON public.content_calendar
  FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete calendar items" ON public.content_calendar
  FOR DELETE USING (true);
-- Automation Jobs tracking
CREATE TABLE public.automation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL, -- daily_optimization, content_publish, lead_nurture, performance_sync
  status TEXT DEFAULT 'pending' NOT NULL, -- pending, running, completed, failed
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  result JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view jobs" ON public.automation_jobs
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create jobs" ON public.automation_jobs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update jobs" ON public.automation_jobs
  FOR UPDATE USING (true);
-- Add workspace_id to existing tables for multi-tenancy
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
-- Triggers for updated_at
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_content_calendar_updated_at BEFORE UPDATE ON public.content_calendar
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
