-- Create external OS tenants registry for AI CMO integration
CREATE TABLE IF NOT EXISTS public.os_tenant_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tenant_id UUID NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
-- Add index for faster lookups
CREATE INDEX idx_os_tenant_registry_slug ON public.os_tenant_registry(slug);
CREATE INDEX idx_os_tenant_registry_tenant_id ON public.os_tenant_registry(tenant_id);
-- Enable RLS
ALTER TABLE public.os_tenant_registry ENABLE ROW LEVEL SECURITY;
-- Allow authenticated users to read tenant registry (for service discovery)
CREATE POLICY "Authenticated users can view tenant registry" 
ON public.os_tenant_registry 
FOR SELECT 
USING (auth.uid() IS NOT NULL);
-- Only admins can modify tenant registry
CREATE POLICY "Admins can manage tenant registry" 
ON public.os_tenant_registry 
FOR ALL 
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
-- Create trigger for updated_at
CREATE TRIGGER update_os_tenant_registry_updated_at
BEFORE UPDATE ON public.os_tenant_registry
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Generate a new UUID for FTS tenant
-- Insert First Touch Coaching as external OS tenant
INSERT INTO public.os_tenant_registry (slug, name, tenant_id, description, config)
VALUES (
  'first-touch-coaching',
  'First Touch Coaching',
  gen_random_uuid(),
  'Youth soccer coaching organization with Camp Registration and Private Lessons funnels',
  '{
    "source": "external_os",
    "funnels": ["Camp Registration", "Private Lessons"],
    "channels": ["email", "sms"],
    "integration_type": "ai_cmo"
  }'::jsonb
);
-- Create workspace for FTS tenant (only if a user exists)
INSERT INTO public.workspaces (id, name, slug, owner_id)
SELECT 
  otr.tenant_id,
  'First Touch Coaching',
  'first-touch-coaching',
  u.id
FROM public.os_tenant_registry otr
CROSS JOIN (SELECT id FROM auth.users LIMIT 1) u
WHERE otr.slug = 'first-touch-coaching'
  AND NOT EXISTS (
    SELECT 1 FROM public.workspaces WHERE id = otr.tenant_id
  );
-- Add user_tenant mapping for FTS (only if a user exists)
INSERT INTO public.user_tenants (tenant_id, user_id, role)
SELECT 
  otr.tenant_id,
  u.id,
  'admin'
FROM public.os_tenant_registry otr
CROSS JOIN (SELECT id FROM auth.users LIMIT 1) u
WHERE otr.slug = 'first-touch-coaching'
ON CONFLICT DO NOTHING;
