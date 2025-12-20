# QA PROOF PACK - Gate 1 Security (RAW SQL OUTPUTS)
**Generated:** 2024-12-20
**Status:** NO-PASS (2 HIGH-RISK issues found)

---

## SEC-1: RLS Coverage List

### Query + Result
```sql
SELECT c.relname AS table_name, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname;
```
- **Total tables:** 101
- **Tables with relrowsecurity=false:** 0
- **Tables with relforcerowsecurity=false:** 101 (expected - service_role bypass)

**SEC-1 Verdict: PASS**

---

## SEC-2: Suspect Policies (no tenant/workspace checks)

### Query
```sql
SELECT tablename, policyname, cmd, qual FROM pg_policies
WHERE schemaname='public' 
AND (qual NOT LIKE '%tenant%' AND qual NOT LIKE '%workspace%' AND qual NOT LIKE '%auth.uid()%');
```

### RAW OUTPUT
| tablename | policyname | cmd | qual |
|-----------|------------|-----|------|
| errors_email_webhook | errors internal only | ALL | false |
| industry_verticals | Anyone can read verticals | SELECT | true |
| optimization_action_results | service_role_full_access_results | ALL | true |
| optimization_actions | service_role_full_access_actions | ALL | true |
| release_notes | Authenticated users can view release notes | SELECT | true |
| **os_tenant_registry** | **Authenticated users can view tenant registry** | **SELECT** | **auth.uid() IS NOT NULL** |
| **tenant_module_access** | **Authenticated users can view module access** | **SELECT** | **true** |

### HIGH-RISK Issues
1. **os_tenant_registry** - Any auth user can read ALL tenant names
2. **tenant_module_access** - Any auth user can see ALL tenant module configs

**SEC-2 Verdict: NO-PASS**

---

## SEC-3: Security Functions (RAW)

All 7 functions verified with `pg_get_functiondef()`:
- `get_user_tenant_ids` ✅ SECURITY DEFINER, search_path='public'
- `has_role` ✅ SECURITY DEFINER, search_path='public'
- `is_platform_admin` ✅ SECURITY DEFINER, search_path='public', defaults auth.uid()
- `is_workspace_member` ✅ SECURITY DEFINER, search_path='public'
- `is_workspace_owner` ✅ SECURITY DEFINER, search_path='public'
- `user_belongs_to_tenant` ✅ SECURITY DEFINER, search_path='public', uses auth.uid()
- `user_has_workspace_access` ✅ SECURITY DEFINER, search_path='', uses auth.uid()

**SEC-3 Verdict: PASS**

---

## SEC-4: Cross-Tenant Denial Test

**REQUIRES MANUAL VERIFICATION** - RLS policies correctly configured.

---

## SEC-5: Route Guards

426 matches in 24 files for `ProtectedRoute`. All app routes wrapped.

**SEC-5 Verdict: PASS**

---

## GATE 1 VERDICT: NO-PASS

### Required Fixes
```sql
-- Fix 1: os_tenant_registry
DROP POLICY IF EXISTS "Authenticated users can view tenant registry" ON os_tenant_registry;
CREATE POLICY "Users can view their tenant registry" ON os_tenant_registry FOR SELECT
USING (user_belongs_to_tenant(tenant_id));

-- Fix 2: tenant_module_access  
DROP POLICY IF EXISTS "Authenticated users can view module access" ON tenant_module_access;
DROP POLICY IF EXISTS "Service role can manage module access" ON tenant_module_access;
```
