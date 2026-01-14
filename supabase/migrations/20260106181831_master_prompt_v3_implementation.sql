-- Master Prompt v3 Implementation
-- Database schema changes for workspace isolation, campaign targeting, and channel expansion

-- ============================================================================
-- 1️⃣ BUSINESS PROFILES — WORKSPACE CONSTRAINTS + RLS
-- ============================================================================

-- Add NOT NULL constraint to workspace_id if not already present
ALTER TABLE public.business_profiles 
ALTER COLUMN workspace_id SET NOT NULL;
-- Add UNIQUE constraint on workspace_id (one profile per workspace)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'business_profiles_workspace_id_key'
  ) THEN
    ALTER TABLE public.business_profiles 
    ADD CONSTRAINT business_profiles_workspace_id_key UNIQUE (workspace_id);
  END IF;
END $$;
-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view business profiles" ON public.business_profiles;
DROP POLICY IF EXISTS "Users can create business profiles" ON public.business_profiles;
DROP POLICY IF EXISTS "Users can update business profiles" ON public.business_profiles;
-- RLS: Users can SELECT profiles from workspaces they have access to
CREATE POLICY "workspace_members_can_read_profiles" ON public.business_profiles
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );
-- RLS: Users can INSERT profiles for workspaces they own or are members of
CREATE POLICY "workspace_members_can_create_profiles" ON public.business_profiles
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );
-- RLS: Users can UPDATE profiles for workspaces they have access to
CREATE POLICY "workspace_members_can_update_profiles" ON public.business_profiles
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );
-- ============================================================================
-- 6️⃣ CAMPAIGN TARGETING — TAGS + SEGMENTS
-- ============================================================================

-- Add target_tags column to cmo_campaigns if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cmo_campaigns' AND column_name = 'target_tags'
  ) THEN
    ALTER TABLE public.cmo_campaigns ADD COLUMN target_tags TEXT[];
  END IF;
END $$;
-- Add index for target_tags array queries (GIN index for array overlap operations)
CREATE INDEX IF NOT EXISTS idx_cmo_campaigns_target_tags 
ON public.cmo_campaigns USING GIN (target_tags);
-- Add comment explaining the column
COMMENT ON COLUMN public.cmo_campaigns.target_tags IS 
'Array of lead tags to target. Campaign execution filters leads where lead.tags && campaign.target_tags';
-- Ensure target_segment_codes exists (should already exist, but verify)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cmo_campaigns' AND column_name = 'target_segment_codes'
  ) THEN
    ALTER TABLE public.cmo_campaigns ADD COLUMN target_segment_codes TEXT[];
  END IF;
END $$;
-- Add index for target_segment_codes
CREATE INDEX IF NOT EXISTS idx_cmo_campaigns_target_segment_codes 
ON public.cmo_campaigns USING GIN (target_segment_codes);
-- ============================================================================
-- 3️⃣ CRM LEADS — WORKSPACE MEMBER ACCESS
-- ============================================================================

-- Verify leads table has proper RLS for workspace members
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can create leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
-- RLS: Workspace members can SELECT leads
CREATE POLICY "workspace_members_can_read_leads" ON public.leads
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );
-- RLS: Workspace members can INSERT leads
CREATE POLICY "workspace_members_can_create_leads" ON public.leads
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );
-- RLS: Workspace members can UPDATE leads
CREATE POLICY "workspace_members_can_update_leads" ON public.leads
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );
-- RLS: Workspace members can DELETE leads
CREATE POLICY "workspace_members_can_delete_leads" ON public.leads
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );
-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Ensure leads table has proper indexes for sorting and filtering
CREATE INDEX IF NOT EXISTS idx_leads_workspace_created_at 
ON public.leads(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_score 
ON public.leads(workspace_id, score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_status 
ON public.leads(workspace_id, status);
-- Index for tag filtering (GIN index for array operations)
CREATE INDEX IF NOT EXISTS idx_leads_tags 
ON public.leads USING GIN (tags);
-- Index for segment filtering
CREATE INDEX IF NOT EXISTS idx_leads_segment_code 
ON public.leads(segment_code) WHERE segment_code IS NOT NULL;
-- ============================================================================
-- VALIDATION
-- ============================================================================

-- Verify all critical constraints are in place
DO $$
DECLARE
  constraint_count INTEGER;
BEGIN
  -- Check business_profiles workspace_id is NOT NULL
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.columns
  WHERE table_name = 'business_profiles' 
    AND column_name = 'workspace_id' 
    AND is_nullable = 'NO';
  
  IF constraint_count = 0 THEN
    RAISE EXCEPTION 'business_profiles.workspace_id NOT NULL constraint failed';
  END IF;
  
  -- Check target_tags column exists
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.columns
  WHERE table_name = 'cmo_campaigns' AND column_name = 'target_tags';
  
  IF constraint_count = 0 THEN
    RAISE EXCEPTION 'cmo_campaigns.target_tags column missing';
  END IF;
  
  RAISE NOTICE 'Master Prompt v3 migration validation: PASSED';
END $$;
