# Revenue OS v1 Stable - FROZEN BASELINE

> **Status**: FROZEN  
> **Tag**: `revenue-os-v1-stable`  
> **Freeze Date**: 2025-12-13  
> **Owner**: Engineering

---

## What Is Frozen

The following components are locked and may not change without explicit approval and full validation loop re-run:

### Kernel Core
- `supabase/functions/revenue-os-kernel/index.ts` - Main orchestration logic
- `supabase/functions/revenue-os-action-executor/index.ts` - Action execution pipeline
- `kernel/prompts/revenue_os_kernel.md` - Kernel prompt contract

### Data Spine (13 Tables)
- `tenants`, `accounts`, `contacts`, `opportunities`
- `spine_campaigns`, `spine_campaign_channels`
- `events_raw`, `revenue_events`, `spine_crm_activities`
- `metric_snapshots_daily`
- `optimization_cycles`, `optimization_actions`, `optimization_action_results`

### Specs
- `docs/specs/kernel-io-contract.md`
- `docs/specs/canonical-metrics.md`
- `docs/specs/action-executor-map.md`
- `docs/specs/rls-tenant-checklist.md`

---

## v1 Hardening Measures (Implemented)

### 1. Human Acknowledge Gate
- Actions that increase spend, change pricing, or reallocate budget ship as `pending_acknowledgment`
- First 30 days per tenant: all high-risk actions require human acknowledgment
- Kernel decides, executors wait for acknowledgment
- Field: `optimization_actions.requires_acknowledgment`

### 2. Context Snapshot Before Execution
- Before executing any action, full metric state captured to `optimization_action_results.context_snapshot`
- Includes: current values, 3-day trends for key metrics
- Provides: before/after comparison, decision trace, rollback confidence
- Field: `optimization_action_results.context_snapshot` (JSONB)

### 3. Tenant Activation Tracking
- `tenants.revenue_os_activated_at` tracks when Revenue OS was first activated
- Used for 30-day acknowledgment gate calculation

---

## Change Process (Mandatory)

Any change to frozen components MUST follow this process:

1. **Spec First**: Update relevant spec document
2. **Peer Review**: Approval from at least one other engineer
3. **Validation Loop**: Re-run PRCT (Pre-Rollout Certainty Test) scenarios A, B, C
4. **Governance Check**: Verify CFO gates still override correctly
5. **Tag**: Create new tag (e.g., `revenue-os-v1.1-stable`)
6. **Document**: Update this file with change summary

---

## What Goes to v2 Backlog

The following features are explicitly NOT in v1 and belong in the v2 roadmap:

### Finance Hub Expansion
- [ ] Budget planning workflows
- [ ] Cash flow forecasting
- [ ] Scenario planning ("what if" analysis)
- [ ] Multi-entity consolidation

### Advanced Analytics
- [ ] Attribution modeling
- [ ] Predictive scoring
- [ ] Cohort analysis
- [ ] Custom metric builder

### Additional Integrations
- [ ] Salesforce bi-directional sync
- [ ] HubSpot bi-directional sync
- [ ] NetSuite integration
- [ ] QuickBooks integration

### Automation Expansion
- [ ] Custom trigger rules
- [ ] Approval workflow builder
- [ ] Slack/Teams notifications
- [ ] Email digest customization

---

## Rollout Phases

### Phase 1 (Current)
- 1 internal tenant + 1-3 early adopters
- Daily kernel cycles via pg_cron
- Manual monitoring of CFO gates

### Phase 2 (After 30 days success)
- 3-5 additional trusted tenants
- Training on Targets & Guardrails panel
- Operator playbook updates

### Phase 3 (Production Default)
- Revenue OS enabled by default for new tenants
- Keep feature flag for emergency rollback
- Monthly portfolio metric review

---

## Success Criteria

v1 is validated if early adopter tenants show within 30-60 days:

- [ ] X% reduction in `payback_months` vs baseline
- [ ] Stable or improved `gross_margin_pct`
- [ ] Minimum N economics-oriented actions per tenant per month
- [ ] Zero tenant cross-contamination events
- [ ] Human can explain any action in one sentence

---

## Emergency Rollback

If critical issues discovered:

1. Set `tenants.revenue_os_enabled = false` for affected tenants
2. Abort all pending/executing actions via executor
3. Document incident in `docs/incidents/`
4. Do NOT proceed to Phase 2/3 until resolved
