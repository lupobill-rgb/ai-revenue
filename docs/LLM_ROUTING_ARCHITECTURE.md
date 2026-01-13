# LLM Routing Architecture - LOCKED DECISION

**Date:** January 12, 2026  
**Status:** 🔒 ARCHITECTURAL DECISION - DO NOT CHANGE WITHOUT REVIEW  
**Reviewer Required:** Tech Lead + Product

---

## TL;DR - The Rule

**User-facing streaming AI MUST use direct OpenAI functions.**  
**Do NOT route through `llmRouter.ts` for these flows.**

---

## Approved Direct Paths (LOCKED)

These features use **direct OpenAI integration** and MUST NOT be refactored to use `llmRouter.ts`:

| Feature | Frontend Component | Backend Function | Reason |
|---------|-------------------|------------------|--------|
| **AI Chat Widget** | `AIChat.tsx` | `ai-chat-direct` | Real-time streaming UX |
| **AI Quick Actions** | `AIQuickActions.tsx` → `AIChat.tsx` | `ai-chat-direct` | Real-time streaming UX |
| **AI Walkthrough/Guide** | `AIWalkthrough.tsx` | `ai-walkthrough-direct` | Real-time streaming UX |

### Why Direct Integration?

**Root Cause:** `llmRouter.ts` imports Deno std/crypto modules that fail on Supabase Edge Functions:
```typescript
// This breaks on Supabase:
import { createHash } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";
```

**Result:** 503 BOOT_ERROR - function crashes on startup before handling any requests.

**Solution:** Direct OpenAI integration with no complex dependencies.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│           USER-FACING STREAMING AI (LOCKED)             │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Frontend Components:                                     │
│  ├─ AIChat.tsx                                           │
│  ├─ AIQuickActions.tsx                                   │
│  └─ AIWalkthrough.tsx                                    │
│                                                           │
│  ↓ (MUST use these functions)                            │
│                                                           │
│  Backend Functions (Direct OpenAI):                      │
│  ├─ ai-chat-direct                                       │
│  └─ ai-walkthrough-direct                                │
│                                                           │
│  ↓ (Direct API calls)                                    │
│                                                           │
│  OpenAI API:                                             │
│  └─ gpt-4o-mini (streaming)                             │
│                                                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│         BACKGROUND/ASYNC AI (Can use llmRouter)         │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Features:                                               │
│  ├─ Campaign content generation (async)                  │
│  ├─ Lead scoring (background)                            │
│  ├─ Email drafts (not real-time)                         │
│  └─ Batch processing                                     │
│                                                           │
│  ↓ (CAN use llmRouter if needed)                         │
│                                                           │
│  llmRouter.ts (if fixed):                                │
│  └─ Provider abstraction, fallbacks, etc.                │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## The Divergence (Intentional)

This is a **controlled architectural divergence**, not a hack:

### ✅ APPROVED Pattern (User-Facing)
```typescript
// Direct OpenAI - for real-time streaming UX
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
  body: JSON.stringify({ model: "gpt-4o-mini", stream: true, ... }),
});
return new Response(response.body, { 
  headers: { "Content-Type": "text/event-stream" } 
});
```

### ❌ FORBIDDEN Pattern (User-Facing)
```typescript
// Do NOT use llmRouter for streaming UX
import { runLLM } from "../_shared/llmRouter.ts";  // ❌ BREAKS
const out = await runLLM({ ... });
```

### ✅ ALLOWED Pattern (Background Jobs)
```typescript
// llmRouter OK for non-streaming, async work
import { runLLM } from "../_shared/llmRouter.ts";  // ✅ OK for background
const result = await runLLM({ stream: false, ... });
```

---

## Regression Prevention Rules

### ❌ FORBIDDEN Changes (Will Break Production)

1. **Do NOT** refactor AI Chat to use `llmRouter.ts`
2. **Do NOT** refactor AI Quick Actions to use `llmRouter.ts`
3. **Do NOT** refactor AI Walkthrough to use `llmRouter.ts`
4. **Do NOT** "consolidate" these to use shared routing
5. **Do NOT** "clean up" the direct OpenAI calls

### ✅ SAFE Changes

1. **DO** update OpenAI model versions (`gpt-4o-mini` → `gpt-4o`, etc.)
2. **DO** adjust temperature, max_tokens, etc.
3. **DO** improve system prompts
4. **DO** add error handling
5. **DO** add monitoring/logging

