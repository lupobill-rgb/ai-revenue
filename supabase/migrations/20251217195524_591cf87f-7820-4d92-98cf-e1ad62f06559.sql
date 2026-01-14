-- Fix ai_settings_* tables: Drop FK first, then migrate data, then add new FK

-- Step 1: Drop existing FK constraints FIRST
ALTER TABLE public.ai_settings_email DROP CONSTRAINT IF EXISTS ai_settings_email_tenant_id_fkey;
ALTER TABLE public.ai_settings_linkedin DROP CONSTRAINT IF EXISTS ai_settings_linkedin_tenant_id_fkey;
ALTER TABLE public.ai_settings_calendar DROP CONSTRAINT IF EXISTS ai_settings_calendar_tenant_id_fkey;
ALTER TABLE public.ai_settings_crm_webhooks DROP CONSTRAINT IF EXISTS ai_settings_crm_webhooks_tenant_id_fkey;
ALTER TABLE public.ai_settings_domain DROP CONSTRAINT IF EXISTS ai_settings_domain_tenant_id_fkey;
ALTER TABLE public.ai_settings_voice DROP CONSTRAINT IF EXISTS ai_settings_voice_tenant_id_fkey;
-- Step 2: Clean up orphaned settings (no workspace found)
DELETE FROM public.ai_settings_email 
WHERE tenant_id NOT IN (SELECT owner_id FROM public.workspaces WHERE owner_id IS NOT NULL);
DELETE FROM public.ai_settings_linkedin
WHERE tenant_id NOT IN (SELECT owner_id FROM public.workspaces WHERE owner_id IS NOT NULL);
DELETE FROM public.ai_settings_calendar
WHERE tenant_id NOT IN (SELECT owner_id FROM public.workspaces WHERE owner_id IS NOT NULL);
DELETE FROM public.ai_settings_crm_webhooks
WHERE tenant_id NOT IN (SELECT owner_id FROM public.workspaces WHERE owner_id IS NOT NULL);
DELETE FROM public.ai_settings_domain
WHERE tenant_id NOT IN (SELECT owner_id FROM public.workspaces WHERE owner_id IS NOT NULL);
DELETE FROM public.ai_settings_voice
WHERE tenant_id NOT IN (SELECT owner_id FROM public.workspaces WHERE owner_id IS NOT NULL);
-- Step 3: Migrate tenant_id from user_id to workspace_id
UPDATE public.ai_settings_email e
SET tenant_id = w.id
FROM public.workspaces w
WHERE w.owner_id = e.tenant_id;
UPDATE public.ai_settings_linkedin l
SET tenant_id = w.id
FROM public.workspaces w
WHERE w.owner_id = l.tenant_id;
UPDATE public.ai_settings_calendar c
SET tenant_id = w.id
FROM public.workspaces w
WHERE w.owner_id = c.tenant_id;
UPDATE public.ai_settings_crm_webhooks cr
SET tenant_id = w.id
FROM public.workspaces w
WHERE w.owner_id = cr.tenant_id;
UPDATE public.ai_settings_domain d
SET tenant_id = w.id
FROM public.workspaces w
WHERE w.owner_id = d.tenant_id;
UPDATE public.ai_settings_voice v
SET tenant_id = w.id
FROM public.workspaces w
WHERE w.owner_id = v.tenant_id;
-- Step 4: Add FK constraints to workspaces table
ALTER TABLE public.ai_settings_email 
  ADD CONSTRAINT ai_settings_email_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.ai_settings_linkedin 
  ADD CONSTRAINT ai_settings_linkedin_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.ai_settings_calendar 
  ADD CONSTRAINT ai_settings_calendar_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.ai_settings_crm_webhooks 
  ADD CONSTRAINT ai_settings_crm_webhooks_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.ai_settings_domain 
  ADD CONSTRAINT ai_settings_domain_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.ai_settings_voice 
  ADD CONSTRAINT ai_settings_voice_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
