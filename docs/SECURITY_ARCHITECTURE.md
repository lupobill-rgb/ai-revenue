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
**Pattern:** Svix (HMAC-SHA256, base64)

#### Headers

| Header | Purpose |
|--------|---------|
| `svix-id` | Unique message identifier |
| `svix-timestamp` | Unix timestamp (seconds) |
| `svix-signature` | Base64 HMAC signature(s) |

#### Configuration

| Setting | Value |
|---------|-------|
| Algorithm | HMAC-SHA256 (Svix standard) |
| Secret Format | `whsec_*` (base64-encoded) |
| Secret Env | `RESEND_WEBHOOK_SECRET` |
| Tolerance | 5 minutes |

#### Behavior

1. **Delegate:** Svix verification algorithm
2. **Reject:** On any verification failure

#### Endpoints Using This Pattern

| Endpoint | Purpose |
|----------|---------|
| `email-tracking-webhook` | Email delivery/open/click events |
| `email-webhook` | General email events |

#### Usage

```typescript
import { verifySvixSignature } from "../_shared/svix-verify.ts";

const isValid = await verifySvixSignature({
  req,
  rawBody,
  secretEnv: "RESEND_WEBHOOK_SECRET",
});

if (!isValid) {
  return new Response("Unauthorized", { status: 401, headers: corsHeaders });
}
```

---

## 2. Internal Function Security

### 2.1 Internal Secret Header

**Pattern:** Shared secret in `x-internal-secret` header

#### Configuration

| Setting | Value |
|---------|-------|
| Header | `x-internal-secret` |
| Secret Env | `INTERNAL_FUNCTION_SECRET` |
| Response on Failure | 403 Forbidden |

#### Behavior

```typescript
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET');
const internalSecret = req.headers.get('x-internal-secret');

if (!internalSecret || internalSecret !== INTERNAL_SECRET) {
  return new Response(JSON.stringify({ error: 'Forbidden' }), { 
    status: 403, 
    headers: corsHeaders 
  });
}
```

#### Endpoints Using (Service-Role Allowed)

| Endpoint | Notes |
|----------|-------|
| `cron-daily-automation` | Called by pg_cron |
| `daily-automation` | Called by pg_cron |
| `capture-screenshot` | Fallback to Basic Auth |

> ⚠️ **Security Note:** These endpoints are NOT callable from browser clients. Only trusted backend systems or `pg_cron` may invoke them.

### 2.2 HTTP Basic Auth

**File:** `supabase/functions/_shared/basic-auth.ts`  
**Pattern:** RFC 7617 HTTP Basic Auth

#### Credentials

| Setting | Env Variable |
|---------|--------------|
| Username | `UG_ADMIN_BASIC_USER` |
| Password | `UG_ADMIN_BASIC_PASS` |

#### Use Cases

- Internal/admin tools
- Staging / low-volume sensitive endpoints

#### Endpoints Using

| Endpoint | Auth Priority |
|----------|---------------|
| `capture-screenshot` | Primary (internal secret and JWT accepted as fallback) |

#### Usage

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

#### Database Schema

```sql
ALTER TABLE public.workspaces
ADD COLUMN public_form_password_hash text;
```

#### Database Function

```sql
CREATE OR REPLACE FUNCTION public.check_workspace_form_password(
  _workspace_id uuid,
  _password text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT public_form_password_hash
  INTO stored_hash
  FROM public.workspaces
  WHERE id = _workspace_id;

  -- If no password set → public form allowed
  IF stored_hash IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Compare using pgcrypto's crypt() (bcrypt)
  RETURN stored_hash = crypt(_password, stored_hash);
END;
$$;
```

#### Endpoints Using

| Endpoint | When Called |
|----------|-------------|
| `lead-capture` | After HMAC verification, before inserting a lead |

#### Behavior

1. **Verify HMAC** (server-to-server authenticity)
2. **Validate workspace** exists and is active
3. **If `public_form_password_hash` is set:**
   - Extract password from request (`X-Form-Password` header or `formPassword` body)
   - Call `check_workspace_form_password`
4. **Reject** with 401/403 on any failure

#### Setting a Workspace Password

```sql
UPDATE public.workspaces
SET public_form_password_hash = crypt('your-secret-password', gen_salt('bf'))
WHERE id = 'workspace-uuid';
```

#### Clearing a Workspace Password

```sql
UPDATE public.workspaces
SET public_form_password_hash = NULL
WHERE id = 'workspace-uuid';
```

---

## 4. Authentication Matrix

| Endpoint | JWT | HMAC | Svix | Basic Auth | Internal Secret | Workspace PW |
|----------|:---:|:----:|:----:|:----------:|:---------------:|:------------:|
| `lead-capture` | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `email-tracking-webhook` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `email-webhook` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `cron-daily-automation` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `daily-automation` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `capture-screenshot` | ✅* | ❌ | ❌ | ✅ | ✅ | ❌ |
| All other app functions | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

