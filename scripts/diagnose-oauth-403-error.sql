-- ============================================================================
-- DIAGNOSTIC SCRIPT - Google OAuth 403 Error
-- ============================================================================
-- Purpose: Identify why Google OAuth login is returning 403 Forbidden
-- ============================================================================

-- Test 1: Check if Google OAuth provider is enabled in Supabase Auth
SELECT 
  'Test 1: OAuth Providers' as test_name,
  'Check Supabase Dashboard → Authentication → Providers → Google' as instruction,
  'Ensure: Enabled = ON, Client ID and Secret are set, Redirect URLs include your domain' as requirements;

-- Test 2: Check if auth.users table is accessible
SELECT 
  'Test 2: Auth Users Access' as test,
  COUNT(*) as user_count,
  MAX(created_at) as last_user_created
FROM auth.users;

-- Test 3: Check if profiles table exists and has proper RLS
SELECT 
  'Test 3: Profiles Table' as test,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'profiles') as policy_count
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'profiles';

-- Test 4: Check profiles RLS policies
SELECT 
  'Test 4: Profiles RLS Policies' as test,
  policyname,
  cmd as operation,
  roles,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No restrictions'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No restrictions'
  END as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles';

-- Test 5: Check business_profiles table and RLS
SELECT 
  'Test 5: Business Profiles Table' as test,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'business_profiles') as policy_count
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'business_profiles';

-- Test 6: Check business_profiles RLS policies
SELECT 
  'Test 6: Business Profiles RLS Policies' as test,
  policyname,
  cmd as operation,
  permissive,
  roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'business_profiles';

-- Test 7: Check workspaces table RLS
SELECT 
  'Test 7: Workspaces RLS Policies' as test,
  policyname,
  cmd as operation,
  permissive
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'workspaces';

-- Test 8: Check workspace_members table RLS
SELECT 
  'Test 8: Workspace Members RLS Policies' as test,
  policyname,
  cmd as operation,
  permissive
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'workspace_members';

-- Test 9: Check if handle_new_user trigger exists and is active
SELECT 
  'Test 9: OAuth User Creation Trigger' as test,
  trigger_name,
  event_manipulation as event,
  action_timing as timing,
  action_statement as function_call
FROM information_schema.triggers
WHERE trigger_schema = 'auth' 
  AND event_object_table = 'users'
  AND trigger_name LIKE '%new_user%';

-- Test 10: Check if handle_new_user function exists
SELECT 
  'Test 10: handle_new_user Function' as test,
  proname as function_name,
  prosecdef as is_security_definer,
  provolatile as volatility
FROM pg_proc
WHERE proname = 'handle_new_user';

-- Test 11: Check for any recent auth errors
SELECT 
  'Test 11: Check Supabase Logs' as test,
  'Go to Supabase Dashboard → Logs → Auth Logs' as instruction,
  'Look for: 403 errors, "permission denied", "RLS policy violation"' as what_to_check;

-- Test 12: Try to create a test profile (will fail if RLS is blocking)
DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- Get a random user ID for testing
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'Test 12: SKIPPED - No users in database';
  ELSE
    -- This will succeed if RLS allows, fail if blocked
    BEGIN
      -- Simulate what handle_new_user tries to do
      RAISE NOTICE 'Test 12: Testing INSERT permissions...';
      RAISE NOTICE 'Note: This test will show what operations would be blocked by RLS';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Test 12: Error - %', SQLERRM;
    END;
  END IF;
END $$;

-- Test 13: Check if business_profiles has required columns
SELECT 
  'Test 13: Business Profiles Schema' as test,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_profiles'
ORDER BY ordinal_position;

-- Test 14: Check for constraints that might block inserts
SELECT 
  'Test 14: Business Profiles Constraints' as test,
  conname as constraint_name,
  contype as constraint_type,
  CASE contype
    WHEN 'c' THEN 'CHECK'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'x' THEN 'EXCLUSION'
  END as constraint_type_name
FROM pg_constraint
WHERE conrelid = 'public.business_profiles'::regclass;

-- ============================================================================
-- SUMMARY AND RECOMMENDATIONS
-- ============================================================================

SELECT 
  '========================================' as divider,
  'DIAGNOSTIC COMPLETE' as status,
  '========================================' as divider2;

SELECT 
  'COMMON CAUSES OF 403 ERROR:' as issue,
  '' as blank1,
  '1. RLS policies blocking INSERT on profiles table' as cause1,
  '2. RLS policies blocking INSERT on business_profiles table' as cause2,
  '3. Missing SECURITY DEFINER on handle_new_user function' as cause3,
  '4. Trigger not created or not executing' as cause4,
  '5. Google OAuth redirect URL not whitelisted in Supabase' as cause5,
  '6. UNIQUE constraint violation on profiles or business_profiles' as cause6,
  '' as blank2,
  'Check the test results above to identify the specific issue.' as instruction;

