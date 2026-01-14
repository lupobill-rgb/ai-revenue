-- ============================================================================
-- PLATFORM FIXES - Address OAuth, Email, and Access Issues
-- ============================================================================
-- Note: This migration simplified to essential fixes only
-- Date: January 7, 2026
-- ============================================================================

-- 1. Ensure workspace owners are in workspace_members table
INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at)
SELECT 
  w.id as workspace_id,
  w.owner_id as user_id,
  'owner' as role,
  COALESCE(w.created_at, NOW()) as created_at
FROM public.workspaces w
WHERE w.owner_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm 
    WHERE wm.workspace_id = w.id AND wm.user_id = w.owner_id
  );
-- Note: Additional RLS policy fixes and indexes skipped as many reference tables don't exist
-- in current database (ai_settings_google, social_integrations, etc.)
-- Apply those manually when tables are present.;
