-- Create tenant module access table for launch toggles
CREATE TABLE IF NOT EXISTS public.tenant_module_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  module_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  beta_only BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, module_id)
);
-- Enable RLS
ALTER TABLE public.tenant_module_access ENABLE ROW LEVEL SECURITY;
-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenant_module_access_tenant_id ON public.tenant_module_access(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_module_access_module_id ON public.tenant_module_access(module_id);
-- RLS policy: authenticated users can read module access (tenant check done in app layer)
CREATE POLICY "Authenticated users can view module access"
ON public.tenant_module_access
FOR SELECT
TO authenticated
USING (true);
-- RLS policy: only service role can modify
CREATE POLICY "Service role can manage module access"
ON public.tenant_module_access
FOR ALL
TO service_role
USING (true);
-- Add updated_at trigger
CREATE TRIGGER update_tenant_module_access_updated_at
BEFORE UPDATE ON public.tenant_module_access
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
