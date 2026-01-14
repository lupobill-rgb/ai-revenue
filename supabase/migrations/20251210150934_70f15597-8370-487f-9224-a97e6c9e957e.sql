-- Create integration settings audit log table
CREATE TABLE public.integration_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  settings_type text NOT NULL, -- 'email', 'linkedin', 'calendar', 'crm', 'domain'
  action text NOT NULL DEFAULT 'update', -- 'create', 'update', 'delete'
  changes jsonb NOT NULL DEFAULT '{}', -- { field_name: { old: value, new: value } }
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
-- Enable RLS
ALTER TABLE public.integration_audit_log ENABLE ROW LEVEL SECURITY;
-- RLS policy for tenant isolation
CREATE POLICY "Users can view their own audit logs"
ON public.integration_audit_log
FOR SELECT
USING (tenant_id = auth.uid());
CREATE POLICY "Users can insert their own audit logs"
ON public.integration_audit_log
FOR INSERT
WITH CHECK (tenant_id = auth.uid());
-- Create index for efficient queries
CREATE INDEX idx_integration_audit_log_tenant ON public.integration_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_integration_audit_log_type ON public.integration_audit_log(settings_type, created_at DESC);
