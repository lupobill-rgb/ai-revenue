-- Create automation_steps table for relational automation management
CREATE TABLE public.automation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL,
  step_order integer NOT NULL DEFAULT 0,
  step_type text NOT NULL CHECK (step_type IN ('email', 'sms', 'wait', 'condition', 'voice', 'webhook', 'tag', 'move_stage')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY "tenant_isolation" ON public.automation_steps
  FOR ALL
  USING (
    (tenant_id = auth.uid()) OR 
    (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
  );

-- Add updated_at trigger
CREATE TRIGGER update_automation_steps_updated_at
  BEFORE UPDATE ON public.automation_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for efficient queries
CREATE INDEX idx_automation_steps_automation_id ON public.automation_steps(automation_id);
CREATE INDEX idx_automation_steps_workspace_id ON public.automation_steps(workspace_id);