-- Create voice_agents table for VAPI/ElevenLabs configs
CREATE TABLE public.voice_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NULL REFERENCES public.cmo_campaigns(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('vapi', 'elevenlabs')),
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Enable RLS
ALTER TABLE public.voice_agents ENABLE ROW LEVEL SECURITY;
-- Tenant isolation policy (matches existing pattern)
CREATE POLICY "tenant_isolation" ON public.voice_agents
  FOR ALL
  USING (
    (tenant_id = auth.uid()) OR 
    (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
  );
-- Add updated_at trigger
CREATE TRIGGER update_voice_agents_updated_at
  BEFORE UPDATE ON public.voice_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
