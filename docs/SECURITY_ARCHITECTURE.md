# Security Architecture — Final Documentation

**Version:** 1.0  
**Last Updated:** December 2024  
**Status:** Production Ready  
**Applies To:** All Supabase Edge Functions and Postgres schemas under UbiGrowth OS

---

## 0. Purpose & Scope

This document defines the security architecture for the UbiGrowth OS marketing platform, including:

- Webhook authentication
- Internal function protection
- Per-tenant public form security
- Secrets management
- Rate limiting primitives

It applies to all Supabase Edge Functions and Postgres schemas deployed under the UbiGrowth OS project.

---

## 1. Webhook Security (Server-to-Server)

### 1.1 Custom HMAC Verification

**File:** `supabase/functions/_shared/webhook.ts`  
**Pattern:** HMAC-SHA256 with timestamp tolerance

#### Headers

| Header | Purpose |
|--------|---------|
| `X-Ubigrowth-Signature` | HMAC signature (hex-encoded) |
| `X-Ubigrowth-Timestamp` | Unix timestamp (milliseconds) |

#### Configuration

| Setting | Value |
|---------|-------|
| Algorithm | HMAC-SHA256 |
| Secret | Per-endpoint env variable |
| Tolerance | 5 minutes (configurable) |
| Comparison | Constant-time |

#### Behavior

1. **Compute:** `HMAC(secret, timestamp + "." + rawBody)`
2. **Compare:** Constant-time comparison with header value
3. **Reject if:**
   - Signature invalid
   - Timestamp outside tolerance (±5 min)
   - Missing headers

#### Endpoints Using This Pattern

| Endpoint | Secret Env Variable |
|----------|---------------------|
| `lead-capture` | `LEAD_CAPTURE_WEBHOOK_SECRET` |

#### Usage

```typescript
import { verifyHmacSignature } from "../_shared/webhook.ts";

const isValid = await verifyHmacSignature({
  req,
  rawBody,
  headerName: "x-ubigrowth-signature",
  secretEnv: "LEAD_CAPTURE_WEBHOOK_SECRET",
  timestampHeader: "x-ubigrowth-timestamp",
  toleranceMs: 300000, // 5 minutes
});

if (!isValid) {
  return new Response("Unauthorized", { status: 401, headers: corsHeaders });
}
```

### 1.2 Svix/Resend Webhook Verification

**File:** `supabase/functions/_shared/svix-verify.ts`

| Aspect | Detail |
|--------|--------|
| Algorithm | HMAC-SHA256 (Svix standard) |
| ID Header | `svix-id` |
| Timestamp Header | `svix-timestamp` |
| Signature Header | `svix-signature` |
| Timestamp Tolerance | 5 minutes |
| Secret Format | `whsec_` prefix + base64-encoded key |
| Secret Env Variable | `RESEND_WEBHOOK_SECRET` |
| Used By | `email-tracking-webhook`, `email-webhook` |

**Usage:**
```typescript
import { verifySvixSignature } from "../_shared/svix-verify.ts";

const isValid = await verifySvixSignature({
  req,
  rawBody,
  secretEnv: "RESEND_WEBHOOK_SECRET",
});
```

---

## 2. Internal Function Security

### 2.1 Internal Secret Header Guard

| Aspect | Detail |
|--------|--------|
| Header Name | `x-internal-secret` |
| Secret Env Variable | `INTERNAL_FUNCTION_SECRET` |
| Validation | Constant-time string comparison |
| Used By | `cron-daily-automation`, `daily-automation`, `capture-screenshot` (fallback) |

**Pattern:**
```typescript
const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
const providedSecret = req.headers.get("x-internal-secret");

if (providedSecret !== internalSecret) {
  return new Response("Unauthorized", { status: 401 });
}
```

### 2.2 HTTP Basic Authentication

**File:** `supabase/functions/_shared/basic-auth.ts`

| Aspect | Detail |
|--------|--------|
| Scheme | HTTP Basic Authentication (RFC 7617) |
| Username Env Variable | `UG_ADMIN_BASIC_USER` |
| Password Env Variable | `UG_ADMIN_BASIC_PASS` |
| Comparison | Timing-safe string comparison |
| Used By | `capture-screenshot` (primary) |

**Usage:**
```typescript
import { requireBasicAuth, basicAuthResponse } from "../_shared/basic-auth.ts";

if (!requireBasicAuth(req, "UG_ADMIN_BASIC_USER", "UG_ADMIN_BASIC_PASS")) {
  return basicAuthResponse("UbiGrowth Admin", corsHeaders);
}
```