> *`capture-screenshot` accepts **any one of:** JWT, Basic Auth, or Internal Secret.

---

## 5. Secrets Inventory

| Secret Name | Purpose | Used By |
|-------------|---------|---------|
| `LEAD_CAPTURE_WEBHOOK_SECRET` | HMAC signing for lead capture | `lead-capture` |
| `RESEND_WEBHOOK_SECRET` | Svix verification for Resend webhooks | `email-*-webhook` |
| `INTERNAL_FUNCTION_SECRET` | Internal function authorization | cron + internal functions |
| `UG_ADMIN_BASIC_USER` | HTTP Basic username | `capture-screenshot` |
| `UG_ADMIN_BASIC_PASS` | HTTP Basic password | `capture-screenshot` |
| `PREVIEW_PASSWORD` | Optional preview protection for surfaces | Any preview endpoint |

---

## 6. Shared Security Helpers

| File | Exports | Purpose |
|------|---------|---------|
| `_shared/webhook.ts` | `verifyHmacSignature()` | Custom HMAC verification (UbiGrowth headers) |
| `_shared/svix-verify.ts` | `verifySvixSignature()` | Resend/Svix webhook verification |
| `_shared/basic-auth.ts` | `requireBasicAuth()`, `basicAuthResponse()` | HTTP Basic authentication |
| `_shared/workspace-password.ts` | `checkWorkspaceFormPassword()`, `extractPasswordFromRequest()` | Per-tenant form password gating |

---

## 7. Request Flows (Examples)

### 7.1 Lead Capture (External → Supabase)

1. External system computes `HMAC-SHA256(timestamp + "." + rawBody)` with `LEAD_CAPTURE_WEBHOOK_SECRET`
2. Sends headers:
   - `X-Ubigrowth-Signature`
   - `X-Ubigrowth-Timestamp`
3. `lead-capture` verifies HMAC and timestamp tolerance
4. Validates workspace and (if present) workspace form password
5. Inserts/updates `leads` row with correct `workspace_id`
6. Optionally enqueues follow-up automation

### 7.2 Resend Webhook (Resend → Supabase)

1. Resend sends headers:
   - `svix-id`
   - `svix-timestamp`
   - `svix-signature`
2. Edge function verifies Svix signature with `RESEND_WEBHOOK_SECRET`
3. On success:
   - Updates email status, events, and/or `lead_activities`
   - May update `campaign_metrics`

### 7.3 Daily Automation (Cron → Internal)

1. `pg_cron` triggers `cron-daily-automation` using `pg_net.http_post`
2. `cron-daily-automation` validates `x-internal-secret` (or cron flag)
3. Fetches all active workspaces
4. For each workspace:
   - Calls `daily-automation` with header `x-internal-secret` set
5. `daily-automation` performs:
   - Content publishing
   - Campaign optimization
   - Lead sequence processing
   - Metrics sync
6. Logs to `automation_jobs`

---

## 8. Security Considerations (Implemented)

- **Timing-safe comparisons** for signatures
- **Timestamp tolerance** on all signed requests (anti-replay)
- **Fail-closed behavior:** missing auth = denied
- **Bcrypt hashing** for workspace form passwords (`pgcrypto.crypt`)
- **Clear separation:**
  - Public/webhook endpoints
  - User-facing JWT endpoints
  - Internal service-role endpoints

---

## 9. Rate Limiting Design (To Add)

> **Goal:** Prevent abuse and cost blowups while staying multi-tenant and simple (Postgres-only, no Redis).

### 9.1 Rate Limit Table

**Migration:**

```sql
CREATE TABLE public.rate_limit_counters (
  id           bigserial PRIMARY KEY,
  scope        text        NOT NULL,  -- 'workspace', 'user', 'ip'
  key          text        NOT NULL,  -- e.g., workspace_id::text, user_id::text, ip
  endpoint     text        NOT NULL,  -- 'lead-capture', 'generate-video', etc.
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX rate_limit_unique_window_idx
  ON public.rate_limit_counters(scope, key, endpoint, window_start);

CREATE INDEX rate_limit_gc_idx
  ON public.rate_limit_counters(window_start);
```

> ⚠️ **Note:** RLS is NOT enabled on this table. This is internal metering, accessed only by Edge Functions via service-role or guarded anon+JWT.

### 9.2 Rate Limit Function (Atomic Check + Increment)

**Migration:**

```sql
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  _scope          text,
  _key            text,
  _endpoint       text,
  _window_seconds integer,
  _max_count      integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now          timestamptz := now();
  v_window_start timestamptz;
  v_new_count    integer;
BEGIN
  -- Align window_start to the floor of window_seconds
  v_window_start :=
    to_timestamp(floor(extract(epoch FROM v_now) / _window_seconds) * _window_seconds);

  -- Upsert counter in a single statement
  INSERT INTO public.rate_limit_counters (scope, key, endpoint, window_start, count)
  VALUES (_scope, _key, _endpoint, v_window_start, 1)
  ON CONFLICT (scope, key, endpoint, window_start)
  DO UPDATE SET count = public.rate_limit_counters.count + 1
  RETURNING count INTO v_new_count;

  RETURN v_new_count <= _max_count;
END;
$$;
```

