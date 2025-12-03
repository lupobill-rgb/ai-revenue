# Security Architecture Readout

**Last Updated:** December 2024  
**Status:** Production Ready

---

## 1. Webhook Security

### Custom HMAC Verification (`_shared/webhook.ts`)

| Aspect | Detail |
|--------|--------|
| Algorithm | HMAC-SHA256 |
| Headers | `x-ubigrowth-signature`, `x-ubigrowth-timestamp` |
| Timestamp Tolerance | 5 minutes (configurable) |
| Secret Env | `LEAD_CAPTURE_WEBHOOK_SECRET` |
| Used By | `lead-capture` |

### Svix/Resend Webhook Verification (`_shared/svix-verify.ts`)

| Aspect | Detail |
|--------|--------|
| Algorithm | HMAC-SHA256 (Svix standard) |
| Headers | `svix-id`, `svix-timestamp`, `svix-signature` |
| Timestamp Tolerance | 5 minutes |
| Secret Format | `whsec_*` base64-encoded |
| Secret Env | `RESEND_WEBHOOK_SECRET` |
| Used By | `email-tracking-webhook`, `email-webhook` |

---

## 2. Internal Function Security

### Internal Secret Header Guard

| Aspect | Detail |
|--------|--------|
| Header | `x-internal-secret` |
| Secret Env | `INTERNAL_FUNCTION_SECRET` |
| Used By | `cron-daily-automation`, `daily-automation`, `capture-screenshot` (fallback) |

### HTTP Basic Auth (`_shared/basic-auth.ts`)

| Aspect | Detail |
|--------|--------|
| Scheme | HTTP Basic Authentication |
| Username Env | `UG_ADMIN_BASIC_USER` |
| Password Env | `UG_ADMIN_BASIC_PASS` |
| Used By | `capture-screenshot` (primary) |

---

## 3. Per-Tenant Form Security

### Workspace Password Gating (`_shared/workspace-password.ts`)

| Aspect | Detail |
|--------|--------|
| Hash Algorithm | Bcrypt (via `pgcrypto`) |
| Storage | `workspaces.public_form_password_hash` |
| SQL Function | `check_workspace_form_password(_password, _workspace_id)` |
| Request Sources | `X-Form-Password` header or `formPassword` body field |
| Used By | `lead-capture` |

---

## 4. Authentication Matrix

| Endpoint | JWT | HMAC | Svix | Basic | Internal | Workspace PW |
|----------|-----|------|------|-------|----------|--------------|
| `lead-capture` | - | ✅ | - | - | - | ✅ (optional) |
| `email-tracking-webhook` | - | - | ✅ | - | - | - |
| `email-webhook` | - | - | ✅ | - | - | - |
| `capture-screenshot` | ✅ | - | - | ✅ | ✅ | - |
| `cron-daily-automation` | - | - | - | - | ✅ | - |
| `daily-automation` | - | - | - | - | ✅ | - |
| User-facing functions | ✅ | - | - | - | - | - |

---

## 5. Secrets Inventory

| Secret Name | Purpose | Used By |
|-------------|---------|---------|
| `LEAD_CAPTURE_WEBHOOK_SECRET` | HMAC signing for lead capture | `lead-capture` |
| `RESEND_WEBHOOK_SECRET` | Svix verification for Resend | `email-tracking-webhook`, `email-webhook` |
| `INTERNAL_FUNCTION_SECRET` | Internal cron/admin calls | `cron-daily-automation`, `daily-automation`, `capture-screenshot` |
| `UG_ADMIN_BASIC_USER` | Basic auth username | `capture-screenshot` |
| `UG_ADMIN_BASIC_PASS` | Basic auth password | `capture-screenshot` |
| `PREVIEW_PASSWORD` | Legacy/preview protection | Various |

---

## 6. Shared Helpers

### `_shared/webhook.ts`

```typescript
export async function verifyHmacSignature(opts: {
  req: Request;
  rawBody: string;
  headerName: string;      // e.g. "x-ubigrowth-signature"
  secretEnv: string;       // e.g. "WEBHOOK_SHARED_SECRET"
  toleranceMs?: number;    // optional timestamp tolerance
  timestampHeader?: string; // e.g. "x-ubigrowth-timestamp"
}): Promise<boolean>
```

### `_shared/svix-verify.ts`