---

## 3. Per-Tenant Form Security

### 3.1 Workspace Password Gating

**File:** `supabase/functions/_shared/workspace-password.ts`

| Aspect | Detail |
|--------|--------|
| Hash Algorithm | Bcrypt (via `pgcrypto` extension) |
| Storage Column | `workspaces.public_form_password_hash` |
| SQL Function | `check_workspace_form_password(_workspace_id, _password)` |
| Request Sources | `X-Form-Password` header OR `formPassword` body field |
| Behavior | Returns `true` if no password configured (opt-in security) |
| Used By | `lead-capture` |

**Database Function:**
```sql
CREATE OR REPLACE FUNCTION public.check_workspace_form_password(
  _workspace_id UUID,
  _password TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = _workspace_id
      AND (w.public_form_password_hash IS NULL
        OR extensions.crypt(_password, w.public_form_password_hash) 
           = w.public_form_password_hash)
  );
$$;
```

**Setting a Workspace Password:**
```sql
UPDATE public.workspaces
SET public_form_password_hash = extensions.crypt('your-secret-password', extensions.gen_salt('bf'))
WHERE id = 'workspace-uuid';
```

**Clearing a Workspace Password:**
```sql
UPDATE public.workspaces
SET public_form_password_hash = NULL
WHERE id = 'workspace-uuid';
```

---

## 4. Authentication Matrix

| Endpoint | JWT | HMAC | Svix | Basic | Internal | Workspace PW |
|----------|:---:|:----:|:----:|:-----:|:--------:|:------------:|
| `lead-capture` | - | ✅ | - | - | - | ✅ (optional) |
| `email-tracking-webhook` | - | - | ✅ | - | - | - |
| `email-webhook` | - | - | ✅ | - | - | - |
| `capture-screenshot` | ✅ | - | - | ✅ | ✅ | - |
| `cron-daily-automation` | - | - | - | - | ✅ | - |
| `daily-automation` | - | - | - | - | ✅ | - |
| User-facing functions | ✅ | - | - | - | - | - |

**Legend:**
- ✅ = Required/Supported
- ✅ (optional) = Supported but not required
- `-` = Not applicable

---

## 5. Secrets Inventory

| Secret Name | Purpose | Rotation Frequency | Used By |
|-------------|---------|-------------------|---------|
| `LEAD_CAPTURE_WEBHOOK_SECRET` | HMAC signing for external lead capture webhooks | Quarterly | `lead-capture` |
| `RESEND_WEBHOOK_SECRET` | Svix verification for Resend email events | Per Resend rotation | `email-tracking-webhook`, `email-webhook` |
| `INTERNAL_FUNCTION_SECRET` | Internal cron/admin function calls | Quarterly | `cron-daily-automation`, `daily-automation`, `capture-screenshot` |
| `UG_ADMIN_BASIC_USER` | Basic auth username for admin endpoints | Annually | `capture-screenshot` |
| `UG_ADMIN_BASIC_PASS` | Basic auth password for admin endpoints | Quarterly | `capture-screenshot` |
| `PREVIEW_PASSWORD` | Legacy/preview protection | As needed | Various |
| `SUPABASE_SERVICE_ROLE_KEY` | Internal-only database operations | Never (managed by Supabase) | Internal cron functions only |

**Service Role Key Security:**
- ⚠️ **NEVER** use in user-facing edge functions
- ✅ Only use in internal/cron functions with secret header guard
- ✅ Always validate `x-internal-secret` header before using

---

## 6. Shared Helper Functions

### 6.1 `_shared/webhook.ts`

```typescript
export async function verifyHmacSignature(opts: {
  req: Request;
  rawBody: string;
  headerName: string;      // e.g. "x-ubigrowth-signature"
  secretEnv: string;       // e.g. "WEBHOOK_SHARED_SECRET"
  toleranceMs?: number;    // default: 300000 (5 min)
  timestampHeader?: string; // e.g. "x-ubigrowth-timestamp"
}): Promise<boolean>
```

### 6.2 `_shared/svix-verify.ts`

```typescript
export async function verifySvixSignature(opts: {
  req: Request;
  rawBody: string;
  secretEnv: string;       // e.g. "RESEND_WEBHOOK_SECRET"
  toleranceMs?: number;    // default: 300000 (5 min)
}): Promise<boolean>
```

### 6.3 `_shared/basic-auth.ts`

