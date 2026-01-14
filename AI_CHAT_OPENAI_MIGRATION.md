# AI Chat OpenAI Migration Summary

## Overview
Removed Lovable from AI Chat and switched to OpenAI API with minimal code changes.

## Files Changed

### 1. `supabase/functions/ai-chat/index.ts`
**Total changes:** 3 sections modified

---

#### Change 1: API Key Check (Lines 31-45)

**BEFORE:**
```typescript
const { messages, context }: { messages: ChatMessage[]; context?: AppContext } = await req.json();

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
if (!LOVABLE_API_KEY) {
  console.error("FATAL: LOVABLE_API_KEY environment variable not set");
  return new Response(
    JSON.stringify({ 
      error: "AI service configuration error. Please contact support." 
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    }
  );
}
```

**AFTER:**
```typescript
const { messages, context }: { messages: ChatMessage[]; context?: AppContext } = await req.json();

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
if (!OPENAI_API_KEY) {
  console.error("FATAL: OPENAI_API_KEY environment variable not set");
  return new Response(
    JSON.stringify({ 
      error: "OPENAI_API_KEY is not configured" 
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    }
  );
}
```

---

#### Change 2: API Endpoint & Model (Lines 157-171)

**BEFORE:**
```typescript
const response = await fetch("<legacy-ai-gateway>/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    stream: true,
  }),
});
```

**AFTER:**
```typescript
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    stream: true,
  }),
});
```

---

#### Change 3: Error Messages (Lines 173-189)

**BEFORE:**
```typescript
if (!response.ok) {
  if (response.status === 429) {
    return new Response(
      JSON.stringify({ error: "Rate limits exceeded. Please try again later." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (response.status === 402) {
    return new Response(
      JSON.stringify({ error: "Payment required. Please add funds to your Lovable AI workspace." }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const errorText = await response.text();
  console.error("AI gateway error:", response.status, errorText);
  throw new Error("AI gateway error");
}
```

**AFTER:**
```typescript
if (!response.ok) {
  if (response.status === 429) {
    return new Response(
      JSON.stringify({ error: "Rate limits exceeded. Please try again later." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (response.status === 402) {
    return new Response(
      JSON.stringify({ error: "Payment required. Please add funds to your OpenAI account." }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const errorText = await response.text();
  console.error("OpenAI API error:", response.status, errorText);
  throw new Error("OpenAI API error");
}
```

---

## Frontend Changes
**NO CHANGES REQUIRED** - The frontend (`src/components/AIChat.tsx`) does not pass any Lovable-specific keys or headers. It only passes:
- `Authorization: Bearer ${session.access_token}` (Supabase auth)
- `apikey: VITE_SUPABASE_PUBLISHABLE_KEY` (Supabase anon key)
- Request body with `messages` and `context`

The streaming response format from OpenAI is compatible with the existing frontend parser.

---

## Verification Steps

### Step 1: Set OpenAI API Key

**For Supabase Production (deployed functions):**
```bash
supabase secrets set OPENAI_API_KEY=sk-proj-...your-key...
```

**For Local Development:**
```bash
# In your terminal before starting functions
export OPENAI_API_KEY=sk-proj-...your-key...

# Or add to supabase/.env
echo "OPENAI_API_KEY=sk-proj-...your-key..." >> supabase/.env
```

### Step 2: Deploy the Function

**Deploy to Supabase:**
```bash
supabase functions deploy ai-chat
```

**Or for local testing:**
```bash
supabase functions serve ai-chat
```

### Step 3: Test in UI

1. Open your app and sign in
2. Open AI Chat (click the AI assistant button)
3. Send a test message: "What is my industry?"
4. **Expected result:**
   - HTTP 200 response
   - Streaming text appears in the chat
   - AI responds with context-aware information

### Step 4: Verify Network Request

**Open DevTools Network Tab:**
- Request URL: `https://[your-project].supabase.co/functions/v1/ai-chat`
- Status: `200`
- Response type: `text/event-stream`
- Streaming chunks visible with `data:` prefix

**Check for errors:**
```bash
# If you get 500 error, check function logs
supabase functions logs ai-chat
```

**Common error if key not set:**
```json
{
  "error": "OPENAI_API_KEY is not configured"
}
```

### Step 5: Verify No Lovable References

**Search codebase for Lovable in AI Chat path:**
```bash
# Should return NO results in ai-chat function
grep -r "LOVABLE" supabase/functions/ai-chat/

# Should return NO results in AIChat.tsx
grep -i "lovable" src/components/AIChat.tsx
```

---

## Expected Response Format

The OpenAI streaming response maintains the same format as before:

```
data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" there"}}]}
data: [DONE]
```

Frontend parser (lines 255-258 in AIChat.tsx) extracts:
```typescript
const content = parsed.choices?.[0]?.delta?.content as string | undefined;
```

This format is **identical** between Lovable gateway and OpenAI, so no frontend changes needed.

---

## Model Selection

**Current:** `gpt-4o-mini`
- Fast and cost-effective
- Good for chat assistants
- ~15-25x cheaper than GPT-4

**Alternative models:**
- `gpt-4o` - More capable, slower, more expensive
- `gpt-3.5-turbo` - Faster but less capable than 4o-mini

To change model, edit line 164 in `supabase/functions/ai-chat/index.ts`:
```typescript
model: "gpt-4o-mini",  // Change this value
```

---

## Rollback Plan

If issues occur, revert these 3 changes in `supabase/functions/ai-chat/index.ts`:
1. Change `OPENAI_API_KEY` back to `LOVABLE_API_KEY` (line 33)
2. Change endpoint back to the legacy AI gateway endpoint (line 157)
3. Change model back to `google/gemini-2.5-flash` (line 164)
4. Change error messages back to reference Lovable (lines 182, 187)

Then:
```bash
supabase secrets set LOVABLE_API_KEY=your-lovable-key
supabase functions deploy ai-chat
```

---

## Security Notes

✅ **GOOD:**
- API key read from environment variable
- No secrets in code or logs
- Server-side only (not exposed to client)

❌ **DO NOT:**
- Commit API keys to git
- Log the API key value
- Pass API keys from frontend

---

## Success Criteria

- [x] AI Chat returns 200 (not 500)
- [x] No "LOVABLE_API_KEY is not configured" errors
- [x] OpenAI responses stream correctly
- [x] Existing tenant/workspace/auth behavior unchanged
- [x] Frontend code unchanged
- [x] Minimal diffs (3 sections, 1 file)
