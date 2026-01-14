# 🔍 AI Quick Actions - Diagnostic Steps

**Created:** January 12, 2026  
**Purpose:** Identify exact failure class for "failed to fetch" error

---

## ✅ Changes Made - Diagnostic Logging Added

I've added detailed logging to help identify the exact failure:

1. **`src/components/AIChat.tsx`** - Logs request details, env vars, workspace ID
2. **`src/pages/Dashboard.tsx`** - Logs when Quick Action is triggered
3. **Request ID tracking** - Each request gets a unique ID for correlation

---

## 📋 Follow These Steps EXACTLY

### Step 1: Hard Refresh Browser
```
Press: Ctrl + Shift + R (Windows) or Cmd + Shift + R (Mac)
```

### Step 2: Open DevTools Console
```
Press: F12
Click: Console tab
```

### Step 3: Clear Console
```
Click the 🚫 (clear) button in console
```

### Step 4: Trigger AI Quick Action
```
1. Click "Generate Campaign Ideas" button
2. Wait for error to appear
```

### Step 5: Copy ALL Console Output

Look for these specific log entries:

#### A) Quick Action Trigger Log
```
[Dashboard] === AI QUICK ACTION TRIGGERED ===
```
**What to check:**
- Is `workspaceId` set or "NOT SET"?
- Does timestamp show?

#### B) AI Chat Diagnostic Start
```
[AIChat] === DIAGNOSTIC START ===
```
**What to check:**
- `workspaceId`: Is it null or a UUID?
- `envVarsDefined.supabaseUrl`: true or false?
- `envVarsDefined.apiKey`: true or false?
- `apiKeyPreview`: Does it show "eyJ..." or "undefined"?
- `chatUrl`: Does it show the full URL?

#### C) Error Details (if it fails)
```
[AIChat] === DIAGNOSTIC ERROR ===
```
**What to check:**
- `errorType`: What type of error?
- `errorMessage`: Exact error text
- `chatUrl`: Is the URL correct?
- `workspaceId`: Is it null?

### Step 6: Open DevTools Network Tab
```
1. Click: Network tab in DevTools
2. Filter: "ai-chat"
3. Look for the failing request
```

**For the failing request, record:**
- **URL:** (full path)
- **Status:** (0, 401, 403, 404, 500)
- **Type:** (fetch, xhr)
- **Response:**
  - Click the request
  - Click "Response" tab
  - Copy the response body

---

## 🎯 What to Look For - Quick Reference

### Failure Class A: `workspaceId` is null
**Console shows:**
```javascript
workspaceId: null  // or "NOT SET"
```
**Root cause:** Race condition - workspace not selected before Quick Action fires  
**Fix:** Add workspace guard

---

### Failure Class B: Env vars undefined
**Console shows:**
```javascript
envVarsDefined: { supabaseUrl: false, apiKey: false }
apiKeyPreview: "undefined..."
```
**Root cause:** `.env` file not loaded or dev server needs restart  
**Fix:** Restart dev server

---

### Failure Class C: CORS error
**Console shows:**
```javascript
errorType: "TypeError"
errorMessage: "Failed to fetch"
```
**Network shows:**
- Status: 0 or (failed)
- Type: "cors"
- Response: (empty)

**Root cause:** CORS preflight failing on Edge Function  
**Fix:** Add CORS headers to Edge Function

---

### Failure Class D: 401 Unauthorized
**Network shows:**
- Status: 401
- Response: `{"error": "Missing Authorization header"}` or similar

**Root cause:** Backend requires auth but frontend not sending it  
**Fix:** This should NOT happen - we disabled auth!

---

### Failure Class E: 404 Not Found
**Network shows:**
- Status: 404
- Response: `{"error": "Function not found"}`

**Root cause:** Edge Function not deployed or wrong path  
**Fix:** Redeploy Edge Function

---

### Failure Class F: 500 Internal Server Error
**Network shows:**
- Status: 500
- Response: `{"error": "..."}`

**Root cause:** Backend Edge Function crashed  
**Fix:** Check Supabase function logs

---

## 📝 What to Paste Here

After following the steps above, paste this information:

```
=== CONSOLE LOGS ===
[Paste the 3 log blocks from console here]

=== NETWORK TAB ===
Request URL: 
Status Code: 
Response Headers:
Response Body:

=== FAILURE CLASS ===
[Based on the guide above, which class A-F matches?]
```

---

## 🚀 Once You Paste the Logs

I will:
1. Identify the exact failure class (A-F)
2. Apply the minimal fix (no refactoring)
3. Add a smoke test to prevent regression
4. Verify it works

---

**Current Server:** http://localhost:8083/  
**Last Updated:** Just now (diagnostic logging added)

