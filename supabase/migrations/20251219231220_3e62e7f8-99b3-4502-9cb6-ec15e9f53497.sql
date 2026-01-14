-- Create voice_phone_numbers table for tenant phone number provisioning
CREATE TABLE public.voice_phone_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  display_name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'vapi',
  provider_number_id TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
-- Enable RLS
ALTER TABLE public.voice_phone_numbers ENABLE ROW LEVEL SECURITY;
-- RLS policies for tenant isolation
CREATE POLICY "tenant_isolation_select" ON public.voice_phone_numbers
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.voice_phone_numbers
  FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.voice_phone_numbers
  FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.voice_phone_numbers
  FOR DELETE USING (user_belongs_to_tenant(tenant_id));
-- Create voice_call_records table for tenant-scoped call history
CREATE TABLE public.voice_call_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  phone_number_id UUID REFERENCES public.voice_phone_numbers(id),
  voice_agent_id UUID REFERENCES public.voice_agents(id),
  lead_id UUID REFERENCES public.leads(id),
  campaign_id UUID REFERENCES public.campaigns(id),
  provider_call_id TEXT,
  call_type TEXT NOT NULL DEFAULT 'outbound',
  status TEXT NOT NULL DEFAULT 'queued',
  customer_number TEXT,
  customer_name TEXT,
  duration_seconds INTEGER DEFAULT 0,
  cost NUMERIC(10,4) DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  transcript TEXT,
  summary TEXT,
  recording_url TEXT,
  outcome TEXT,
  failure_reason TEXT,
  analysis JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
-- Enable RLS
ALTER TABLE public.voice_call_records ENABLE ROW LEVEL SECURITY;
-- RLS policies for tenant isolation
CREATE POLICY "tenant_isolation_select" ON public.voice_call_records
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.voice_call_records
  FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.voice_call_records
  FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.voice_call_records
  FOR DELETE USING (user_belongs_to_tenant(tenant_id));
-- Add indexes for performance
CREATE INDEX idx_voice_phone_numbers_tenant ON public.voice_phone_numbers(tenant_id);
CREATE INDEX idx_voice_phone_numbers_workspace ON public.voice_phone_numbers(workspace_id);
CREATE INDEX idx_voice_call_records_tenant ON public.voice_call_records(tenant_id);
CREATE INDEX idx_voice_call_records_workspace ON public.voice_call_records(workspace_id);
CREATE INDEX idx_voice_call_records_lead ON public.voice_call_records(lead_id);
CREATE INDEX idx_voice_call_records_created ON public.voice_call_records(created_at DESC);
