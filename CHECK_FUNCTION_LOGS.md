# 🔍 Function Returning 503 - Check Logs

**Issue:** The `ai-chat` Edge Function is returning 503 Server Unavailable.

This means the function is crashing on startup or a critical environment variable is missing.

---

## ✅ To Diagnose - Check Supabase Logs:

### Step 1: Open Function Logs Dashboard
```
https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/functions/ai-chat/logs
```

### Step 2: Look For Startup Errors

Common errors that cause 503:
- `OPENAI_API_KEY is not set`
- `Module not found`
- `Cannot read property of undefined`
- Import errors from `_shared/llmRouter.ts`

---

## 🔧 Most Likely Cause: Missing OPENAI_API_KEY

### Check Environment Variables:

1. Go to: https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/settings/functions
2. Look for: `OPENAI_API_KEY`
3. If missing, add it:
   - Key: `OPENAI_API_KEY`
   - Value: `sk-...` (your OpenAI API key)

---

## 🧪 Quick Test - Deploy a Minimal Function

Let me create a test function to verify the system works:

```typescript
// Test function that should always work
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, apikey",
      },
    });
  }

  return new Response(
    JSON.stringify({ success: true, message: "Test function works!" }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
});
```

---

## 📋 What to Do Now:

**Option 1: Check Logs** (Fastest)
1. Open the Supabase dashboard logs link above
2. Look for the error message
3. Paste it here

**Option 2: Verify OPENAI_API_KEY** (Most Likely Fix)
1. Go to Function Settings
2. Add `OPENAI_API_KEY` if missing
3. Redeploy the function

**Option 3: Deploy Test Function** (If above doesn't work)
- I can create a minimal test function to verify the system

---

**Which option do you want to try first?**