-- Step 5: Drop existing user-scoped RLS policies
DROP POLICY IF EXISTS "Users can view their own email settings" ON public.ai_settings_email;
DROP POLICY IF EXISTS "Users can insert their own email settings" ON public.ai_settings_email;
DROP POLICY IF EXISTS "Users can update their own email settings" ON public.ai_settings_email;
DROP POLICY IF EXISTS "Users can view their own linkedin settings" ON public.ai_settings_linkedin;
DROP POLICY IF EXISTS "Users can insert their own linkedin settings" ON public.ai_settings_linkedin;
DROP POLICY IF EXISTS "Users can update their own linkedin settings" ON public.ai_settings_linkedin;
DROP POLICY IF EXISTS "Users can view their own calendar settings" ON public.ai_settings_calendar;
DROP POLICY IF EXISTS "Users can insert their own calendar settings" ON public.ai_settings_calendar;
DROP POLICY IF EXISTS "Users can update their own calendar settings" ON public.ai_settings_calendar;
DROP POLICY IF EXISTS "Users can view their own crm webhook settings" ON public.ai_settings_crm_webhooks;
DROP POLICY IF EXISTS "Users can insert their own crm webhook settings" ON public.ai_settings_crm_webhooks;
DROP POLICY IF EXISTS "Users can update their own crm webhook settings" ON public.ai_settings_crm_webhooks;
DROP POLICY IF EXISTS "Users can view their own domain settings" ON public.ai_settings_domain;
DROP POLICY IF EXISTS "Users can insert their own domain settings" ON public.ai_settings_domain;
DROP POLICY IF EXISTS "Users can update their own domain settings" ON public.ai_settings_domain;
DROP POLICY IF EXISTS "Users can view own voice settings" ON public.ai_settings_voice;
DROP POLICY IF EXISTS "Users can insert own voice settings" ON public.ai_settings_voice;
DROP POLICY IF EXISTS "Users can update own voice settings" ON public.ai_settings_voice;
-- Step 6: Create new workspace-scoped RLS policies

-- ai_settings_email
CREATE POLICY "workspace_access_select" ON public.ai_settings_email
  FOR SELECT USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_insert" ON public.ai_settings_email
  FOR INSERT WITH CHECK (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_update" ON public.ai_settings_email
  FOR UPDATE USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_delete" ON public.ai_settings_email
  FOR DELETE USING (user_has_workspace_access(tenant_id));
-- ai_settings_linkedin
CREATE POLICY "workspace_access_select" ON public.ai_settings_linkedin
  FOR SELECT USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_insert" ON public.ai_settings_linkedin
  FOR INSERT WITH CHECK (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_update" ON public.ai_settings_linkedin
  FOR UPDATE USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_delete" ON public.ai_settings_linkedin
  FOR DELETE USING (user_has_workspace_access(tenant_id));
-- ai_settings_calendar
CREATE POLICY "workspace_access_select" ON public.ai_settings_calendar
  FOR SELECT USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_insert" ON public.ai_settings_calendar
  FOR INSERT WITH CHECK (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_update" ON public.ai_settings_calendar
  FOR UPDATE USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_delete" ON public.ai_settings_calendar
  FOR DELETE USING (user_has_workspace_access(tenant_id));
-- ai_settings_crm_webhooks
CREATE POLICY "workspace_access_select" ON public.ai_settings_crm_webhooks
  FOR SELECT USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_insert" ON public.ai_settings_crm_webhooks
  FOR INSERT WITH CHECK (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_update" ON public.ai_settings_crm_webhooks
  FOR UPDATE USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_delete" ON public.ai_settings_crm_webhooks
  FOR DELETE USING (user_has_workspace_access(tenant_id));
-- ai_settings_domain
CREATE POLICY "workspace_access_select" ON public.ai_settings_domain
  FOR SELECT USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_insert" ON public.ai_settings_domain
  FOR INSERT WITH CHECK (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_update" ON public.ai_settings_domain
  FOR UPDATE USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_delete" ON public.ai_settings_domain
  FOR DELETE USING (user_has_workspace_access(tenant_id));
-- ai_settings_voice
CREATE POLICY "workspace_access_select" ON public.ai_settings_voice
  FOR SELECT USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_insert" ON public.ai_settings_voice
  FOR INSERT WITH CHECK (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_update" ON public.ai_settings_voice
  FOR UPDATE USING (user_has_workspace_access(tenant_id));
CREATE POLICY "workspace_access_delete" ON public.ai_settings_voice
  FOR DELETE USING (user_has_workspace_access(tenant_id));
