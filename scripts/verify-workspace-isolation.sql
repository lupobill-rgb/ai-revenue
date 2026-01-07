-- Workspace Isolation Verification Script
-- Run this in Supabase SQL Editor to verify isolation is working

-- ============================================
-- 1. CHECK YOUR WORKSPACES
-- ============================================
SELECT 
  'Your Workspaces' AS check_type,
  id,
  name,
  slug,
  created_at
FROM workspaces 
WHERE owner_id = auth.uid()
ORDER BY created_at DESC;

-- Expected: At least 1 workspace (ideally 2+ for testing)

-- ============================================
-- 2. VERIFY WORKSPACE MEMBERSHIP
-- ============================================
SELECT 
  'Workspace Access' AS check_type,
  w.name AS workspace_name,
  wm.role,
  wm.created_at AS member_since
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id = auth.uid()
ORDER BY w.name;

-- Expected: You should be a member of all your workspaces

-- ============================================
-- 3. CHECK BUSINESS PROFILES (Master Prompt v3)
-- ============================================
SELECT 
  'Business Profiles' AS check_type,
  bp.workspace_id,
  w.name AS workspace_name,
  bp.company_name,
  bp.industry,
  bp.created_at
FROM business_profiles bp
JOIN workspaces w ON w.id = bp.workspace_id
WHERE w.owner_id = auth.uid()
ORDER BY w.name;

-- Expected: One profile per workspace (Master Prompt v3: workspace_id is UNIQUE)

-- ============================================
-- 4. CHECK LEADS PER WORKSPACE
-- ============================================
SELECT 
  'Leads by Workspace' AS check_type,
  w.name AS workspace_name,
  COUNT(l.id) AS lead_count,
  MIN(l.created_at) AS oldest_lead,
  MAX(l.created_at) AS newest_lead
FROM workspaces w
LEFT JOIN leads l ON l.workspace_id = w.id
WHERE w.owner_id = auth.uid()
GROUP BY w.id, w.name
ORDER BY w.name;

-- Expected: Each workspace has separate lead counts

-- ============================================
-- 5. VERIFY NO NULL WORKSPACE IDS (Critical!)
-- ============================================
SELECT 
  'Orphaned Records Check' AS check_type,
  'leads' AS table_name,
  COUNT(*) AS records_without_workspace
FROM leads 
WHERE workspace_id IS NULL;

-- Expected: 0 (all leads must have workspace_id)

-- ============================================
-- 6. CHECK CAMPAIGN TARGETING (Master Prompt v3)
-- ============================================
SELECT 
  'Campaign Targeting' AS check_type,
  c.id,
  c.campaign_name,
  c.workspace_id,
  w.name AS workspace_name,
  c.target_tags,
  c.target_segment_codes
FROM cmo_campaigns c
JOIN workspaces w ON w.id = c.workspace_id
WHERE w.owner_id = auth.uid()
ORDER BY c.created_at DESC
LIMIT 10;

-- Expected: Campaigns have target_tags and target_segment_codes arrays

-- ============================================
-- 7. CHECK CHANNEL OUTBOX ISOLATION
-- ============================================
SELECT 
  'Channel Outbox' AS check_type,
  w.name AS workspace_name,
  co.channel,
  COUNT(*) AS message_count,
  COUNT(*) FILTER (WHERE co.status = 'sent') AS sent_count,
  COUNT(*) FILTER (WHERE co.status = 'delivered') AS delivered_count
FROM channel_outbox co
JOIN workspaces w ON w.id = co.workspace_id
WHERE w.owner_id = auth.uid()
GROUP BY w.id, w.name, co.channel
ORDER BY w.name, co.channel;

-- Expected: Messages are workspace-isolated

-- ============================================
-- 8. VERIFY RLS POLICIES ARE ACTIVE
-- ============================================
SELECT 
  'RLS Status' AS check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'workspaces', 
    'workspace_members', 
    'business_profiles', 
    'leads', 
    'cmo_campaigns',
    'channel_outbox'
  )
ORDER BY tablename, policyname;

-- Expected: Multiple policies per table enforcing workspace access

-- ============================================
-- 9. TEST CROSS-WORKSPACE ISOLATION
-- ============================================
-- This query should ONLY show leads from workspaces you own/are member of
-- It should NOT show leads from other users' workspaces
SELECT 
  'Isolation Test' AS check_type,
  l.id AS lead_id,
  l.first_name,
  l.last_name,
  l.workspace_id,
  w.name AS workspace_name,
  w.owner_id,
  (w.owner_id = auth.uid()) AS you_own_this
FROM leads l
JOIN workspaces w ON w.id = l.workspace_id
WHERE l.id IN (
  SELECT id FROM leads ORDER BY created_at DESC LIMIT 100
)
ORDER BY l.created_at DESC;

-- Expected: All results have you_own_this = true OR you're a workspace member

-- ============================================
-- 10. MASTER PROMPT V3 VALIDATION
-- ============================================
-- Check that all Master Prompt v3 features are present

-- Target tags column exists
SELECT 
  'Master Prompt v3' AS check_type,
  'target_tags_exists' AS feature,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cmo_campaigns' 
      AND column_name = 'target_tags'
  ) AS implemented;

-- Target segment codes exist
SELECT 
  'Master Prompt v3' AS check_type,
  'target_segment_codes_exists' AS feature,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cmo_campaigns' 
      AND column_name = 'target_segment_codes'
  ) AS implemented;

-- Business profiles workspace_id is NOT NULL
SELECT 
  'Master Prompt v3' AS check_type,
  'business_profiles_workspace_id_not_null' AS feature,
  is_nullable = 'NO' AS implemented
FROM information_schema.columns 
WHERE table_name = 'business_profiles' 
  AND column_name = 'workspace_id';

-- Business profiles workspace_id is UNIQUE
SELECT 
  'Master Prompt v3' AS check_type,
  'business_profiles_workspace_id_unique' AS feature,
  EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'business_profiles' 
      AND indexdef ILIKE '%workspace_id%'
      AND indexdef ILIKE '%UNIQUE%'
  ) AS implemented;

-- ============================================
-- SUMMARY
-- ============================================
SELECT 
  '=== ISOLATION HEALTH SUMMARY ===' AS summary,
  (SELECT COUNT(*) FROM workspaces WHERE owner_id = auth.uid()) AS your_workspaces,
  (SELECT COUNT(*) FROM leads WHERE workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
  )) AS your_total_leads,
  (SELECT COUNT(*) FROM cmo_campaigns WHERE workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
  )) AS your_campaigns,
  (SELECT COUNT(*) FROM leads WHERE workspace_id IS NULL) AS orphaned_leads,
  (SELECT COUNT(*) FROM business_profiles WHERE workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
  )) AS business_profiles;

-- ✅ PASS CRITERIA:
-- - your_workspaces >= 1
-- - orphaned_leads = 0
-- - All RLS policies active
-- - Master Prompt v3 features implemented

