## Revenue OS Kernel Runtime (Control Plane)

This repo already contains an “Execution Kernel” for campaign delivery (`campaign_runs` / `job_queue` / `channel_outbox`) and an AI module router under `kernel/`.

This document describes the **Revenue OS Kernel Runtime** (control plane): **events → decisions → actions**.

### Contracts (canonical)

- **KernelEvent**: normalized input emitted by modules/backends only (no side effects)
- **KernelDecision**: policy output (stored; no side effects)
- **KernelAction**: executed/logged side effects (stored)

Source of truth (TS):

- `supabase/functions/_shared/revenue_os_kernel/types.ts`

### Where the runtime lives

The runtime executes inside Supabase Edge Functions as shared code:

- `supabase/functions/_shared/revenue_os_kernel/runtime.ts`
  - `ingestKernelEvent(supabase, event)` → persists `kernel_events` (idempotent), runs policies, persists `kernel_decisions`, dispatches `kernel_actions`
- `supabase/functions/_shared/revenue_os_kernel/decision-engine.ts`
  - routes events to policies
- `supabase/functions/_shared/revenue_os_kernel/dispatcher.ts`
  - executes actions using **existing** automation paths (currently: `channel_outbox` for email + `tasks` table for follow-ups)

### DB tables

Created in `supabase/migrations/20251229190000_revenue_os_kernel_runtime.sql`:

- `kernel_events`
- `kernel_decisions`
- `kernel_actions`

All are tenant-safe via RLS using `user_belongs_to_tenant(tenant_id)` and indexed on `(tenant_id, created_at)` and `(tenant_id, correlation_id)`.

### Runtime modes (shadow vs enforcement)

Default is **shadow mode** (decisions/actions are stored, but side effects are not executed).

To enable enforcement, set the Edge Function env var:

- `REVENUE_OS_KERNEL_MODE=enforce`

### Adding a new event/policy (the only allowed pattern)

1. **Emit a KernelEvent** from the backend boundary (Edge Function / RPC wrapper):
   - use `ingestKernelEvent(...)` or `emitKernelEvent(...)` depending on whether you need dispatch.
2. **Add a policy handler** under:
   - `supabase/functions/_shared/revenue_os_kernel/policies/revenue_os/**`
3. **Route it** in:
   - `supabase/functions/_shared/revenue_os_kernel/decision-engine.ts`
4. **If the policy emits actions**, add a thin adapter in:
   - `supabase/functions/_shared/revenue_os_kernel/dispatcher.ts`

### Golden paths implemented

- **CMO**: `lead_captured` (source: `cmo_campaigns`)
  - entrypoints: `supabase/functions/lead-capture` and `supabase/functions/landing-form-submit`
  - policy: `revenue_os.growth.lead_response_v1`
  - actions: `OUTBOUND_EMAIL` (via `channel_outbox`) + `TASK_CREATE` (via `tasks`)

- **FTS Marketplace**: `booking_created` (source: `fts_marketplace`)
  - entrypoint: `supabase/functions/outbound-booking-webhook` (on `booking.created`)
  - policy: `revenue_os.fts.booking_confirmation_v1`
  - actions: confirmation + reminder email (via `channel_outbox`) + roster task

### Guard boundaries (backend-only)

Guard wrappers are Edge Functions that emit guard events and return one of:

- `ALLOW`
- `ALLOW_WITH_OVERRIDE`
- `BLOCK`

Current examples:

- `supabase/functions/revenue-os-guard-deal-update`
- `supabase/functions/revenue-os-guard-send-invoice`


