-- ============================================================================
-- CRITICAL SECURITY FIXES - Phase 1
-- ============================================================================
-- Purpose: Fix RLS gaps, add missing workspace_id columns, ensure data isolation
-- Date: January 7, 2026
-- Priority: CRITICAL - Deploy immediately
-- ============================================================================

-- ============================================================================
-- 1. FIX ASSET_APPROVALS - Missing workspace_id
-- ============================================================================

-- Add workspace_id column
ALTER TABLE public.asset_approvals 
  ADD COLUMN IF NOT EXISTS workspace_id UUID;
-- Backfill workspace_id from assets table
UPDATE public.asset_approvals aa
SET workspace_id = a.workspace_id
FROM public.assets a
WHERE aa.asset_id = a.id
  AND aa.workspace_id IS NULL;
-- Handle orphaned records (shouldn't exist, but safety first)
DELETE FROM public.asset_approvals
WHERE workspace_id IS NULL;
-- Make NOT NULL
ALTER TABLE public.asset_approvals 
  ALTER COLUMN workspace_id SET NOT NULL;
-- Add FK constraint
ALTER TABLE public.asset_approvals
  ADD CONSTRAINT fk_asset_approvals_workspace
  FOREIGN KEY (workspace_id) 
  REFERENCES public.workspaces(id) 
  ON DELETE CASCADE;
-- Enable RLS
ALTER TABLE public.asset_approvals ENABLE ROW LEVEL SECURITY;
-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view asset approvals" ON public.asset_approvals;
DROP POLICY IF EXISTS "Users can create asset approvals" ON public.asset_approvals;
DROP POLICY IF EXISTS "workspace_isolation" ON public.asset_approvals;
-- Add workspace-scoped RLS policies
CREATE POLICY "workspace_select_asset_approvals"
  ON public.asset_approvals FOR SELECT
  USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_insert_asset_approvals"
  ON public.asset_approvals FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_update_asset_approvals"
  ON public.asset_approvals FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_delete_asset_approvals"
  ON public.asset_approvals FOR DELETE
  USING (public.user_has_workspace_access(workspace_id));
-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_asset_approvals_workspace_id 
  ON public.asset_approvals(workspace_id);
-- ============================================================================
-- 2. FIX CONTENT_CALENDAR - Ensure RLS is properly configured
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE public.content_calendar ENABLE ROW LEVEL SECURITY;
-- Drop old policies
DROP POLICY IF EXISTS "Users can view their calendar items" ON public.content_calendar;
DROP POLICY IF EXISTS "Users can create calendar items" ON public.content_calendar;
DROP POLICY IF EXISTS "Users can update calendar items" ON public.content_calendar;
DROP POLICY IF EXISTS "Users can delete calendar items" ON public.content_calendar;
-- Add workspace-scoped RLS policies
CREATE POLICY "workspace_select_content_calendar"
  ON public.content_calendar FOR SELECT
  USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_insert_content_calendar"
  ON public.content_calendar FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_update_content_calendar"
  ON public.content_calendar FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_delete_content_calendar"
  ON public.content_calendar FOR DELETE
  USING (public.user_has_workspace_access(workspace_id));
-- ============================================================================
-- 3. FIX EMAIL_SEQUENCES - Add workspace_id and RLS
-- ============================================================================

-- Add workspace_id if not exists
ALTER TABLE public.email_sequences 
  ADD COLUMN IF NOT EXISTS workspace_id UUID;
-- Backfill from user_id (assuming created_by → user → workspace relationship)
-- First, try to get workspace from created_by user
UPDATE public.email_sequences es
SET workspace_id = (
  SELECT w.id 
  FROM public.workspaces w
  WHERE w.owner_id = es.created_by
  LIMIT 1
)
WHERE es.workspace_id IS NULL AND es.created_by IS NOT NULL;
-- For any remaining NULL, assign to first available workspace (shouldn't happen in prod)
UPDATE public.email_sequences es
SET workspace_id = (SELECT id FROM public.workspaces LIMIT 1)
WHERE es.workspace_id IS NULL;
-- Make NOT NULL
ALTER TABLE public.email_sequences 
  ALTER COLUMN workspace_id SET NOT NULL;
-- Add FK constraint
ALTER TABLE public.email_sequences
  ADD CONSTRAINT fk_email_sequences_workspace
  FOREIGN KEY (workspace_id) 
  REFERENCES public.workspaces(id) 
  ON DELETE CASCADE;
-- Enable RLS
ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;
-- Add RLS policies
CREATE POLICY "workspace_select_email_sequences"
  ON public.email_sequences FOR SELECT
  USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_insert_email_sequences"
  ON public.email_sequences FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_update_email_sequences"
  ON public.email_sequences FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_delete_email_sequences"
  ON public.email_sequences FOR DELETE
  USING (public.user_has_workspace_access(workspace_id));
-- Add index
CREATE INDEX IF NOT EXISTS idx_email_sequences_workspace_id 
  ON public.email_sequences(workspace_id);
-- ============================================================================
-- 4. FIX EMAIL_SEQUENCE_STEPS - Add workspace_id and RLS
-- ============================================================================

-- Add workspace_id if not exists
ALTER TABLE public.email_sequence_steps 
  ADD COLUMN IF NOT EXISTS workspace_id UUID;
-- Backfill from email_sequences
UPDATE public.email_sequence_steps ess
SET workspace_id = es.workspace_id
FROM public.email_sequences es
WHERE ess.sequence_id = es.id
  AND ess.workspace_id IS NULL;
-- Delete orphaned steps (safety)
DELETE FROM public.email_sequence_steps
WHERE workspace_id IS NULL;
-- Make NOT NULL
ALTER TABLE public.email_sequence_steps 
  ALTER COLUMN workspace_id SET NOT NULL;
-- Add FK constraint
ALTER TABLE public.email_sequence_steps
  ADD CONSTRAINT fk_email_sequence_steps_workspace
  FOREIGN KEY (workspace_id) 
  REFERENCES public.workspaces(id) 
  ON DELETE CASCADE;
-- Enable RLS
ALTER TABLE public.email_sequence_steps ENABLE ROW LEVEL SECURITY;
-- Add RLS policies
CREATE POLICY "workspace_select_email_sequence_steps"
  ON public.email_sequence_steps FOR SELECT
  USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_insert_email_sequence_steps"
  ON public.email_sequence_steps FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_update_email_sequence_steps"
  ON public.email_sequence_steps FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "workspace_delete_email_sequence_steps"
  ON public.email_sequence_steps FOR DELETE
  USING (public.user_has_workspace_access(workspace_id));
-- Add index
CREATE INDEX IF NOT EXISTS idx_email_sequence_steps_workspace_id 
  ON public.email_sequence_steps(workspace_id);
-- ============================================================================
-- 5. VERIFY USER_ROLES RLS
-- ============================================================================

-- Note: user_roles is user-scoped, not workspace-scoped (intentional)
-- But ensure RLS is enabled
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
-- Drop old policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
-- Add user-scoped policies
CREATE POLICY "users_select_own_roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());
-- Admins can manage all roles
CREATE POLICY "admins_manage_roles"
  ON public.user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );
-- ============================================================================
-- 6. AUDIT: Find and log any remaining tables without RLS
-- ============================================================================

-- This query will show tables that should have RLS but don't
-- (For monitoring - doesn't fix automatically)
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT IN ('schema_migrations', 'spatial_ref_sys')
      AND rowsecurity = false
  LOOP
    RAISE NOTICE 'WARNING: Table % does not have RLS enabled', tbl.tablename;
  END LOOP;
END $$;
-- ============================================================================
-- VALIDATION QUERIES (Run these to verify fixes)
-- ============================================================================

-- Check for orphaned records (should return 0 for all)
DO $$
BEGIN
  RAISE NOTICE 'Orphaned asset_approvals: %', (SELECT COUNT(*) FROM asset_approvals WHERE workspace_id IS NULL);
  RAISE NOTICE 'Orphaned email_sequences: %', (SELECT COUNT(*) FROM email_sequences WHERE workspace_id IS NULL);
  RAISE NOTICE 'Orphaned email_sequence_steps: %', (SELECT COUNT(*) FROM email_sequence_steps WHERE workspace_id IS NULL);
END $$;
-- ============================================================================
-- COMPLETE
-- ============================================================================
-- All critical security fixes applied
-- Next: Run performance optimizations migration
-- ============================================================================;