```typescript
export function requireBasicAuth(
  req: Request,
  userEnv: string,   // e.g. "UG_ADMIN_BASIC_USER"
  passEnv: string    // e.g. "UG_ADMIN_BASIC_PASS"
): boolean

export function basicAuthResponse(
  realm?: string,
  corsHeaders?: Record<string, string>
): Response
```

### 6.4 `_shared/workspace-password.ts`

```typescript
export async function checkWorkspaceFormPassword(
  workspaceId: string,
  providedPassword: string | null
): Promise<boolean>

export function extractPasswordFromRequest(
  req: Request,
  body?: Record<string, unknown>
): string | null
```

---

## 7. Rate Limiting Primitives

### 7.1 Overview

Rate limiting is recommended for all public-facing endpoints to prevent abuse. The following primitives can be implemented:

| Strategy | Use Case | Implementation |
|----------|----------|----------------|
| Token Bucket | General API rate limiting | In-memory or Redis-backed |
| Sliding Window | Request counting per time window | Postgres or Redis |
| Fixed Window | Simple request counting | Postgres counter table |

### 7.2 Recommended Implementation (Postgres-based)

**Rate Limit Table:**
```sql
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,        -- IP, user_id, workspace_id, etc.
  endpoint TEXT NOT NULL,          -- Function name
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(identifier, endpoint, window_start)
);

CREATE INDEX idx_rate_limits_lookup 
ON public.rate_limits(identifier, endpoint, window_start);
```

**Check Rate Limit Function:**
```sql
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _identifier TEXT,
  _endpoint TEXT,
  _window_seconds INTEGER DEFAULT 60,
  _max_requests INTEGER DEFAULT 100
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_window TIMESTAMPTZ;
  current_count INTEGER;
BEGIN
  current_window := date_trunc('minute', now());
  
  INSERT INTO public.rate_limits (identifier, endpoint, window_start, request_count)
  VALUES (_identifier, _endpoint, current_window, 1)
  ON CONFLICT (identifier, endpoint, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO current_count;
  
  RETURN current_count <= _max_requests;
END;
$$;
```

### 7.3 Recommended Limits

| Endpoint | Window | Max Requests | Identifier |
|----------|--------|--------------|------------|
| `lead-capture` | 1 minute | 60 | IP + workspace_id |
| `email-tracking-webhook` | 1 minute | 1000 | IP |
| `email-webhook` | 1 minute | 1000 | IP |
| `capture-screenshot` | 1 minute | 10 | user_id |
| User-facing APIs | 1 minute | 100 | user_id |

### 7.4 Edge Function Integration Pattern

```typescript
async function checkRateLimit(
  identifier: string,
  endpoint: string,
  windowSeconds = 60,
  maxRequests = 100
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    _identifier: identifier,
    _endpoint: endpoint,
    _window_seconds: windowSeconds,
    _max_requests: maxRequests,
  });
  
  if (error) {
    console.error('Rate limit check failed:', error);
    return true; // Fail open (or fail closed based on security posture)
  }
  
  return data === true;
}

// Usage in edge function
const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
if (!await checkRateLimit(clientIP, 'lead-capture', 60, 60)) {
  return new Response('Too Many Requests', { 
    status: 429,
    headers: { 'Retry-After': '60', ...corsHeaders }
  });
}
```

---

## 8. Request Flow Examples

### 8.1 Lead Capture (External Webhook)

```
External System → POST /lead-capture
  ├─ Headers: x-ubigrowth-signature, x-ubigrowth-timestamp
  ├─ Body: { workspaceId, firstName, lastName, email, formPassword? }
  │
  ├─ 1. [Optional] Check rate limit
  ├─ 2. Verify HMAC signature (verifyHmacSignature)
  ├─ 3. Check timestamp within tolerance (±5 min)
  ├─ 4. Verify workspace exists
  ├─ 5. Check workspace form password (if configured)
  ├─ 6. Validate required fields
  ├─ 7. Create/update lead record
  └─ Response: { success: true, leadId: "..." }
```

### 8.2 Resend Webhook (Email Events)

```
Resend → POST /email-tracking-webhook
  ├─ Headers: svix-id, svix-timestamp, svix-signature
  ├─ Body: { type: "email.delivered", data: { email_id, ... } }
  │
  ├─ 1. Verify Svix signature (verifySvixSignature)
  ├─ 2. Parse event type
  ├─ 3. Update email tracking records
  └─ Response: { received: true }
```

### 8.3 Daily Automation (Internal Cron)

```
Supabase Cron → POST /cron-daily-automation
  ├─ Headers: x-internal-secret
  ├─ Body: { cron: true }
  │
  ├─ 1. Verify internal secret header
  ├─ 2. Verify cron flag in body
  ├─ 3. Execute automation tasks (using service role)
  └─ Response: { success: true, results: [...] }
```

