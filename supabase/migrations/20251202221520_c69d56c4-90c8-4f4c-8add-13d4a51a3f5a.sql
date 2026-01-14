-- Create deals table for opportunity tracking
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  value NUMERIC DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'prospecting',
  probability INTEGER DEFAULT 10,
  expected_close_date DATE,
  actual_close_date DATE,
  owner_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);
-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  task_type TEXT DEFAULT 'follow_up',
  assigned_to UUID,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);
-- Create email sequences table
CREATE TABLE public.email_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  trigger_type TEXT DEFAULT 'manual',
  total_steps INTEGER DEFAULT 0,
  enrolled_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);
-- Create email sequence steps table
CREATE TABLE public.email_sequence_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  delay_days INTEGER DEFAULT 0,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
-- Create sequence enrollments table
CREATE TABLE public.sequence_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  next_email_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sequence_id, lead_id)
);
-- Enable RLS on all tables
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;
-- RLS policies for deals
CREATE POLICY "Authenticated users can view all deals" ON public.deals FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create deals" ON public.deals FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update deals" ON public.deals FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete deals" ON public.deals FOR DELETE USING (true);
-- RLS policies for tasks
CREATE POLICY "Authenticated users can view all tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tasks" ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update tasks" ON public.tasks FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete tasks" ON public.tasks FOR DELETE USING (true);
-- RLS policies for email_sequences
CREATE POLICY "Authenticated users can view all sequences" ON public.email_sequences FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create sequences" ON public.email_sequences FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update sequences" ON public.email_sequences FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete sequences" ON public.email_sequences FOR DELETE USING (true);
-- RLS policies for email_sequence_steps
CREATE POLICY "Authenticated users can view all steps" ON public.email_sequence_steps FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create steps" ON public.email_sequence_steps FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update steps" ON public.email_sequence_steps FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete steps" ON public.email_sequence_steps FOR DELETE USING (true);
-- RLS policies for sequence_enrollments
CREATE POLICY "Authenticated users can view all enrollments" ON public.sequence_enrollments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create enrollments" ON public.sequence_enrollments FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update enrollments" ON public.sequence_enrollments FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete enrollments" ON public.sequence_enrollments FOR DELETE USING (true);
-- Update triggers for timestamps
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_sequences_updated_at BEFORE UPDATE ON public.email_sequences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_sequence_steps_updated_at BEFORE UPDATE ON public.email_sequence_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sequence_enrollments_updated_at BEFORE UPDATE ON public.sequence_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
