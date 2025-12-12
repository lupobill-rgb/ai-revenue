# RLS + Tenant Guardrail Checklist

> Version: revenue_os_v1  
> Last Updated: 2024-12-12

## Overview

This checklist ensures **strict tenant isolation** across all Revenue OS tables. Every item is **non-negotiable for production**.

---

## Core Rules

### Rule 1: Every Table Has `tenant_id`

| Status | Table | Has `tenant_id` | Column Type | NOT NULL |
|--------|-------|-----------------|-------------|----------|
| ✅ | `tenants` | N/A (is tenant table) | N/A | N/A |
| ✅ | `accounts` | Yes | UUID | Yes |
| ✅ | `spine_contacts` | Yes | UUID | Yes |
| ✅ | `opportunities` | Yes | UUID | Yes |
| ✅ | `spine_campaigns` | Yes | UUID | Yes |
| ✅ | `spine_campaign_channels` | Yes | UUID | Yes |
| ✅ | `events_raw` | Yes | UUID | Yes |
| ✅ | `revenue_events` | Yes | UUID | Yes |
| ✅ | `spine_crm_activities` | Yes | UUID | Yes |
| ✅ | `metric_snapshots_daily` | Yes | UUID | Yes |
| ✅ | `optimization_cycles` | Yes | UUID | Yes |
| ✅ | `optimization_actions` | Yes | UUID | Yes |
| ✅ | `optimization_action_results` | Yes | UUID | Yes |

### Rule 2: RLS Enabled on All Tables

| Status | Table | RLS Enabled | Policies Created |
|--------|-------|-------------|------------------|
| ✅ | `tenants` | Yes | Admin-only access |
| ✅ | `accounts` | Yes | Tenant-scoped CRUD |
| ✅ | `spine_contacts` | Yes | Tenant-scoped CRUD |
| ✅ | `opportunities` | Yes | Tenant-scoped CRUD |
| ✅ | `spine_campaigns` | Yes | Tenant-scoped CRUD |
| ✅ | `spine_campaign_channels` | Yes | Tenant-scoped CRUD |
| ✅ | `events_raw` | Yes | Tenant-scoped CRUD |
| ✅ | `revenue_events` | Yes | Tenant-scoped CRUD |
| ✅ | `spine_crm_activities` | Yes | Tenant-scoped CRUD |
| ✅ | `metric_snapshots_daily` | Yes | Tenant-scoped CRUD |
| ✅ | `optimization_cycles` | Yes | Tenant-scoped CRUD |
| ✅ | `optimization_actions` | Yes | Tenant-scoped CRUD |
| ✅ | `optimization_action_results` | Yes | Tenant-scoped CRUD |

### Rule 3: Standard RLS Policy Pattern

All tenant-scoped tables MUST use this exact policy pattern:

```sql
-- SELECT policy
CREATE POLICY "tenant_isolation_select" ON public.{table_name}
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenants 
      WHERE user_id = auth.uid()
    )
  );

-- INSERT policy
CREATE POLICY "tenant_isolation_insert" ON public.{table_name}
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenants 
      WHERE user_id = auth.uid()
    )
  );

-- UPDATE policy
CREATE POLICY "tenant_isolation_update" ON public.{table_name}
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenants 
      WHERE user_id = auth.uid()
    )
  );

-- DELETE policy
CREATE POLICY "tenant_isolation_delete" ON public.{table_name}
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenants 
      WHERE user_id = auth.uid()
    )
  );
```

---

## Read/Write Path Enforcement

### Rule 4: All Queries Include `tenant_id` Filter

Even with RLS, code MUST explicitly filter by `tenant_id`:

```typescript
// ✅ CORRECT - Always filter by tenant_id
const { data } = await supabase
  .from('opportunities')
  .select('*')
  .eq('tenant_id', tenantId);

// ❌ WRONG - Relies only on RLS
const { data } = await supabase
  .from('opportunities')
  .select('*');
```

### Rule 5: All Inserts Include `tenant_id`

```typescript
// ✅ CORRECT - Always include tenant_id
await supabase.from('events_raw').insert({
  tenant_id: tenantId,
  event_type: 'lead_created',
  ...eventData
});

// ❌ WRONG - Missing tenant_id
await supabase.from('events_raw').insert({
  event_type: 'lead_created',
  ...eventData
});
```

### Rule 6: Edge Functions Validate Tenant Access

Every edge function that reads/writes tenant data MUST:

1. Extract `tenant_id` from request
2. Validate user has access to that tenant
3. Reject with 403 if unauthorized

```typescript
// Standard pattern for edge functions
const { data: userTenants } = await supabase
  .from('user_tenants')
  .select('tenant_id')
  .eq('user_id', userId);

const authorizedTenants = userTenants?.map(ut => ut.tenant_id) || [];

if (!authorizedTenants.includes(requestedTenantId)) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized tenant access' }),
    { status: 403 }
  );
}
```

---

## Forbidden Patterns

### Rule 7: No Cross-Tenant Joins

```sql
-- ❌ FORBIDDEN - Joins without tenant filter
SELECT * FROM opportunities o
JOIN accounts a ON o.account_id = a.id;

-- ✅ CORRECT - Always include tenant filter
SELECT * FROM opportunities o
JOIN accounts a ON o.account_id = a.id 
  AND o.tenant_id = a.tenant_id
WHERE o.tenant_id = $1;
```

### Rule 8: No Service Role in User-Facing Code

```typescript
// ❌ FORBIDDEN - Service role in user-facing endpoint
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ✅ CORRECT - Use user's JWT
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, process.env.SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${userJwt}` } }
});
```

### Rule 9: No Tenant ID in URL Without Validation

```typescript
// ❌ FORBIDDEN - Trust URL parameter without validation
const tenantId = req.params.tenantId;
const data = await getTenantData(tenantId);

// ✅ CORRECT - Validate user access first
const tenantId = req.params.tenantId;
const hasAccess = await validateTenantAccess(userId, tenantId);
if (!hasAccess) throw new UnauthorizedError();
const data = await getTenantData(tenantId);
```

---

## Audit Checklist

Before any deployment, verify:

- [ ] All new tables have `tenant_id` column (NOT NULL, UUID)
- [ ] All new tables have RLS enabled
- [ ] All new tables have 4 standard tenant isolation policies
- [ ] All new queries explicitly filter by `tenant_id`
- [ ] All new inserts include `tenant_id`
- [ ] All edge functions validate tenant access
- [ ] No joins exist without tenant_id match
- [ ] No service role usage in user-facing code
- [ ] No cross-tenant data exposure in any API response

---

## Emergency Response

If cross-tenant data leak is detected:

1. **Immediately** disable the affected endpoint
2. **Audit** logs for scope of exposure
3. **Notify** affected tenants within 24 hours
4. **Fix** the RLS policy or code
5. **Document** in incident report

Zero tolerance for tenant isolation failures.
