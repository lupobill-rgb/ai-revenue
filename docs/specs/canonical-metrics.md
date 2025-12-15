# Canonical Metric Dictionary

> Version: revenue_os_v1  
> Last Updated: 2024-12-12

## Overview

This is the **single source of truth** for all metric IDs used in UbiGrowth Revenue OS. No metric may be created, stored, or referenced outside this dictionary. All metrics flow through `metric_snapshots_daily`.

---

## Demand Metrics (CMO Lens)

| metric_id | Definition | Formula | Source Tables | Direction | Owner |
|-----------|------------|---------|---------------|-----------|-------|
| `leads_created` | New leads entering the funnel | COUNT(events_raw WHERE event_type = 'lead_created') | events_raw | ↑ | analytics_job |
| `mqls_created` | Marketing Qualified Leads | COUNT(events_raw WHERE event_type = 'mql_reached') | events_raw | ↑ | analytics_job |
| `qualified_opps_created` | New qualified opportunities | COUNT(opportunities WHERE stage = 'qualified' AND created_at = date) | opportunities | ↑ | analytics_job |
| `pipeline_total` | Total open pipeline value | SUM(opportunities.amount WHERE stage NOT IN ('closed_won', 'closed_lost')) | opportunities | ↑ | analytics_job |
| `pipeline_velocity` | Pipeline movement rate | (pipeline_total_t2 - pipeline_total_t1) / days | metric_snapshots_daily | ↑ | kernel |
| `channel_contribution` | Pipeline by channel | SUM(opportunities.amount) GROUP BY attributed_channel | opportunities, revenue_events | stabilize | analytics_job |
| `campaign_roas` | Return on ad spend | revenue_attributed / campaign_spend | revenue_events, campaigns | ↑ | analytics_job |
| `email_reply_rate` | Email engagement | replies / emails_sent | events_raw | ↑ | analytics_job |
| `meeting_book_rate` | Meetings booked per outreach | meetings_booked / outreach_attempts | events_raw | ↑ | analytics_job |

---

## Conversion Metrics (CRO Lens)

| metric_id | Definition | Formula | Source Tables | Direction | Owner |
|-----------|------------|---------|---------------|-----------|-------|
| `win_rate` | Opportunity close rate | closed_won / (closed_won + closed_lost) | opportunities | ↑ | analytics_job |
| `avg_sales_cycle_days` | Average days to close | AVG(closed_at - created_at) WHERE stage = 'closed_won' | opportunities | ↓ | analytics_job |
| `stage_conversion_lead_to_opp` | Lead → Opportunity rate | opportunities_created / leads_created | opportunities, events_raw | ↑ | analytics_job |
| `stage_conversion_opp_to_close` | Opportunity → Close rate | closed_won / opportunities_created | opportunities | ↑ | analytics_job |
| `speed_to_lead_hours` | Time from lead to first contact | AVG(first_activity_at - lead_created_at) | events_raw, crm_activities | ↓ | analytics_job |
| `follow_up_rate` | Leads contacted within SLA | leads_contacted_in_sla / total_leads | crm_activities, events_raw | ↑ | analytics_job |
| `no_show_rate` | Meeting no-shows | no_shows / meetings_scheduled | crm_activities | ↓ | analytics_job |
| `proposal_acceptance_rate` | Proposals accepted | proposals_accepted / proposals_sent | opportunities | ↑ | analytics_job |

---

## Economics Metrics (CFO Lens)

| metric_id | Definition | Formula | Source Tables | Direction | Owner |
|-----------|------------|---------|---------------|-----------|-------|
| `bookings_new` | New bookings value | SUM(revenue_events.amount WHERE type = 'new_booking') | revenue_events | ↑ | analytics_job |
| `arr_total` | Annual Recurring Revenue | SUM(accounts.arr WHERE lifecycle_stage = 'customer') | accounts | ↑ | analytics_job |
| `mrr_total` | Monthly Recurring Revenue | SUM(accounts.mrr WHERE lifecycle_stage = 'customer') | accounts | ↑ | analytics_job |
| `expansion_revenue` | Upsell/cross-sell revenue | SUM(revenue_events.amount WHERE type = 'expansion') | revenue_events | ↑ | analytics_job |
| `churn_revenue` | Lost revenue from churn | SUM(revenue_events.amount WHERE type = 'churn') | revenue_events | ↓ | analytics_job |
| `net_revenue_retention` | NRR percentage | (arr_start + expansion - churn) / arr_start | revenue_events, accounts | ↑ | analytics_job |
| `cac_blended` | Blended Customer Acquisition Cost | (marketing_spend + sales_comp) / new_customers | revenue_events | ↓ | analytics_job |
| `cac_by_channel` | CAC per acquisition channel | channel_spend / channel_new_customers | revenue_events | ↓ | analytics_job |
| `payback_months` | Months to recover CAC | cac_blended / (avg_mrr × gross_margin) | derived | ↓ | kernel |
| `gross_margin` | Gross profit margin | (revenue - cogs) / revenue | revenue_events | ↑ | analytics_job |
| `gross_margin_pct` | Gross margin percentage | gross_margin × 100 | derived | ↑ | kernel |
| `contribution_margin_pct` | Contribution margin after variable costs | (revenue - variable_costs) / revenue × 100 | revenue_events | ↑ | analytics_job |
| `ltv_to_cac` | Lifetime value to CAC ratio | ltv / cac_blended | derived | ↑ | kernel |
| `avg_deal_size` | Average closed deal value | AVG(opportunities.amount WHERE stage = 'closed_won') | opportunities | ↑ | analytics_job |
| `revenue_per_fte` | Revenue efficiency per employee | arr_total / headcount | accounts, tenants | ↑ | analytics_job |
| `sales_efficiency_ratio` | Sales efficiency (magic number) | net_new_arr / sales_marketing_spend | revenue_events | ↑ | analytics_job |
| `cash_runway_months` | Months of cash remaining | cash_balance / monthly_burn | derived | ↑ | kernel |

---

## Quality Metrics (Data Health)

| metric_id | Definition | Formula | Source Tables | Direction | Owner |
|-----------|------------|---------|---------------|-----------|-------|
| `data_freshness_hours` | Hours since last data sync | NOW() - MAX(events_raw.occurred_at) | events_raw | ↓ | analytics_job |
| `missing_attribution_pct` | Events without attribution | COUNT(WHERE attributed_campaign_id IS NULL) / total | events_raw, revenue_events | ↓ | analytics_job |
| `duplicate_contact_rate` | Duplicate contacts detected | duplicates / total_contacts | contacts | ↓ | analytics_job |
| `pipeline_coverage_ratio` | Pipeline vs. target coverage | pipeline_total / bookings_target | metric_snapshots_daily | stabilize | kernel |

---

## Rules

1. **No metric may exist outside this dictionary.** If a metric is needed, add it here first.
2. **All metrics flow through `metric_snapshots_daily`.** No side tables for metrics.
3. **Owner defines who computes the metric:**
   - `analytics_job`: Computed by scheduled ETL/aggregation jobs
   - `kernel`: Computed by Revenue OS kernel at runtime
4. **Direction defines optimization target:**
   - ↑ = higher is better
   - ↓ = lower is better
   - stabilize = maintain within target range
5. **Dimensions are stored in the `dimension` JSONB column** of `metric_snapshots_daily`, not separate tables.
