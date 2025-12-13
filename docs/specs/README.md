# Revenue OS v1.1 (CFO) Baseline

> **Version**: revenue_os_v1.1  
> **Current Tag**: `revenue-os-v1.1-cfo`  
> **Established**: 2024-12-13  
> **Status**: 🔒 PRODUCTION FROZEN — See [FROZEN-v1.1-cfo.md](./FROZEN-v1.1-cfo.md)

## Overview

This document establishes the v1.1 baseline for the Revenue OS unified kernel with CFO gating. All future changes MUST update specs first and re-run the 6-step validation loop.

---

## Canonical Components

### Kernel Prompt

- **Source**: `REVENUE_OS_KERNEL_PROMPT` in `kernel/prompts/index.ts`
- **Function**: `getRevenueOSSystemPrompt()`
- **Deprecated**: `AI_CMO_ORCHESTRATOR_PROMPT` (now aliases to Revenue OS)

### I/O Contract

- **Version**: `revenue_os_v1`
- **Spec**: `docs/specs/kernel-io-contract.md`
- **Input**: `KernelInput` interface
- **Output**: `KernelOutput` interface with 3-7 actions per cycle

### Canonical Metrics

- **Spec**: `docs/specs/canonical-metrics.md`
- **Count**: 30+ metrics across demand, conversion, economics domains
- **Source**: `metric_snapshots_daily` table only

---

## Spine Tables (13 Canonical)

| Table | Purpose | Owner |
|-------|---------|-------|
| `tenants` | Multi-tenant root | Platform |
| `optimization_cycles` | Kernel execution log | Kernel |
| `optimization_actions` | Generated actions | Kernel |
| `optimization_action_results` | Impact measurement | Executor |
| `metric_snapshots_daily` | Daily metric values | Analytics Job |
| `events_raw` | Raw event stream | Ingestion |
| `revenue_events` | Revenue-attributed events | Analytics |
| `spine_campaigns` | Campaign configs | CMO |
| `spine_campaign_channels` | Channel configs | CMO |
| `spine_opportunities` | Deal pipeline | CRO |
| `spine_accounts` | Account records | CRO |
| `spine_crm_activities` | CRM activity log | CRM |
| `optimizer_configs` | Per-tenant settings | Platform |

---

## Governing Specifications

| Spec | Purpose |
|------|---------|
| `docs/specs/kernel-io-contract.md` | Input/output schemas |
| `docs/specs/canonical-metrics.md` | Metric definitions |
| `docs/specs/rls-tenant-checklist.md` | Tenant isolation rules |
| `docs/specs/action-executor-map.md` | Subsystem executors |
| `docs/specs/deprecation-kill-list.md` | Legacy removal list |

---

## Validation Loop

Any change to kernel, executors, or spine tables MUST pass all 4 validation steps:

### Step 1: Run Cycle for Two Tenants

```bash
POST /functions/v1/revenue-os-validation
Body: { "operation": "run_cycle_1" }
```

**Pass Criteria:**
- 1 cycle per tenant in `optimization_cycles`
- 3-7 actions per cycle in `optimization_actions`

### Step 2: Execute Actions

```bash
POST /functions/v1/revenue-os-validation
Body: { "operation": "execute_actions" }
```

**Pass Criteria:**
- Actions transition `pending → executing`
- Baselines recorded in `optimization_action_results`

### Step 3: Record Results

```bash
POST /functions/v1/revenue-os-validation
Body: { "operation": "record_results" }
```

**Pass Criteria:**
- `observed_value`, `delta` populated
- Actions transition to `completed` or `failed`

### Step 4: Second Cycle (Learning)

```bash
POST /functions/v1/revenue-os-validation
Body: { "operation": "run_cycle_2" }
```

**Pass Criteria:**
- New cycle actions differ from first cycle
- Failed actions not blindly repeated

### Verify All

```bash
POST /functions/v1/revenue-os-validation
Body: { "operation": "verify_all" }
```

---

## Change Control

1. **Spec First**: Update relevant spec document before code
2. **Run Validation**: Execute all 4 steps on test tenants
3. **All Pass**: All checks must pass before merge
4. **Tag Release**: Create git tag for major changes

---

## Test Tenants

| Tenant | ID | Profile |
|--------|----|---------|
| Tenant A | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` | Healthy, meeting targets |
| Tenant B | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` | Underperforming, gaps |

---

## Edge Functions

| Function | Purpose |
|----------|---------|
| `revenue-os-kernel` | Main optimization kernel |
| `revenue-os-action-executor` | Action execution |
| `revenue-os-triggers` | Event-driven triggers |
| `revenue-os-validation` | E2E validation loop |
