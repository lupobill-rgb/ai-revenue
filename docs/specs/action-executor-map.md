# Optimization Action Executor Map

> Version: revenue_os_v1  
> Last Updated: 2024-12-12

## Overview

This document maps every `owner_subsystem` in kernel output to its corresponding **executor function**. No action may be emitted without a registered executor.

---

## Executor Registry

| owner_subsystem | Executor Function | Edge Function | Capabilities |
|-----------------|-------------------|---------------|--------------|
| `campaigns` | `CampaignExecutor` | `revenue-os-action-executor` | Budget adjustment, status changes, targeting updates |
| `crm` | `CRMExecutor` | `revenue-os-action-executor` | Sequence pacing, routing rules, follow-up cadence |
| `pricing` | `PricingExecutor` | `revenue-os-action-executor` | Discount limits, tier adjustments, experiment flags |
| `routing` | `RoutingExecutor` | `revenue-os-action-executor` | Lead routing rules, territory assignments, capacity |
| `content` | `ContentExecutor` | `revenue-os-action-executor` | Template selection, variant weights, A/B distribution |

---

## Action Type × Subsystem Matrix

| Action Type | campaigns | crm | pricing | routing | content |
|-------------|-----------|-----|---------|---------|---------|
| `config_change` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `experiment` | ✅ | ✅ | ✅ | ❌ | ✅ |
| `pause` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `scale` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `revert` | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Executor Specifications

### CampaignExecutor

**Handles:** `owner_subsystem = 'campaigns'`

**Supported Operations:**

| proposed_change.field | Description | Validation |
|-----------------------|-------------|------------|
| `budget_daily` | Adjust daily spend cap | Must be > 0, ≤ guardrails.max_daily_spend |
| `budget_total` | Adjust total campaign budget | Must be ≥ current spend |
| `status` | Pause/resume campaign | Valid: 'running', 'paused' |
| `target_segment` | Update targeting criteria | Must be valid segment JSON |
| `bidding_strategy` | Change bid approach | Platform-specific validation |
| `end_date` | Extend/shorten campaign | Must be ≥ today |

**Experiment Support:**
- A/B budget allocation between campaigns
- Audience split testing
- Bidding strategy experiments

---

### CRMExecutor

**Handles:** `owner_subsystem = 'crm'`

**Supported Operations:**

| proposed_change.field | Description | Validation |
|-----------------------|-------------|------------|
| `sequence_delay_days` | Time between sequence steps | 0-30 days |
| `max_touches` | Maximum outreach attempts | 1-20 |
| `follow_up_sla_hours` | Required response time | 1-168 hours |
| `auto_assign` | Enable/disable auto-assignment | Boolean |
| `priority_score_threshold` | Lead priority cutoff | 0-100 |

**Experiment Support:**
- Sequence timing A/B tests
- Messaging variant tests
- Cadence experiments

---

### PricingExecutor

**Handles:** `owner_subsystem = 'pricing'`

**Supported Operations:**

| proposed_change.field | Description | Validation |
|-----------------------|-------------|------------|
| `discount_max_pct` | Maximum allowed discount | 0-50% |
| `tier_threshold` | Volume tier boundaries | Ascending order |
| `promo_code_enabled` | Enable/disable promo codes | Boolean |
| `trial_days` | Free trial duration | 0-90 days |

**Experiment Support:**
- Pricing tier experiments
- Discount strategy A/B tests
- Trial length experiments

---

### RoutingExecutor

**Handles:** `owner_subsystem = 'routing'`

**Supported Operations:**

| proposed_change.field | Description | Validation |
|-----------------------|-------------|------------|
| `round_robin_enabled` | Enable round-robin routing | Boolean |
| `capacity_per_rep` | Leads per rep cap | 1-1000 |
| `territory_rules` | Geographic/segment routing | Valid rule JSON |
| `overflow_queue` | Fallback assignment | Valid queue ID |

**Experiment Support:**
- Not supported (routing experiments too risky)

---

### ContentExecutor

**Handles:** `owner_subsystem = 'content'`

**Supported Operations:**

| proposed_change.field | Description | Validation |
|-----------------------|-------------|------------|
| `template_id` | Active email/page template | Must exist |
| `variant_weights` | A/B variant distribution | Sum = 100% |
| `subject_line` | Email subject override | ≤ 100 chars |
| `cta_text` | Call-to-action text | ≤ 50 chars |

**Experiment Support:**
- Subject line A/B tests
- Template variant experiments
- CTA experiments

---

## Execution Flow

```
┌─────────────────────┐
│  Kernel Output      │
│  (optimization_     │
│   actions)          │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Action Executor    │
│  Dispatcher         │
│  (routes by         │
│   owner_subsystem)  │
└─────────┬───────────┘
          │
    ┌─────┴─────┬─────────┬─────────┬─────────┐
    ▼           ▼         ▼         ▼         ▼
┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐
│Campaign│  │ CRM   │  │Pricing│  │Routing│  │Content│
│Executor│  │Executor│  │Executor│  │Executor│  │Executor│
└───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘
    │           │           │           │           │
    ▼           ▼           ▼           ▼           ▼
┌─────────────────────────────────────────────────────┐
│              Update optimization_actions            │
│              status = 'executing'                   │
│              Record baseline metrics                │
└─────────────────────────────────────────────────────┘
```

---

## Error Handling

| Error Type | Response | Retry |
|------------|----------|-------|
| Invalid field | Reject action, log error | No |
| Validation failure | Reject action, log reason | No |
| API timeout | Retry with backoff | Yes (3x) |
| External service error | Retry with backoff | Yes (3x) |
| Permission denied | Reject action, alert admin | No |

---

## Adding New Executors

To add a new `owner_subsystem`:

1. Add entry to this map with executor name and capabilities
2. Implement executor class following interface
3. Register in `revenue-os-action-executor` edge function
4. Add to Action Type × Subsystem matrix
5. Document supported operations
6. Update kernel output validation

**No orphaned actions allowed.** Every action must have an executor.
