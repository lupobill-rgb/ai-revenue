-- Add missing columns to outbound_message_events
ALTER TABLE public.outbound_message_events 
ADD COLUMN IF NOT EXISTS message_text TEXT,
ADD COLUMN IF NOT EXISTS subject_line TEXT,
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

-- Create linkedin_tasks table
CREATE TABLE IF NOT EXISTS public.linkedin_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.outbound_sequence_runs(id) ON DELETE SET NULL,
  message_text TEXT NOT NULL,
  linkedin_url TEXT,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.linkedin_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.linkedin_tasks
FOR ALL USING (
  tenant_id = auth.uid() OR 
  tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_linkedin_tasks_status ON public.linkedin_tasks(status);

-- Create missing indexes
CREATE INDEX IF NOT EXISTS idx_sequence_runs_status ON public.outbound_sequence_runs(status);
CREATE INDEX IF NOT EXISTS idx_sequence_runs_due ON public.outbound_sequence_runs(next_step_due_at);
CREATE INDEX IF NOT EXISTS idx_message_events_run ON public.outbound_message_events(sequence_run_id);
CREATE INDEX IF NOT EXISTS idx_message_events_type ON public.outbound_message_events(event_type);