-- ============================================================
-- REMOVE CLIENT UPDATE/INSERT/DELETE POLICIES ON JOB EXECUTION TABLES
-- These tables are managed ONLY by run-job-queue edge function (service_role)
-- ============================================================

-- 1) job_queue - remove all mutating policies, keep SELECT only
DROP POLICY IF EXISTS "workspace_access_update" ON public.job_queue;
DROP POLICY IF EXISTS "workspace_access_insert" ON public.job_queue;
DROP POLICY IF EXISTS "workspace_access_delete" ON public.job_queue;
-- 2) channel_outbox - remove all mutating policies, keep SELECT only
DROP POLICY IF EXISTS "workspace_access_update" ON public.channel_outbox;
DROP POLICY IF EXISTS "workspace_access_insert" ON public.channel_outbox;
DROP POLICY IF EXISTS "workspace_access_delete" ON public.channel_outbox;
-- 3) campaign_runs - already has no UPDATE policy, but explicitly ensure no INSERT/DELETE by clients
-- The deploy_campaign function uses SECURITY DEFINER to insert, so RLS doesn't block it
-- But verify there's no direct INSERT policy for clients
DROP POLICY IF EXISTS "campaign_runs_insert_workspace_scoped" ON public.campaign_runs;
DROP POLICY IF EXISTS "campaign_runs_delete_workspace_scoped" ON public.campaign_runs;
-- Add comments explaining the security model
COMMENT ON TABLE public.job_queue IS 
'Job queue for campaign execution. 
SECURITY: No client mutations allowed. SELECT only for workspace members.
MUTATIONS: Only via service_role (run-job-queue edge function) or SECURITY DEFINER functions.';
COMMENT ON TABLE public.channel_outbox IS 
'Outbound message records (email, voice, social).
SECURITY: No client mutations allowed. SELECT only for workspace members.
MUTATIONS: Only via service_role (run-job-queue edge function).';
COMMENT ON TABLE public.campaign_runs IS 
'Campaign execution runs.
SECURITY: SELECT only for workspace members. No direct client mutations.
INSERT: Only via deploy_campaign() SECURITY DEFINER function.
UPDATE: Only via update_campaign_run_status() which requires service_role.';
