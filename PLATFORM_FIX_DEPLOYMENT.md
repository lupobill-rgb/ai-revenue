# Platform Fix Deployment Guide

## What This Fixes

This migration addresses the platform issues you're experiencing:

1. **Google OAuth not working** - Fixed RLS policies for `ai_settings_google` table
2. **Test email issues** - Fixed RLS policies for `ai_settings_email` table  
3. **General access issues** - Ensured all workspace owners are in `workspace_members` table
4. **RLS policy gaps** - Updated `user_has_workspace_access()` function to work correctly

## How to Deploy

### Step 1: Apply the Migration in Supabase (Lovable Cloud)

1. **Open Supabase Dashboard** → Database → SQL Editor
2. **Copy and paste the entire contents** of `supabase/migrations/20260107120000_fix_platform_issues.sql`
3. **Click "Run"**
4. **Check the output** - You should see:
   ```
   ========================================
   PLATFORM FIX MIGRATION COMPLETE
   ========================================
   Total workspaces: X
   Total workspace members: Y
   Orphaned workspace owners: 0
   ========================================
   ✓ All workspace owners are properly added to workspace_members
   ```

### Step 2: Verify the Fix

1. **Run the verification script** in SQL Editor:
   - Copy contents of `scripts/verify-platform-fixes.sql`
   - Click "Run"
   - **All tests should show "✓ PASSED"**

2. **Test Google OAuth:**
   - Go to Settings → Integrations
   - Try connecting Google/Gmail
   - Should work without errors

3. **Test sending test emails:**
   - Go to Campaign → Approve and Deploy
   - Try sending a test email
   - Should work without errors

### Step 3: Monitor for Issues

Check the Supabase logs for any RLS policy violations:
- Go to Logs → Postgres Logs
- Filter for "RLS" or "permission denied"
- If you see any, report them immediately

## What Was Changed

### Database Changes:
1. ✅ Added all workspace owners to `workspace_members` table
2. ✅ Fixed `user_has_workspace_access()` function to check both ownership and membership
3. ✅ Added RLS policies for `ai_settings_google` (OAuth)
4. ✅ Added RLS policies for `ai_settings_email` (test emails)
5. ✅ Fixed RLS policies for `profiles`, `workspaces`, `workspace_members`
6. ✅ Added performance indexes

### Key Features:
- **Backward compatible** - Works with existing `tenant_id` usage
- **No data loss** - Only adds missing records, doesn't delete anything
- **Self-diagnosing** - Outputs diagnostic information after running

## Troubleshooting

### If Google OAuth Still Doesn't Work:

1. **Check if user is authenticated:**
   ```sql
   SELECT auth.uid(); -- Should return your user ID
   ```

2. **Check if you can see your workspaces:**
   ```sql
   SELECT * FROM workspaces WHERE owner_id = auth.uid();
   ```

3. **Check if OAuth settings exist:**
   ```sql
   SELECT * FROM ai_settings_google 
   WHERE tenant_id = auth.uid() OR public.user_has_workspace_access(tenant_id);
   ```

### If Test Emails Still Don't Work:

1. **Check email settings:**
   ```sql
   SELECT * FROM ai_settings_email 
   WHERE tenant_id = auth.uid() OR public.user_has_workspace_access(tenant_id);
   ```

2. **Check if RESEND_API_KEY is set** in Supabase → Settings → Edge Functions → Secrets

3. **Check edge function logs** for `test-email` function

### If Nothing Works:

Run this emergency diagnostic:
```sql
-- Check your user and workspaces
SELECT 
  'Your User ID' as info,
  auth.uid() as value
UNION ALL
SELECT 
  'Your Workspaces',
  COUNT(*)::text
FROM workspaces
WHERE owner_id = auth.uid()
UNION ALL
SELECT 
  'Your Workspace Memberships',
  COUNT(*)::text
FROM workspace_members
WHERE user_id = auth.uid();
```

Then share the results so we can diagnose further.

## Rollback (If Needed)

If this migration causes more issues, you can rollback by:

1. **Delete the migration record:**
   ```sql
   DELETE FROM supabase_migrations.schema_migrations 
   WHERE version = '20260107120000';
   ```

2. **Revert the changes** (contact support for rollback script)

## Next Steps

After successful deployment:

1. ✅ Test all critical functionality
2. ✅ Monitor logs for 24 hours
3. ✅ If stable, proceed with any remaining migrations
4. ✅ Consider adding monitoring for RLS violations

## Contact

If you encounter any issues during deployment, please provide:
- Exact error messages
- SQL query results from verification script
- Supabase logs (last 100 lines)

