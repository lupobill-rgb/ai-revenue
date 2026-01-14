-- ============================================================
-- DROP UPDATE POLICY ON campaign_runs TO ENFORCE SINGLE WRITER
-- ============================================================

-- Drop the UPDATE policy - no one should update via client
DROP POLICY IF EXISTS campaign_runs_update_workspace_scoped ON public.campaign_runs;
-- Verify: Only INSERT, SELECT, DELETE policies should remain
-- UPDATE is handled ONLY via update_campaign_run_status() SECURITY DEFINER function;