**This provides a general primitive:**

- Windowed counter (per scope + key + endpoint)
- Atomic increment
- Boolean "allowed / blocked" response

### 9.3 Example: Rate Limit `lead-capture` (Public Endpoint)

**Policy:**

| Scope | Limit | Window |
|-------|-------|--------|
| Per workspace | 60 requests | 60 seconds |
| Per workspace | 2,000 requests | 1 day |

**Edge Function Snippet** (`supabase/functions/lead-capture/index.ts`):

At the top, after HMAC + workspace validation:

```typescript
// After verifying HMAC and resolving workspaceId
const workspaceKey = workspaceId; // uuid string

// 1. Per-minute limit
const { data: allowedMinute, error: rlErrMinute } = await supabase
  .rpc('check_and_increment_rate_limit', {
    _scope: 'workspace',
    _key: workspaceKey,
    _endpoint: 'lead-capture',
    _window_seconds: 60,
    _max_count: 60,
  });

if (rlErrMinute) {
  console.error('Rate limit RPC error (minute):', rlErrMinute);
  return new Response(JSON.stringify({ error: 'Rate limit error' }), {
    status: 500,
    headers: corsHeaders,
  });
}

if (!allowedMinute) {
  return new Response(JSON.stringify({ error: 'Too many requests (minute limit)' }), {
    status: 429,
    headers: corsHeaders,
  });
}

// 2. Per-day limit
const { data: allowedDay, error: rlErrDay } = await supabase
  .rpc('check_and_increment_rate_limit', {
    _scope: 'workspace',
    _key: workspaceKey,
    _endpoint: 'lead-capture-daily',
    _window_seconds: 86400,
    _max_count: 2000,
  });

if (rlErrDay) {
  console.error('Rate limit RPC error (day):', rlErrDay);
  return new Response(JSON.stringify({ error: 'Rate limit error' }), {
    status: 500,
    headers: corsHeaders,
  });
}

if (!allowedDay) {
  return new Response(JSON.stringify({ error: 'Too many requests (daily limit)' }), {
    status: 429,
    headers: corsHeaders,
  });
}

// If both checks pass → proceed to insert lead
```

> **Tip:** You can adjust limits per plan (Starter, Growth, Enterprise) by:
> 1. Fetching workspace configuration (`workspace.settings`)
> 2. Passing plan-specific `_max_count` values into the RPC

### 9.4 Example: Rate Limit Costly User Functions (e.g., `generate-video`)

**Policy:**

| Scope | Limit | Window |
|-------|-------|--------|
| Per workspace | 10 video generations | 1 hour |
| Per user | 5 video generations | 1 hour |

**In `generate-video` function:**

```typescript
// After auth.getUser() and workspace resolution
const userId = user.id;
const workspaceKey = workspaceId;

// Per-workspace hourly limit
const { data: allowedWorkspace, error: rlWsErr } = await supabase
  .rpc('check_and_increment_rate_limit', {
    _scope: 'workspace',
    _key: workspaceKey,
    _endpoint: 'generate-video',
    _window_seconds: 3600,
    _max_count: 10,
  });

if (rlWsErr || !allowedWorkspace) {
  return new Response(JSON.stringify({ error: 'Workspace video limit reached' }), {
    status: 429,
    headers: corsHeaders,
  });
}

// Per-user hourly limit
const { data: allowedUser, error: rlUserErr } = await supabase
  .rpc('check_and_increment_rate_limit', {
    _scope: 'user',
    _key: userId,
    _endpoint: 'generate-video',
    _window_seconds: 3600,
    _max_count: 5,
  });

if (rlUserErr || !allowedUser) {
  return new Response(JSON.stringify({ error: 'User video limit reached' }), {
    status: 429,
    headers: corsHeaders,
  });
}

// Proceed with video generation
```

### 9.5 Operational Notes

#### Garbage Collection (GC)

Use `rate_limit_gc_idx` + a scheduled job to delete old rows (keep last 30–90 days):

```sql
DELETE FROM public.rate_limit_counters
WHERE window_start < now() - interval '90 days';
```

#### Per-Plan Limits

Store limits in `workspaces.settings` JSON:

```json
{
  "limits": {
    "lead_capture_per_minute": 60,
    "lead_capture_per_day": 2000,
    "video_per_hour": 10
  }
}
```

Read these values inside the Edge Function instead of hardcoding.

#### Abuse Detection

Log 429 responses to `automation_jobs` or a separate `security_events` table if you want an audit trail for abuse.

---

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | December 2024 | Security Team | Initial documentation |

---

*Document generated from security architecture review.*
