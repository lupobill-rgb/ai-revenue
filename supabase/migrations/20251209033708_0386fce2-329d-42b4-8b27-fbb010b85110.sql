-- Outbound OS Module Schema for AI CMO

-- 1. Prospects
CREATE TABLE public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  external_id text,
  first_name text,
  last_name text,
  title text,
  company text,
  email text,
  linkedin_url text,
  location text,
  industry text,
  persona_tag text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.prospects
FOR ALL USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
);
CREATE TRIGGER update_prospects_updated_at
BEFORE UPDATE ON public.prospects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- 2. Prospect Signals
CREATE TABLE public.prospect_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  source text NOT NULL,
  signal_type text NOT NULL,
  signal_data jsonb NOT NULL DEFAULT '{}',
  signal_strength integer,
  detected_at timestamptz DEFAULT now()
);
ALTER TABLE public.prospect_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.prospect_signals
FOR ALL USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
);
-- 3. Prospect Scores
CREATE TABLE public.prospect_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 50,
  band text,
  rationale text,
  last_scored_at timestamptz DEFAULT now()
);
ALTER TABLE public.prospect_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.prospect_scores
FOR ALL USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
);
-- 4. Outbound Campaigns
CREATE TABLE public.outbound_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  channel text NOT NULL,
  objective text,
  target_persona text,
  status text DEFAULT 'draft',
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.outbound_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.outbound_campaigns
FOR ALL USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
);
CREATE TRIGGER update_outbound_campaigns_updated_at
BEFORE UPDATE ON public.outbound_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- 5. Outbound Sequences
CREATE TABLE public.outbound_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.outbound_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.outbound_sequences
FOR ALL USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
);
-- 6. Outbound Sequence Steps
CREATE TABLE public.outbound_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  sequence_id uuid NOT NULL REFERENCES public.outbound_sequences(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  step_type text NOT NULL,
  delay_days integer NOT NULL DEFAULT 0,
  message_template text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.outbound_sequence_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.outbound_sequence_steps
FOR ALL USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
);
-- 7. Outbound Sequence Runs
CREATE TABLE public.outbound_sequence_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  sequence_id uuid NOT NULL REFERENCES public.outbound_sequences(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  status text DEFAULT 'active',
  started_at timestamptz DEFAULT now(),
  last_step_sent integer DEFAULT 0,
  next_step_due_at timestamptz
);
ALTER TABLE public.outbound_sequence_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.outbound_sequence_runs
FOR ALL USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
);
-- 8. Outbound Message Events
CREATE TABLE public.outbound_message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  sequence_run_id uuid NOT NULL REFERENCES public.outbound_sequence_runs(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.outbound_sequence_steps(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  channel text NOT NULL,
  metadata jsonb DEFAULT '{}',
  occurred_at timestamptz DEFAULT now()
);
ALTER TABLE public.outbound_message_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.outbound_message_events
FOR ALL USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
);
