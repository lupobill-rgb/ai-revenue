# Kernel I/O Contract

> Version: revenue_os_v1.1 (CFO Expansion)  
> Last Updated: 2024-12-13

## Overview

This document defines the **exact input and output schemas** for the Revenue OS Kernel. Engineers wire once against this contract. No guessing.

---

## Input Payload Schema

```typescript
interface KernelInput {
  // Required: Tenant context
  tenant_id: string; // UUID
  
  // Required: Trigger info
  trigger: {
    type: 'scheduled' | 'metric_deviation' | 'lifecycle_event' | 'manual';
    source: string; // e.g., 'cron_daily', 'metric_alert', 'campaign_launch'
    triggered_at: string; // ISO 8601 timestamp
  };
  
  // Required: Time window for analysis
  analysis_window: {
    start_date: string; // YYYY-MM-DD
    end_date: string;   // YYYY-MM-DD
  };
  
  // Required: Current targets and guardrails
  targets: {
    pipeline_total?: number;
    bookings_new?: number;
    arr_target?: number;
    cac_max?: number;
    payback_max_months?: number;
    gross_margin_min?: number;
  };
  
  guardrails: {
    max_daily_spend?: number;
    max_experiment_exposure_pct?: number;
    allowed_levers: ('campaigns' | 'channels' | 'sequences' | 'pricing')[];
    blocked_actions?: string[]; // action types to never execute
  };
  
  // NEW v1.1: CFO-specific guardrails for gating logic
  cfo_guardrails: {
    payback_target_months: number;      // Target payback period
    payback_tolerance_months: number;   // Acceptable variance before gating
    margin_floor_pct: number;           // Minimum gross margin percentage
    max_cac_by_segment?: Record<string, number>; // Optional per-segment CAC caps
    cash_risk_tolerance: 'low' | 'medium' | 'high';
    runway_threshold_months?: number;   // Below this triggers cash gate
  };
  
  // Required: Latest metrics snapshot
  metrics: {
    metric_id: string;
    value: number;
    date: string;
    dimension?: Record<string, string>;
  }[];
  
  // Required: Recent revenue events (last 7-30 days)
  revenue_events: {
    id: string;
    type: string;
    amount: number;
    effective_date: string;
    attributed_campaign_id?: string;
    attributed_channel?: string;
  }[];
  
  // Required: Active campaigns
  campaigns: {
    id: string;
    name: string;
    status: string;
    objective: string;
    budget_total: number;
    budget_spent: number;
    start_date: string;
    end_date?: string;
  }[];
  
  // Required: Open opportunities
  opportunities: {
    id: string;
    stage: string;
    amount: number;
    expected_close_date: string;
    win_probability: number;
  }[];
  
  // Optional: Recent action results (learning feedback)
  recent_action_results?: {
    action_id: string;
    target_metric: string;
    baseline_value: number;
    observed_value: number;
    delta: number;
    confidence: number;
    outcome: 'successful' | 'failed' | 'inconclusive';
    // NEW v1.1: Economic deltas from prior actions
    economic_deltas?: {
      delta_cac?: number;
      delta_payback_months?: number;
      delta_margin_pct?: number;
      delta_revenue_per_fte?: number;
    };
  }[];
  
  // Optional: Tenant configuration overrides
  config?: {
    min_sample_size?: number;
    default_observation_window_days?: number;
    risk_tolerance?: 'low' | 'medium' | 'high';
  };
}
```

---

## Output Payload Schema

