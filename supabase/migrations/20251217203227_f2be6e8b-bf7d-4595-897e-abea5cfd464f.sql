-- Create ai_settings_stripe table for Stripe integration settings
CREATE TABLE public.ai_settings_stripe (
  tenant_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stripe_publishable_key text DEFAULT '',
  stripe_secret_key_hint text DEFAULT '',
  webhook_secret_hint text DEFAULT '',
  is_connected boolean DEFAULT false,
  account_name text DEFAULT '',
  updated_at timestamp with time zone DEFAULT now()
);
-- Enable RLS
ALTER TABLE public.ai_settings_stripe ENABLE ROW LEVEL SECURITY;
-- Create workspace-scoped RLS policies
CREATE POLICY "workspace_access_select" ON public.ai_settings_stripe
FOR SELECT USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_insert" ON public.ai_settings_stripe
FOR INSERT WITH CHECK (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_update" ON public.ai_settings_stripe
FOR UPDATE USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_delete" ON public.ai_settings_stripe
FOR DELETE USING (user_has_workspace_access(tenant_id));
