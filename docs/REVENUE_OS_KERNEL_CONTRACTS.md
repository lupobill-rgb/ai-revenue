## Revenue OS Kernel Contracts (Versioned APIs)

**Contract version:** `v1`
**Tables version:** `v1.1` (kernel_events, kernel_decisions, kernel_actions created)

These contracts are production APIs across modules. Treat changes exactly like DB schema changes.

### Kernel Tables (v1.1)

| Table | Purpose | Idempotency |
|-------|---------|-------------|
| `kernel_events` | Inbound events from modules | `(tenant_id, idempotency_key)` UNIQUE |
| `kernel_decisions` | Policy decisions per event | FK to `kernel_events` |
| `kernel_actions` | Dispatchable actions per decision | FK to `kernel_decisions` |

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

### Event Flow (OS v1 Contract)

```
Module -> emit KernelEvent (idempotent insert)
       -> Decision Engine (policy evaluation)
       -> Persist KernelDecision
       -> Dispatcher (execute actions)
       -> Persist KernelActions
       -> Update event status to 'completed'
```

### Enforcement rollout order (recommended)

1. **discount_guard** (enforced)
2. **invoice_send_guard** (next)
3. **deal_close_guard** (next)

### Operating discipline

- New behavior = **new event**
- No exceptions
- No "temporary" shortcuts
- tenant_id and workspace_id MUST remain separate