```typescript
export async function verifySvixSignature(opts: {
  req: Request;
  rawBody: string;
  secretEnv: string;       // e.g. "RESEND_WEBHOOK_SECRET"
  toleranceMs?: number;    // default 300000 (5 min)
}): Promise<boolean>
```

### `_shared/basic-auth.ts`

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

### `_shared/workspace-password.ts`

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

## 7. Request Flow Examples

### Lead Capture (External Webhook)

```
External System → POST /lead-capture
  ├─ Headers: x-ubigrowth-signature, x-ubigrowth-timestamp
  ├─ Body: { workspaceId, firstName, lastName, email, formPassword? }
  │
  ├─ 1. Verify HMAC signature (verifyHmacSignature)
  ├─ 2. Check timestamp within tolerance
  ├─ 3. Verify workspace exists
  ├─ 4. Check workspace form password (if configured)
  ├─ 5. Create/update lead record
  └─ Response: { success, leadId }
```

### Resend Webhook (Email Events)

```
Resend → POST /email-tracking-webhook
  ├─ Headers: svix-id, svix-timestamp, svix-signature
  ├─ Body: { type, data: { email_id, ... } }
  │
  ├─ 1. Verify Svix signature (verifySvixSignature)
  ├─ 2. Parse event type
  ├─ 3. Update email tracking records
  └─ Response: { received: true }
```

### Daily Automation (Internal Cron)

```
Supabase Cron → POST /cron-daily-automation
  ├─ Headers: x-internal-secret
  ├─ Body: { cron: true }
  │
  ├─ 1. Verify internal secret header
  ├─ 2. Verify cron flag in body
  ├─ 3. Execute automation tasks
  └─ Response: { success, results }
```

---

## 8. Security Considerations

### Implemented

- ✅ **Timing-safe comparisons** - All signature verifications use constant-time comparison
- ✅ **Timestamp tolerance** - Prevents replay attacks with 5-minute windows
- ✅ **Fail-closed defaults** - Missing secrets/headers result in rejection
- ✅ **Bcrypt hashing** - Workspace passwords use industry-standard hashing
- ✅ **Multi-layer auth** - Some endpoints support multiple auth methods

### Recommendations

- 🔄 **Secret Rotation** - Implement periodic rotation for `INTERNAL_FUNCTION_SECRET`
- 📊 **Monitoring** - Add logging/alerting for failed authentication attempts
- 🚦 **Rate Limiting** - Consider adding rate limits to public endpoints
- 🌐 **IP Allowlisting** - For cron endpoints, consider restricting to Supabase IPs

---

## 9. Database Security Functions

### `check_workspace_form_password`

```sql
CREATE OR REPLACE FUNCTION public.check_workspace_form_password(
  _password TEXT,
  _workspace_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT public_form_password_hash INTO stored_hash
  FROM public.workspaces
  WHERE id = _workspace_id;
  
  IF stored_hash IS NULL THEN
    RETURN TRUE; -- No password configured
  END IF;
  
  RETURN stored_hash = crypt(_password, stored_hash);
END;
$$;
```

### Setting a Workspace Password

```sql
UPDATE public.workspaces
SET public_form_password_hash = crypt('your-secret-password', gen_salt('bf'))
WHERE id = 'workspace-uuid';
```

---

## 10. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SYSTEMS                             │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  Lead Forms     │  Resend/Svix    │  Internal Cron              │
│  (HMAC + PW)    │  (Svix HMAC)    │  (Secret Header)            │
└────────┬────────┴────────┬────────┴────────┬────────────────────┘
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTIONS                                │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  lead-capture   │  email-webhook  │  cron-daily-automation      │
│  email-tracking │                 │  daily-automation           │
│                 │                 │  capture-screenshot         │
└────────┬────────┴────────┬────────┴────────┬────────────────────┘
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SHARED HELPERS                                │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  webhook.ts     │  svix-verify.ts │  basic-auth.ts              │
│  (HMAC-SHA256)  │  (Svix HMAC)    │  (HTTP Basic)               │
├─────────────────┴─────────────────┴─────────────────────────────┤
│  workspace-password.ts (Bcrypt via pgcrypto)                    │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                             │
├─────────────────────────────────────────────────────────────────┤
│  workspaces.public_form_password_hash                           │
│  check_workspace_form_password() SQL function                   │
│  RLS policies on all tenant-scoped tables                       │
└─────────────────────────────────────────────────────────────────┘
```

---

*Document generated from security audit review.*
