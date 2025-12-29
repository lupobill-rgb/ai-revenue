## Revenue OS Kernel Contracts (Versioned APIs)

**Contract version:** `v1`

These contracts are production APIs across modules. Treat changes exactly like DB schema changes.

### Canonical TS source

- `supabase/functions/_shared/revenue_os_kernel/types.ts`
  - `KernelEvent`
  - `KernelDecision`
  - `RevenueAction`
  - `REVENUE_OS_KERNEL_CONTRACT_VERSION`

### Change policy (non-negotiable)

Any change to these contracts **must**:

- **Bump** `REVENUE_OS_KERNEL_CONTRACT_VERSION`
- **Update this doc** (version + notes)
- **Update tests** (contract version test + any routing/validation tests)
- **Add a migration** if DB table shape/constraints/indexes change (under `supabase/migrations/`)

### Enforcement rollout order (recommended)

1. **discount_guard** (enforced)
2. **invoice_send_guard** (next)
3. **deal_close_guard** (next)

### Operating discipline

- New behavior = **new event**
- No exceptions
- No “temporary” shortcuts