```typescript
interface KernelOutput {
  // Required: Cycle metadata
  tenant_id: string;
  cycle_id: string; // Generated UUID for this cycle
  executed_at: string; // ISO 8601 timestamp
  version: 'revenue_os_v1.1';
  
  // Required: Cycle summary
  cycle_summary: {
    binding_constraint: 'demand' | 'conversion' | 'economics' | 'data_quality';
    priority_metric: string; // metric_id from dictionary
    diagnosis: string; // Human-readable summary (1-2 sentences)
    confidence: number; // 0-1
    // NEW v1.1: CFO gate status
    cfo_gates_triggered: ('payback_exceeded' | 'margin_below_floor' | 'cash_constrained')[];
  };
  
  // Required: Recommended actions (3-7 max)
  actions: Action[];
  
  // Optional: Data quality actions (if binding_constraint = 'data_quality')
  data_quality_actions?: DataQualityAction[];
  
  // Required: Learning plan
  learning_plan: {
    metrics_to_monitor: string[]; // metric_ids
    // NEW v1.1: Economic metrics always monitored
    economic_metrics_to_monitor: string[]; // ['gross_margin_pct', 'payback_months', 'cac_blended', 'revenue_per_fte']
    observation_window_days: number;
    expected_outcomes: {
      metric_id: string;
      direction: 'increase' | 'decrease' | 'stabilize';
      magnitude_pct?: number;
    }[];
  };
}

interface Action {
  // Required: Action identity
  action_id: string; // Unique within this cycle
  priority: number; // 1-7, lower is higher priority
  
  // Required: Classification
  owner_subsystem: 'campaigns' | 'crm' | 'pricing' | 'routing' | 'content';
  type: 'config_change' | 'experiment' | 'pause' | 'scale' | 'revert';
  
  // Required: Target
  target_metric: string; // metric_id
  target_entity?: {
    type: 'campaign' | 'channel' | 'segment' | 'sequence';
    id: string;
  };
  
  // Required: Change specification
  proposed_change: {
    field: string;
    current_value: any;
    new_value: any;
  };
  
  // NEW v1.1: CFO score for ranking
  cfo_score: number; // Internal score, higher = better economics
  
  // Required: Guardrails for this action
  guardrails: {
    max_additional_spend?: number;
    max_exposure_percent?: number;
    abort_conditions: {
      metric_id: string;
      operator: '>' | '<' | '>=' | '<=';
      threshold: number;
      consecutive_days: number;
    }[];
  };
  
  // Required: Experiment design (if type = 'experiment')
  experiment?: {
    hypothesis: string;
    control_group_pct: number;
    treatment_group_pct: number;
    min_sample_size: number;
    success_metric: string;
    success_threshold: number;
  };
  
  // Required: Observation
  observation_window_days: number;
  expected_impact: {
    metric_id: string;
    direction: 'increase' | 'decrease';
    magnitude_pct: number;
    confidence: number;
  };
  
  // NEW v1.1: Expected economic impact
  expected_economic_impact?: {
    delta_cac?: number;
    delta_payback_months?: number;
    delta_margin_pct?: number;
  };
  
  // Required: Human-readable
  notes_for_humans: string; // 1-2 sentence explanation
}

interface DataQualityAction {
  action_id: string;
  priority: number;
  issue_type: 'missing_data' | 'stale_data' | 'invalid_data' | 'missing_attribution';
  affected_metric: string;
  description: string;
  recommended_fix: string;
}
```

---

## CFO Gating Logic (v1.1)

The kernel applies CFO gating BEFORE generating actions:

| Gate | Trigger Condition | Effect |
|------|-------------------|--------|
| `payback_exceeded` | `payback_months > target + tolerance` | Suppress demand-scaling actions; prefer conversion/efficiency |
| `margin_below_floor` | `gross_margin_pct < margin_floor` | Block channel scaling; prioritize pricing/cost actions |
| `cash_constrained` | `runway_months < threshold` | Enforce spend caps; reduce experiment exposure; short observation windows only |

Gates are evaluated from `cfo_guardrails` input against current `metrics` snapshot.

---

## Action Scoring (v1.1)

Actions are ranked using CFO-weighted scoring:

```
action_score = 
  (revenue_impact × 0.3)
  + (payback_improvement × 0.25)
  + (margin_protection × 0.25)
  - (cash_risk × 0.2)
```

Actions with negative scores are suppressed unless no alternatives exist.

---

## Validation Rules

### Input Validation

1. `tenant_id` must exist in `tenants` table
2. `trigger.triggered_at` must be within last 24 hours
3. `metrics` array must include at least: `pipeline_total`, `bookings_new`, `cac_blended`
4. `targets` must have at least one target defined
5. `guardrails.allowed_levers` must not be empty
6. **NEW v1.1**: `cfo_guardrails` must include `payback_target_months` and `margin_floor_pct`

### Output Validation

1. `actions` array must have 1-7 items
2. Each `action.target_metric` must be a valid `metric_id` from dictionary
3. Each `action.owner_subsystem` must map to an executor in the executor map
4. `cycle_summary.binding_constraint` must be one of the four allowed values
5. All `action_id` values must be unique within the cycle
6. **NEW v1.1**: Each action must have `cfo_score` populated
7. **NEW v1.1**: `learning_plan.economic_metrics_to_monitor` must not be empty

---

## Error Responses

```typescript
interface KernelError {
  error: true;
  code: 'INVALID_INPUT' | 'TENANT_NOT_FOUND' | 'INSUFFICIENT_DATA' | 'CYCLE_TOO_RECENT' | 'INTERNAL_ERROR';
  message: string;
  details?: Record<string, any>;
}
```

| Code | HTTP Status | When |
|------|-------------|------|
| `INVALID_INPUT` | 400 | Input fails validation |
| `TENANT_NOT_FOUND` | 404 | tenant_id not in database |
| `INSUFFICIENT_DATA` | 422 | Not enough metrics for analysis |
| `CYCLE_TOO_RECENT` | 429 | Last cycle was < 12 hours ago |
| `INTERNAL_ERROR` | 500 | Unexpected failure |

---

## Versioning

- Current version: `revenue_os_v1.1`
- Version is included in output payload
- Breaking changes require new version
- Old versions deprecated with 90-day notice

### Changelog

**v1.1 (2024-12-13) - CFO Expansion**
- Added `cfo_guardrails` to input schema
- Added `cfo_gates_triggered` to cycle_summary
- Added `cfo_score` to actions
- Added `expected_economic_impact` to actions
- Added `economic_metrics_to_monitor` to learning_plan
- Added CFO gating logic documentation
- Added action scoring formula
