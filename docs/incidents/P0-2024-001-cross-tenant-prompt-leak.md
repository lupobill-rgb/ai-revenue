# P0 Incident Report: Cross-Tenant Prompt Contamination

**Incident ID:** P0-2024-001  
**Date Discovered:** 2024-12-09  
**Severity:** P0 (Critical)  
**Status:** RESOLVED  

---

## Executive Summary

A hardcoded tenant reference in the `analyze-leads` AI edge function caused cross-tenant branding contamination, where all tenants saw "PlayKout" branding in AI-generated outputs regardless of their actual business profile.

**Impact:** AI outputs displayed incorrect tenant branding. No actual customer data was leaked between tenants.

---

## What Happened

The `analyze-leads` edge function, which generates AI-powered sales insights for CRM leads, contained a hardcoded system prompt referencing "PlayKout" (a specific tenant). This caused:

1. All tenants saw "PlayKout, a pickleball marketing platform" in AI responses
2. AI recommendations were contextualized for the wrong business/industry
3. Perception of data leakage (though actual lead data remained isolated)

---

## Root Cause Analysis

| Factor | Details |
|--------|---------|
| **Primary Cause** | Hardcoded tenant name in AI system prompt |
| **Contributing Factor** | No dynamic business context fetch from `business_profiles` table |
| **NOT a factor** | RLS policies were correctly enforced; actual lead data was isolated |

### Original Code (Vulnerable)
```typescript
const systemPrompt = `You are the CMO for PlayKout, a pickleball marketing platform.
Analyze this leads list and suggest next actions...`;
```

### Why Data Wasn't Actually Leaked
- Frontend query filters by `.eq("workspace_id", workspaceId)`
- RLS policy enforces `user_has_workspace_access(workspace_id)`
- Edge function uses `SUPABASE_ANON_KEY` + user JWT (RLS enforced)
- Leads passed FROM client, not queried in edge function

---

## Fix Implemented

### 1. Dynamic Business Context (analyze-leads/index.ts)
```typescript
// Fetch tenant's business profile
const { data: profile } = await supabase
  .from("business_profiles")
  .select("business_name, industry, business_description")
  .eq("user_id", workspace.owner_id)
  .single();

const businessContext = profile?.business_name || "your business";
const industryContext = profile?.industry ? ` in the ${profile.industry} industry` : "";

// Dynamic system prompt
const systemPrompt = `You are a B2B sales optimization expert for ${businessContext}${industryContext}. 
Analyze lead data and provide actionable insights...`;
```

### 2. Hard Guards for Tenant Isolation
```typescript
// HARD GUARD: workspaceId is REQUIRED
if (!workspaceId) {
  return new Response(
    JSON.stringify({ error: "Missing workspaceId" }),
    { status: 400 }
  );
}

// Validate user has access to this workspace
const { data: workspaceAccess } = await supabase
  .from("workspaces")
  .select("id, owner_id")
  .eq("id", workspaceId)
  .single();

if (!workspaceAccess) {
  // Check workspace_members as fallback
  const { data: memberAccess } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!memberAccess) {
    console.warn(`User ${user.id} attempted unauthorized workspace access: ${workspaceId}`);
    return new Response(
      JSON.stringify({ error: "Workspace access denied" }),
      { status: 403 }
    );
  }
}
```

### 3. Authentication Enforcement
```typescript
// Require auth header
if (!authHeader) {
  return new Response(
    JSON.stringify({ error: "Authentication required" }),
    { status: 401 }
  );
}

// Validate JWT and get user (single source of truth)
const { data: { user }, error: userError } = await supabase.auth.getUser();
if (userError || !user) {
  return new Response(
    JSON.stringify({ error: "Invalid authentication" }),
    { status: 401 }
  );
}
```

---

## Verification Performed

| Check | Status | Evidence |
|-------|--------|----------|
| RLS enabled on `leads` table | ✅ | `relrowsecurity = true` |
| RLS policy uses workspace filter | ✅ | `user_has_workspace_access(workspace_id)` |
| No `USING(true)` policies | ✅ | All policies check workspace access |
| Edge function uses anon key (not service role) | ✅ | `createClient(SUPABASE_URL, SUPABASE_ANON_KEY, ...)` |
| Frontend filters by workspace_id | ✅ | `.eq("workspace_id", workspaceId)` in CRM.tsx |
| workspaceId required in edge function | ✅ | 400 error if missing |
| Workspace access validated against JWT | ✅ | 403 error if unauthorized |
| Dynamic business context from DB | ✅ | Fetches from `business_profiles` |

---

## Follow-Up Actions

### Immediate (Completed)
- [x] Remove hardcoded tenant reference
- [x] Add dynamic business profile fetch
- [x] Add workspaceId requirement guard
- [x] Add workspace access validation
- [x] Deploy updated edge function

### Short-Term (Within 1 Week)
- [ ] Audit ALL edge functions for hardcoded tenant references
- [ ] Add automated grep check in CI for "PlayKout", "pickleball", tenant-specific strings
- [ ] Review all AI prompts in `/agents/` directory for tenant leakage

### Long-Term (Ongoing)
- [ ] Establish rule: "No edge function may query without tenant filter"
- [ ] Add tenant isolation tests to CI pipeline
- [ ] Quarterly security audit of multi-tenant isolation

---

## Prevention Checklist for New Edge Functions

Before deploying any new edge function that handles tenant data:

1. **Authentication**: Require Authorization header, validate JWT
2. **Tenant ID**: Require workspaceId/tenantId in request body
3. **Access Validation**: Verify user has access to the workspace
4. **Query Filtering**: ALL queries must include `.eq("workspace_id", ...)` or `.eq("tenant_id", ...)`
5. **Dynamic Context**: Never hardcode tenant names, industries, or business details
6. **Logging**: Log unauthorized access attempts with user ID and attempted workspace
7. **Review**: Two-person review for any function touching tenant data

---

## Timeline

| Time | Event |
|------|-------|
| Unknown | Hardcoded prompt introduced during initial development |
| 2024-12-09 14:XX | Issue discovered during security review |
| 2024-12-09 14:XX | Temporary allowlist guard deployed |
| 2024-12-09 14:XX | Root cause identified (hardcoded prompt) |
| 2024-12-09 14:XX | Full fix deployed (dynamic context + guards) |
| 2024-12-09 14:XX | Verification completed |

---

## Appendix: Safe System Prompt Template

For any AI function that needs tenant context:

```typescript
// SAFE: Dynamic tenant context
const systemPrompt = `You are a ${role} for ${businessContext}${industryContext}.

Your task: ${taskDescription}

IMPORTANT: Only reference this specific business and its data.
Do not mention other businesses, competitors by name, or assume industry details not provided.
All insights must be specific to ${businessContext}.`;
```

---

**Report Prepared By:** Engineering Team  
**Reviewed By:** [Pending Security Review]  
**Classification:** Internal - Confidential
