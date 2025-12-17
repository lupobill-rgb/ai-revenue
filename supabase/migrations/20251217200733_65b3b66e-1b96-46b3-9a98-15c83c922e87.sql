-- Migration: Convert user-scoped tables to workspace-scoped for full tenant access
-- Tables affected: business_profiles, channel_preferences, social_integrations

-- 1. Add workspace_id column to business_profiles
ALTER TABLE public.business_profiles 
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);

-- Populate workspace_id from user's owned workspace
UPDATE public.business_profiles bp
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.owner_id = bp.user_id
AND bp.workspace_id IS NULL;

-- Also check workspace_members for users who aren't owners
UPDATE public.business_profiles bp
SET workspace_id = wm.workspace_id
FROM public.workspace_members wm
WHERE wm.user_id = bp.user_id
AND bp.workspace_id IS NULL;

-- 2. Add workspace_id column to social_integrations
ALTER TABLE public.social_integrations 
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);

-- Populate workspace_id from user's owned workspace
UPDATE public.social_integrations si
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.owner_id = si.user_id
AND si.workspace_id IS NULL;

-- Also check workspace_members
UPDATE public.social_integrations si
SET workspace_id = wm.workspace_id
FROM public.workspace_members wm
WHERE wm.user_id = si.user_id
AND si.workspace_id IS NULL;

-- 3. channel_preferences already has workspace_id column, ensure it's populated
UPDATE public.channel_preferences cp
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.owner_id = cp.user_id
AND cp.workspace_id IS NULL;

UPDATE public.channel_preferences cp
SET workspace_id = wm.workspace_id
FROM public.workspace_members wm
WHERE wm.user_id = cp.user_id
AND cp.workspace_id IS NULL;

-- 4. Drop old user-scoped RLS policies on business_profiles
DROP POLICY IF EXISTS "Users can create their own business profile" ON public.business_profiles;
DROP POLICY IF EXISTS "Users can delete their own business profile" ON public.business_profiles;
DROP POLICY IF EXISTS "Users can update their own business profile" ON public.business_profiles;
DROP POLICY IF EXISTS "Users can view their own business profile" ON public.business_profiles;

-- Create workspace-scoped RLS policies for business_profiles
CREATE POLICY "workspace_access_select" ON public.business_profiles
FOR SELECT USING (user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_access_insert" ON public.business_profiles
FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_access_update" ON public.business_profiles
FOR UPDATE USING (user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_access_delete" ON public.business_profiles
FOR DELETE USING (user_has_workspace_access(workspace_id));

-- 5. Drop old user-scoped RLS policies on social_integrations
DROP POLICY IF EXISTS "Users can delete their own integrations" ON public.social_integrations;
DROP POLICY IF EXISTS "Users can insert their own integrations" ON public.social_integrations;
DROP POLICY IF EXISTS "Users can update their own integrations" ON public.social_integrations;
DROP POLICY IF EXISTS "Users can view their own integrations" ON public.social_integrations;

-- Create workspace-scoped RLS policies for social_integrations
CREATE POLICY "workspace_access_select" ON public.social_integrations
FOR SELECT USING (user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_access_insert" ON public.social_integrations
FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_access_update" ON public.social_integrations
FOR UPDATE USING (user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_access_delete" ON public.social_integrations
FOR DELETE USING (user_has_workspace_access(workspace_id));

-- 6. Drop old user-scoped RLS policies on channel_preferences
DROP POLICY IF EXISTS "Users can view their own channel preferences" ON public.channel_preferences;
DROP POLICY IF EXISTS "Users can insert their own channel preferences" ON public.channel_preferences;
DROP POLICY IF EXISTS "Users can update their own channel preferences" ON public.channel_preferences;

-- Create workspace-scoped RLS policies for channel_preferences
CREATE POLICY "workspace_access_select" ON public.channel_preferences
FOR SELECT USING (user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_access_insert" ON public.channel_preferences
FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_access_update" ON public.channel_preferences
FOR UPDATE USING (user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_access_delete" ON public.channel_preferences
FOR DELETE USING (user_has_workspace_access(workspace_id));