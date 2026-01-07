# Google OAuth Login - Debug Guide

## Current Status
✅ OAuth completes successfully  
✅ User is redirected from Google back to your app  
❌ Landing on home page (`/`) instead of dashboard

---

## Quick Debug Steps

### 1. Check Browser Console During OAuth
1. Open your site in **incognito/private window**
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Click "Sign in with Google"
5. Complete Google OAuth
6. **Watch for these console messages:**

```
[AuthCallback] Auth state changed: SIGNED_IN
[AuthCallback] Handling sign-in for user: [user-id]
[AuthCallback] Checking for profile (attempt 1/5)...
[AuthCallback] Profile found, redirecting to dashboard
```

OR

```
[AuthCallback] No profile found after retries, redirecting to onboarding
```

### 2. Check Where You End Up
After OAuth completes, check the URL:
- ❌ If at: `https://cmo.ubigrowth.ai/` (home page) → **Session timing issue**
- ✅ If at: `https://cmo.ubigrowth.ai/dashboard` → **Success!**
- ⚠️ If at: `https://cmo.ubigrowth.ai/onboarding` → **Profile missing, needs creation**

### 3. Check Application Tab
1. In Developer Tools, go to **Application** tab
2. Go to **Local Storage** → `https://cmo.ubigrowth.ai`
3. Look for keys starting with `sb-` (Supabase session)
4. Should see: `sb-[project-ref]-auth-token`
5. **Is there a session token?**
   - ✅ Yes → Session created successfully
   - ❌ No → OAuth didn't create session

---

## What You're Seeing vs What Should Happen

### Current Behavior:
```
1. Click "Sign in with Google"
2. Approve on Google
3. Redirect to: /auth/callback
4. ???
5. End up on: / (home page)
```

### Expected Behavior:
```
1. Click "Sign in with Google"
2. Approve on Google
3. Redirect to: /auth/callback
4. AuthCallback checks for profile
5. Redirect to: /dashboard (if profile exists) OR /onboarding (if not)
```

---

## Most Likely Issues

### Issue 1: Race Condition
- AuthCallback navigates to `/dashboard`
- But something redirects back to `/` before navigation completes
- **Solution:** Add delay or session verification

### Issue 2: Profile Not Found
- AuthCallback can't find `business_profiles` record
- Falls back to `/onboarding`
- But onboarding redirects somewhere else
- **Solution:** Check if profile was created

### Issue 3: Session Not Persisting
- Google OAuth creates session
- But session isn't saved to localStorage
- Home page doesn't see session, so no redirect
- **Solution:** Check Supabase session persistence

---

## Manual Verification Queries

Run these in **Supabase SQL Editor** to check if OAuth created your data:

### Check if your user exists:
```sql
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email = '[YOUR_EMAIL]'
ORDER BY created_at DESC
LIMIT 1;
```

### Check if workspace was created:
```sql
-- Replace [USER_ID] with ID from above
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  w.created_at
FROM workspaces w
WHERE w.owner_id = '[USER_ID]'
ORDER BY w.created_at DESC;
```

### Check if profile was created:
```sql
-- Replace [USER_ID] with your user ID
SELECT 
  bp.id,
  bp.business_name,
  bp.workspace_id,
  bp.created_at
FROM business_profiles bp
WHERE bp.user_id = '[USER_ID]'
ORDER BY bp.created_at DESC;
```

### Check if workspace member was added:
```sql
-- Replace [USER_ID] with your user ID
SELECT 
  wm.workspace_id,
  wm.role,
  wm.joined_at,
  w.name as workspace_name
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id = '[USER_ID]'
ORDER BY wm.joined_at DESC;
```

---

## Quick Fixes to Try

### Fix 1: Clear Browser Data and Retry
1. Clear all cookies/localStorage for `cmo.ubigrowth.ai`
2. Try OAuth again in incognito
3. Check console logs

### Fix 2: Try Direct Dashboard URL
After OAuth, if you land on home page:
1. Manually go to: `https://cmo.ubigrowth.ai/dashboard`
2. **Does it load?**
   - ✅ Yes → Session exists, just redirect issue
   - ❌ No → Session not created or profile missing

### Fix 3: Check If You Need to Apply Migrations
Have you applied these 3 migrations in Supabase?
- [ ] `20260107120000_fix_platform_issues.sql`
- [ ] `20260107130000_fix_oauth_user_profiles.sql`
- [ ] `20260107130001_emergency_oauth_fix.sql`

If not, **apply them NOW** - they're critical for OAuth to work.

---

## What to Share With Me

If still not working, please provide:

1. **Console logs** - Copy/paste all `[AuthCallback]` messages
2. **Current URL** - Where do you end up?
3. **Application tab** - Do you see session tokens in localStorage?
4. **SQL query results** - Run the verification queries above
5. **Any errors** - Red errors in console or network tab

---

## Expected Console Output (Success)

```
[AuthCallback] Auth state changed: SIGNED_IN
[AuthCallback] Handling sign-in for user: abc-123-def
[AuthCallback] User email: john@example.com
[AuthCallback] User name: John Doe
[AuthCallback] Checking for profile (attempt 1/5)...
[AuthCallback] Profile found, redirecting to dashboard
```

Then URL should change to: `https://cmo.ubigrowth.ai/dashboard`

---

## Next Steps

1. **Try OAuth again** with console open
2. **Copy the console logs** and send to me
3. **Check the URL** you end up at
4. **Try manually going to `/dashboard`** after OAuth

This will tell us exactly where the process is failing!

