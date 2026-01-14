-- Create tenant_module_access table for module toggles
CREATE TABLE IF NOT EXISTS public.tenant_module_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  module_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, module_id)
);
-- Enable RLS
ALTER TABLE public.tenant_module_access ENABLE ROW LEVEL SECURITY;
-- Create RLS policy for tenant isolation
CREATE POLICY "tenant_isolation" ON public.tenant_module_access
FOR ALL
USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT user_tenants.tenant_id FROM user_tenants WHERE user_tenants.user_id = auth.uid()))
);
-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenant_module_access_tenant_module 
ON public.tenant_module_access(tenant_id, module_id);
-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER update_tenant_module_access_updated_at
  BEFORE UPDATE ON public.tenant_module_access
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