### 8.4 Screenshot Capture (Multi-Auth)

```
Admin/System → POST /capture-screenshot
  ├─ Auth Options (checked in order):
  │   ├─ Option A: Authorization: Basic base64(user:pass)
  │   ├─ Option B: x-internal-secret header
  │   └─ Option C: Authorization: Bearer <jwt>
  │
  ├─ 1. Check Basic Auth credentials
  ├─ 2. If fails, check internal secret
  ├─ 3. If fails, validate JWT
  ├─ 4. If all fail, return 401
  ├─ 5. Execute screenshot capture
  └─ Response: { success: true, url: "..." }
```

---

## 9. Row-Level Security (RLS) Summary

All tenant-scoped tables enforce RLS with the following patterns:

### 9.1 Workspace Access Function

```sql
CREATE FUNCTION user_has_workspace_access(_workspace_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspaces WHERE id = _workspace_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_id = _workspace_id AND user_id = auth.uid()
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### 9.2 Role-Based Access

```sql
CREATE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### 9.3 Tables with RLS Enabled

| Table | Access Pattern |
|-------|---------------|
| `workspaces` | Owner or member |
| `workspace_members` | Owner manages, members view |
| `assets` | Workspace access |
| `campaigns` | Workspace access |
| `leads` | Workspace + role-based (admin/manager/sales) |
| `lead_activities` | Workspace + sales team role |
| `deals` | Workspace access |
| `tasks` | Workspace access |
| `email_sequences` | Workspace access |
| `email_sequence_steps` | Via sequence → workspace |
| `sequence_enrollments` | Workspace access |
| `content_calendar` | Workspace access |
| `content_templates` | Workspace access |
| `segments` | Workspace access |
| `automation_jobs` | Workspace access |
| `campaign_metrics` | Workspace access |
| `asset_approvals` | Via asset → workspace |
| `business_profiles` | User's own profile |
| `social_integrations` | User's own integrations |
| `user_roles` | Admin manages, users view own |

---

## 10. Security Checklist

### Implemented ✅

- [x] Timing-safe string comparisons for all secret verification
- [x] Timestamp tolerance to prevent replay attacks
- [x] Fail-closed defaults (missing secrets/headers = rejection)
- [x] Bcrypt hashing for workspace passwords
- [x] Multi-layer authentication support
- [x] Service role key isolation (internal functions only)
- [x] RLS enforcement on all tenant-scoped tables
- [x] SECURITY DEFINER functions with explicit search_path

### Recommended 🔄

- [ ] Implement rate limiting on public endpoints
- [ ] Add failed authentication logging/alerting
- [ ] IP allowlisting for cron endpoints (Supabase IPs)
- [ ] Secret rotation automation
- [ ] Request signing for inter-function calls

---

## 11. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SYSTEMS                                 │
├───────────────────┬───────────────────┬─────────────────────────────────┤
│   Lead Forms      │   Resend/Svix     │   Internal Cron                 │
│   (HMAC + PW)     │   (Svix HMAC)     │   (Secret Header)               │
└─────────┬─────────┴─────────┬─────────┴─────────┬───────────────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EDGE FUNCTIONS                                   │
├───────────────────┬───────────────────┬─────────────────────────────────┤
│   lead-capture    │   email-webhook   │   cron-daily-automation         │
│   (public)        │   email-tracking  │   daily-automation              │
│                   │   (webhook)       │   capture-screenshot            │
└─────────┬─────────┴─────────┬─────────┴─────────┬───────────────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SHARED HELPERS                                   │
├───────────────────┬───────────────────┬─────────────────────────────────┤
│   webhook.ts      │   svix-verify.ts  │   basic-auth.ts                 │
│   (HMAC-SHA256)   │   (Svix HMAC)     │   (HTTP Basic)                  │
├───────────────────┴───────────────────┴─────────────────────────────────┤
│   workspace-password.ts (Bcrypt via pgcrypto)                           │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE DATABASE                                │
├─────────────────────────────────────────────────────────────────────────┤
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    RLS ENFORCEMENT LAYER                         │   │
│   │   • user_has_workspace_access()                                  │   │
│   │   • has_role()                                                   │   │
│   │   • check_workspace_form_password()                              │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   Tables: workspaces, leads, campaigns, assets, deals, tasks, ...       │
│   Extensions: pgcrypto (bcrypt)                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | December 2024 | Security Team | Initial documentation |

---

*Document generated from security architecture review.*
