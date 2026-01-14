# AI Features Fix - Quick Summary

## Problem
1. ❌ Onboarding assistant: Returns 500 (LOVABLE_API_KEY not configured)
2. ❌ AI Quick Actions: Authentication issues

## Root Cause
- Frontend passed anon key instead of user JWT
- Backend used Lovable API without auth validation

## Fix (3 changes, 2 files)

### File 1: `src/components/WelcomeModal.tsx`

**Line 15** - Add import:
```typescript
import { supabase } from "@/integrations/supabase/client";
```

**Lines 87-94** - Fix auth header:
```typescript
// BEFORE (WRONG):
Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`

// AFTER (CORRECT):
const { data: { session } } = await supabase.auth.getSession();
if (!session?.access_token) {
  throw new Error("Authentication required");
}
Authorization: `Bearer ${session.access_token}`
apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
```

### File 2: `supabase/functions/onboarding-assistant/index.ts`

**Lines 1-45** - Add auth validation:
```typescript
// Add import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Add auth check
const authHeader = req.headers.get("Authorization");
if (!authHeader) {
  return new Response(
    JSON.stringify({ error: "Missing Authorization header" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Verify user
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } }
});
const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
if (authError || !user) {
  return new Response(
    JSON.stringify({ error: "Invalid authentication" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

**Lines 42-56** - Switch to OpenAI:
```typescript
// BEFORE:
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
await fetch("<legacy-ai-gateway>/v1/chat/completions", {
  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
  body: JSON.stringify({ model: "google/gemini-2.5-flash", ... })
})

// AFTER:
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
await fetch("https://api.openai.com/v1/chat/completions", {
  headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
  body: JSON.stringify({ model: "gpt-4o-mini", ... })
})
```

## Deployed
```bash
✓ ai-chat (previous)
✓ onboarding-assistant (just now)
```

## Test
```powershell
.\test-ai-features.ps1 -Email "your@email.com" -Password "password"
```

Expected: Both endpoints return 200 with streaming responses.

## Status
✅ Fixed  
✅ Deployed  
⏳ Awaiting test confirmation
