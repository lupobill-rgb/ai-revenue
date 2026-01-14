-- Add unique constraints for workspace-scoped tables
ALTER TABLE public.business_profiles ADD CONSTRAINT business_profiles_workspace_id_key UNIQUE (workspace_id);
ALTER TABLE public.social_integrations DROP CONSTRAINT IF EXISTS social_integrations_user_id_platform_key;
ALTER TABLE public.social_integrations ADD CONSTRAINT social_integrations_workspace_id_platform_key UNIQUE (workspace_id, platform);
