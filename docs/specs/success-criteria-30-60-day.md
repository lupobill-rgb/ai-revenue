# Revenue OS v1 — 30/60 Day Success Criteria

> **Objective**: Prove the system works, not just the code  
> **Measurement Period**: 2024-12-13 → 2025-02-13  
> **Review Cadence**: Weekly via CFO Digest

---

## 🎯 Success Metrics

### Primary (Must Hit)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Payback Months Reduction | ≥10% vs baseline | `payback_months` week-over-week |
| Gross Margin Stability | No decline >2pp | `gross_margin_pct` trending flat or up |
| Economics Actions Evaluated | ≥20/month | `econ_actions_total` in weekly digest |
| Tenant Isolation | 0 cross-contamination events | Security audit logs |

### Secondary (Good to Hit)

| Metric | Target | Measurement |
|--------|--------|-------------|
| CAC Blended Improvement | ≥5% reduction | `cac_blended` trend |
| Actions Improving Economics | ≥60% positive | `econ_actions_improved / econ_actions_total` |
| CFO Gates Triggered | Appropriate frequency | `cfo_gates_triggered` when constraints violated |
| Kernel Cycle Reliability | 99%+ success rate | `optimization_cycles` error rate |

---

## 📅 Measurement Windows

### Day 1-30: Observation Phase

**Goal**: Validate kernel generates sensible actions without breaking anything

**Weekly Checks**:
- [ ] CFO Digest received and numbers match spot-checks
- [ ] 3-7 actions generated per cycle per tenant
- [ ] No executor errors in logs
- [ ] No cross-tenant data leakage

**Red Flags**:
- Actions stuck in `pending` status
- Same actions repeated despite negative results
- CFO gates not triggering when thresholds breached

### Day 31-60: Optimization Phase

**Goal**: Demonstrate measurable economic improvement

**Weekly Checks**:
- [ ] Payback trending down
- [ ] Margin stable or improving
- [ ] Learning evident (action diversity increases)
- [ ] Operators can interpret Revenue Spine

**Red Flags**:
- Payback trending up despite actions
- Margin declining despite gates
- `econ_actions_hurt > econ_actions_improved` for 2+ weeks

---

## 🏢 Enrolled Tenants

### Phase 1 (Now)

| Tenant | ID | Profile | Baseline Payback | Baseline Margin |
|--------|----|---------|------------------|-----------------|
| Test Tenant A | `aaaaaaaa-...` | Healthy | TBD months | TBD% |
| Test Tenant B | `bbbbbbbb-...` | Underperforming | TBD months | TBD% |

### Phase 2 (After 30 Days)

- Add 2-3 additional tenants based on Phase 1 results
- Require explicit owner opt-in

### Phase 3 (After 60 Days)

- Default for all new tenants
- Existing tenants can request enrollment

---

## 📊 Weekly Review Template

```markdown
## Revenue OS Weekly Review — Week of [DATE]

### CFO Digest Summary
- Tenants Active: X
- Avg Payback: X months (vs X baseline)
- Avg Margin: X% (vs X% baseline)
- Actions Total: X
- Actions Improved: X
- Actions Hurt: X

### Red Flags
- [ ] None
- [ ] Payback drifting up
- [ ] Margin drifting down
- [ ] econ_actions_hurt > improved
- [ ] Other: ___

### Action Items
1. ...
2. ...

### Decision
- [ ] Continue as-is
- [ ] Adjust targets/guardrails
- [ ] Escalate to engineering
```

---

## ✅ Definition of Done

Revenue OS v1 is **validated and proven** when:

1. **30-Day Gate**: No red flags, actions executing properly, CFO digest reliable
2. **60-Day Gate**: ≥10% payback improvement, margin stable, learning demonstrated
3. **Rollout Gate**: Ready to default for new tenants

---

## 📢 Escalation Path

| Severity | Trigger | Action |
|----------|---------|--------|
| Low | Single week econ_actions_hurt > improved | Monitor closely |
| Medium | Two consecutive weeks negative | Review targets/guardrails |
| High | Cross-tenant data issue | Immediate engineering escalation |
| Critical | Kernel failures or data loss | Pause all cycles, incident response |
