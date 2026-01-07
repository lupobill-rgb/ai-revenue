-- ============================================================================
-- DIAGNOSTIC SCRIPT - Test Email Issues
-- ============================================================================
-- Run this in Supabase SQL Editor to diagnose test email problems
-- ============================================================================

-- Test 1: Check if you have email settings configured
SELECT 
  'Test 1: Email Settings' as test,
  CASE 
    WHEN COUNT(*) > 0 THEN '✓ FOUND'
    ELSE '✗ NOT CONFIGURED'
  END as status,
  COUNT(*) as settings_count,
  MAX(from_address) as configured_email,
  MAX(sender_name) as configured_name
FROM ai_settings_email
WHERE tenant_id = auth.uid()
   OR tenant_id IN (
     SELECT id FROM workspaces WHERE owner_id = auth.uid()
     UNION
     SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
   );

-- Test 2: Check if you have any workspaces
SELECT 
  'Test 2: Your Workspaces' as test,
  id as workspace_id,
  name as workspace_name,
  CASE 
    WHEN owner_id = auth.uid() THEN 'Owner'
    ELSE 'Member'
  END as your_role
FROM workspaces
WHERE owner_id = auth.uid()
   OR id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
ORDER BY created_at DESC;

-- Test 3: Check if you have leads in CRM (needed for test emails)
SELECT 
  'Test 3: CRM Leads' as test,
  COUNT(*) as total_leads,
  COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as leads_with_email,
  STRING_AGG(DISTINCT email, ', ') as sample_emails
FROM (
  SELECT email 
  FROM leads 
  WHERE workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
    UNION
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
  AND email IS NOT NULL 
  AND email != ''
  LIMIT 5
) sample;

-- Test 4: Check if RESEND API key is configured (admin only - will show error if not admin)
SELECT 
  'Test 4: Resend API Status' as test,
  CASE 
    WHEN current_setting('app.settings.resend_configured', true) = 'true' THEN '✓ Configured'
    ELSE '⚠ Check with admin'
  END as status;

-- Test 5: Try to create email settings if missing
DO $$
DECLARE
  workspace_id_var uuid;
  settings_count integer;
BEGIN
  -- Get first workspace
  SELECT id INTO workspace_id_var
  FROM workspaces
  WHERE owner_id = auth.uid()
  LIMIT 1;
  
  IF workspace_id_var IS NULL THEN
    RAISE NOTICE 'Test 5: SKIPPED - No workspace found';
    RETURN;
  END IF;
  
  -- Check if settings exist
  SELECT COUNT(*) INTO settings_count
  FROM ai_settings_email
  WHERE tenant_id = workspace_id_var;
  
  IF settings_count = 0 THEN
    RAISE NOTICE 'Test 5: Email settings missing for workspace %', workspace_id_var;
    RAISE NOTICE 'Recommendation: Go to Settings → Integrations → Email and configure your sender address';
  ELSE
    RAISE NOTICE 'Test 5: ✓ Email settings exist for workspace %', workspace_id_var;
  END IF;
END $$;

-- Test 6: Check RLS policies on ai_settings_email
SELECT 
  'Test 6: RLS Policies on ai_settings_email' as test,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'ai_settings_email'
ORDER BY policyname;

-- Summary and Recommendations
SELECT 
  '========================================' as divider,
  'DIAGNOSTIC COMPLETE' as status,
  '========================================' as divider2;

-- Actionable next steps
SELECT 
  'NEXT STEPS:' as action,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM ai_settings_email WHERE tenant_id = auth.uid() OR public.user_has_workspace_access(tenant_id))
    THEN '1. Go to Settings → Integrations → Email'
    ELSE '1. Email settings configured ✓'
  END as step1,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM leads WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()) AND email IS NOT NULL)
    THEN '2. Add leads with email addresses to CRM'
    ELSE '2. CRM has leads ✓'
  END as step2,
  '3. Check Supabase Logs → Edge Functions → test-email' as step3,
  '4. Try sending test email again' as step4;