### ⚠️ REQUIRES REVIEW

1. Any changes to `llmRouter.ts` that affect streaming
2. New AI features that need real-time streaming
3. Migration to different LLM providers
4. Changing from direct integration to abstraction layer

---

## Smoke Test Enforcement

**Test:** `tests/smoke-ai-direct-routing.test.ts`

**Asserts:**
1. `AIChat.tsx` calls `ai-chat-direct`
2. `AIWalkthrough.tsx` calls `ai-walkthrough-direct`
3. No frontend imports `llmRouter` for these flows
4. Functions return `text/event-stream` (streaming enabled)

**When it runs:** Pre-commit, CI, pre-deployment

**If it fails:** Deployment BLOCKED - architectural regression detected

---

## Future: If llmRouter Must Be Fixed

If you NEED to reintroduce `llmRouter` for these paths (not recommended), follow this process:

### Step 1: Fix the Root Cause
```typescript
// Replace Deno std/crypto with Web Crypto API
const encoder = new TextEncoder();
const data = encoder.encode(input);
const hashBuffer = await crypto.subtle.digest('SHA-256', data);
const hashArray = Array.from(new Uint8Array(hashBuffer));
const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
```

### Step 2: Test in Isolation
- Deploy llmRouter to a test function
- Verify it doesn't return 503 BOOT_ERROR
- Test streaming works
- Load test with production traffic

### Step 3: Feature Flag Rollout
```typescript
const USE_LLM_ROUTER = Deno.env.get("ENABLE_LLM_ROUTER") === "true";

if (USE_LLM_ROUTER) {
  // Use llmRouter (new path)
} else {
  // Use direct OpenAI (stable path)
}
```

### Step 4: Gradual Migration
- 10% traffic → llmRouter
- Monitor for 48 hours
- 50% traffic → llmRouter
- Monitor for 48 hours
- 100% traffic → llmRouter
- Remove feature flag after 2 weeks stable

**DO NOT** skip these steps.

---

## Cost Impact

Using direct OpenAI (no routing) means:

**Pros:**
- ✅ Simple, reliable, fast
- ✅ No abstraction overhead
- ✅ Easy to debug
- ✅ Works on Supabase Edge Functions

**Cons:**
- ⚠️ Vendor lock-in (OpenAI only)
- ⚠️ No automatic failover to other providers
- ⚠️ No centralized rate limiting
- ⚠️ Duplicate code if we add more AI features

**Trade-off Decision:** For user-facing streaming AI, **reliability > abstraction**.

---

## Who Can Change This?

**Approval Required From:**
1. Tech Lead (architecture decision)
2. Product Lead (UX impact)
3. DevOps (deployment risk)

**Process:**
1. Open RFC (Request for Comments) issue
2. Provide detailed justification
3. Include rollback plan
4. Get written approval
5. Feature flag rollout (mandatory)

**Do NOT** "just fix it" because it "looks messy."

---

## Documentation Updated

When this architecture was established:
- **Date:** January 12, 2026
- **PR:** fix/context-gate-regression
- **Files Changed:**
  - `supabase/functions/ai-chat-direct/index.ts` (created)
  - `supabase/functions/ai-walkthrough-direct/index.ts` (created)
  - `src/components/AIChat.tsx` (updated to use direct)
  - `src/components/AIWalkthrough.tsx` (updated to use direct)
- **Tests Added:** `tests/smoke-ai-direct-routing.test.ts`
- **Smoke Tested:** ✅ All functions working in production

---

## Summary

**The Rule (Again):**

> User-facing streaming AI MUST use direct OpenAI functions.  
> Do NOT route through llmRouter.ts.  
> Any future refactor requires architectural review.

**If You're Here to "Clean Up":**

Stop. Read this document. Open an RFC. Get approval.

**If You're Adding New AI:**

Follow the pattern in `ai-chat-direct` and `ai-walkthrough-direct`.

**If llmRouter Looks Broken:**

It is (for Supabase). Don't try to fix it for streaming use cases. Use direct integration.

---

**Last Updated:** January 12, 2026  
**Status:** 🔒 LOCKED ARCHITECTURE  
**Review Required:** Before ANY changes to AI routing
