# QA Gates Testing Guide

Run tests in order. Each gate must PASS before proceeding.

---

## Gate 1: Security (Change Set 1)
**Must be 100% PASS before anything else ships.**

### Tests

| Test | How to Verify | PASS Criteria |
|------|---------------|---------------|
| **SEC1: Cross-tenant data isolation** | Login as Tenant A, note data. Login as Tenant B. | B sees only B's data, never A's |
| **SEC2: RLS enforcement** | Query tables directly via Supabase | All user-facing tables have RLS enabled |
| **SEC3: Auth required** | Try accessing /dashboard without login | Redirects to /login |
| **SEC4: API tenant scoping** | Call edge functions with different tenant tokens | Each returns only that tenant's data |

### Quick Validation
```sql
-- Run in database to check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = false;
-- Should return 0 rows for user-data tables
```

---

## Gate 2: Stability (Change Sets 2 + 3)
**Workspace + Onboarding must work reliably.**

### Tests

| Test | How to Verify | PASS Criteria |
|------|---------------|---------------|
| **WS1: Workspace switching** | Create 2 workspaces, switch between them | Data context updates correctly |
| **WS2: Workspace isolation** | Check campaigns in each workspace | No cross-workspace data leak |
| **OB1: New user onboarding** | Create new account | Onboarding wizard appears |
| **OB2: Onboarding completion** | Complete all steps | Marked complete, doesn't repeat on login |
| **OB3: Business profile save** | Fill business profile form | Data persists after refresh |

---

## Gate 3: Product Core (Change Sets 6 + 7)
**Deploy + Voice must function correctly.**

### Tests

| Test | How to Verify | PASS Criteria |
|------|---------------|---------------|
| **D1: Campaign deployment** | Deploy a campaign | Status updates, no silent failure |
| **D2: Asset generation** | Generate landing page/email | Asset created and viewable |
| **D3: Deployment status** | Check deployed campaigns | Shows deployed_at timestamp |
| **V1: No cross-tenant voice** | Tenant A has number, Tenant B has none | B sees setup wizard, not A's number |
| **V2: Bulk call feedback** | Run bulk call to 3 leads | Statuses appear, failures show reason |
| **V3: Voice analytics** | View analytics dashboard | Shows real data with timeframe selector |

---

## Gate 4: UX/Polish (Change Sets 4 + 5 + 8 + 9)
**UI refinements and settings.**

### Tests

| Test | How to Verify | PASS Criteria |
|------|---------------|---------------|
| **UX1: Onboarding frequency** | Complete onboarding, logout/login | Guide doesn't auto-show |
| **UX2: Tour spotlight** | Start product tour | Highlights actual nav/buttons |
| **UX3: Error recovery** | Trigger error (bad CSV import) | UI remains usable, retry available |
| **UX4: Toast stacking** | Trigger multiple toasts | No overlap, queue works |
| **S1: Role management** | As admin, find role controls | Team & Roles accessible in ≤2 clicks |
| **S2: Non-admin restrictions** | As member, try to disable modules | Cannot change, UI read-only |
| **S3: Integration testing** | Configure SMTP with wrong password | Test fails with explicit reason |

---

## Running Tests

### Manual Testing Checklist
1. Open app in incognito for clean session
2. Create test accounts for Tenant A and Tenant B
3. Run through each gate's tests sequentially
4. Document any failures with screenshots

### Automated Checks (where available)
```bash
# Run security linter
# Use the supabase--linter tool in Lovable

# Run unit tests
npm run test
```

---

## Test Account Setup

```
Tenant A: test-a@example.com
Tenant B: test-b@example.com
```

Create both accounts, assign to different workspaces.

---

## Failure Handling

If a gate fails:
1. Document the exact failure scenario
2. Note expected vs actual behavior
3. Fix the issue before retesting
4. Re-run ALL tests in that gate after fix
