# Revenue OS CFO Rollout Plan

This checklist guides the phased rollout of CFO expansion across tenants.

---

## Phase 1 – Internal Tenants (1–2 weeks)

- [ ] Enable `cfo_expansion_enabled = true` for:
  - [ ] 1 "healthy" tenant (good payback, margin, runway)
  - [ ] 1 "struggling" tenant (economics under pressure)
- [ ] Let daily cycles run for 7–14 days
- [ ] Weekly review:
  - [ ] Are "bad economics" tenants seeing fewer scale actions?
  - [ ] Are margin/payback metrics stabilizing or improving?
  - [ ] Check `cfo_gates_active` in `optimization_cycles` table
  - [ ] Review `economic_deltas` in `optimization_action_results`

### Validation Queries

```sql
-- Check CFO gates by tenant
SELECT tenant_id, invoked_at, binding_constraint, cfo_gates_active
FROM optimization_cycles
WHERE invoked_at > now() - interval '7 days'
ORDER BY invoked_at DESC;

-- Review action distribution by lens
SELECT tenant_id, 
       COUNT(*) FILTER (WHERE lens_emphasis = 'cfo') as cfo_actions,
       COUNT(*) FILTER (WHERE lens_emphasis = 'cmo') as cmo_actions,
       COUNT(*) FILTER (WHERE lens_emphasis = 'cro') as cro_actions
FROM optimization_actions
WHERE created_at > now() - interval '7 days'
GROUP BY tenant_id;
```

---

## Phase 2 – Controlled Rollout (2–4 weeks)

- [ ] Turn on for next 3–5 tenants with clear owner
- [ ] Add CFO section of the Operator Playbook to their onboarding docs
- [ ] Train operators on:
  - [ ] Targets & Guardrails panel (Settings → Guardrails)
  - [ ] How CFO constraints change recommendations
  - [ ] Reading the CFO Behavior Cheat Sheet
- [ ] Document any edge cases or override requests

### Success Criteria

| Metric | Target |
|--------|--------|
| Struggling tenants: scale actions suppressed | 80%+ cycles |
| Healthy tenants: scaling still allowed | 90%+ cycles |
| No false-positive CFO gates on healthy tenants | 100% |

---

## Phase 3 – Default Behavior

- [ ] Set CFO expansion as **default** for all new tenants
- [ ] Keep config flag only for emergency rollback
- [ ] Review portfolio-level metrics monthly:
  - [ ] Average payback months
  - [ ] Average CAC
  - [ ] Average gross margin
- [ ] Prove the OS is improving economics over time

### Monthly Portfolio Query

```sql
SELECT 
  date_trunc('month', date) as month,
  AVG(value) FILTER (WHERE metric_id = 'payback_months') as avg_payback,
  AVG(value) FILTER (WHERE metric_id = 'cac_blended') as avg_cac,
  AVG(value) FILTER (WHERE metric_id = 'gross_margin_pct') as avg_margin
FROM metric_snapshots_daily
WHERE date > now() - interval '6 months'
GROUP BY 1
ORDER BY 1;
```

---

## Rollback Procedure

If issues arise:

```sql
-- Disable CFO expansion for specific tenant
UPDATE tenants
SET config = jsonb_set(config, '{cfo_expansion_enabled}', 'false')
WHERE id = '<tenant_id>';
```

The kernel will immediately stop applying CFO gates for that tenant on the next cycle.

---

## Current Status

| Tenant | Name | CFO Enabled | Economics | Status |
|--------|------|-------------|-----------|--------|
| aaaaaaaa-... | Test Tenant A | ✅ | Healthy | Phase 1 |
| bbbbbbbb-... | Test Tenant B | ✅ | Struggling | Phase 1 |

*Last updated: 2025-12-13*
