# Deprecation Kill List

> Version: revenue_os_v1  
> Last Updated: 2024-12-12

## Overview

This document lists all components, prompts, tables, and dashboards that must be **deprecated and removed** to converge on the unified Revenue OS architecture. No exceptions.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| 🔴 KILL | Must be removed immediately |
| 🟡 DEPRECATE | Stop using, remove within 30 days |
| 🟢 MIGRATE | Data/logic moved to new system, then kill |

---

## 1. Old AI Agent Prompts

| File/Location | Status | Replacement | Notes |
|---------------|--------|-------------|-------|
| `agents/cmo/orchestrator.prompt.txt` | 🟡 DEPRECATE | `kernel/prompts/revenue_os_kernel.md` | CMO lens merged into unified kernel |
| `agents/cmo/orchestrator.system.prompt.txt` | 🟡 DEPRECATE | `kernel/prompts/revenue_os_kernel.md` | CMO lens merged into unified kernel |
| `kernel/prompts/ai_cmo_orchestrator.md` | 🟡 DEPRECATE | `kernel/prompts/revenue_os_kernel.md` | Legacy CMO orchestrator |
| `module_prompts/ai_cmo/ai_cmo_orchestrator.md` | 🟡 DEPRECATE | `kernel/prompts/revenue_os_kernel.md` | Duplicate CMO orchestrator |
| `module_prompts/ai_cmo/ai_cmo_campaign_optimizer.md` | 🟡 DEPRECATE | Kernel optimization loop | Optimization now in kernel |
| Any `AI_CMO_*` prompt constants | 🔴 KILL | Kernel system prompt | No separate CMO/CRO/CFO prompts |
| Any `AI_CRO_*` prompt constants | 🔴 KILL | Kernel system prompt | No separate CMO/CRO/CFO prompts |
| Any `AI_CFO_*` prompt constants | 🔴 KILL | Kernel system prompt | No separate CMO/CRO/CFO prompts |

---

## 2. Role-Specific Dashboards

| Route/Component | Status | Replacement | Notes |
|-----------------|--------|-------------|-------|
| `/cro/*` routes | 🟢 MIGRATE | `/os` dashboard | CRO metrics → Live Revenue Spine |
| `src/pages/cro/CRODashboard.tsx` | 🔴 KILL | `OSDashboard.tsx` | Unified OS dashboard |
| `src/pages/cro/CROPipeline.tsx` | 🔴 KILL | Live Revenue Spine panel | Pipeline view in OS |
| `src/pages/cro/CROForecast.tsx` | 🔴 KILL | Live Revenue Spine panel | Forecast in OS |
| `src/pages/cro/CRORecommendations.tsx` | 🔴 KILL | OS Actions panel | Actions in OS |
| `src/pages/cro/CRODealDetail.tsx` | 🟡 DEPRECATE | Thin detail modal | Keep minimal deal view |
| Any "CMO Dashboard" | 🔴 KILL | OSDashboard | No role dashboards |
| Any "CFO Dashboard" | 🔴 KILL | OSDashboard | No role dashboards |

---

## 3. Duplicate Metric Tables

| Table | Status | Replacement | Migration |
|-------|--------|-------------|-----------|
| `campaign_channel_stats_daily` | 🟢 MIGRATE | `metric_snapshots_daily` | ETL migration script |
| `cmo_metrics_snapshots` | 🟢 MIGRATE | `metric_snapshots_daily` | ETL migration script |
| `campaign_metrics` | 🟢 MIGRATE | `metric_snapshots_daily` | ETL migration script |
| Any per-module metric tables | 🔴 KILL | `metric_snapshots_daily` | Single metric spine |

---

## 4. Overlapping CRM/Contact Tables

| Table | Status | Replacement | Notes |
|-------|--------|-------------|-------|
| `crm_contacts` | 🟢 MIGRATE | `spine_contacts` | Unified contact spine |
| `crm_leads` | 🟢 MIGRATE | `opportunities` | Leads = early-stage opps |
| `crm_activities` | 🟢 MIGRATE | `spine_crm_activities` | Unified activity log |
| `leads` (legacy) | 🔴 KILL | `opportunities` | Old lead table |
| `lead_activities` (legacy) | 🔴 KILL | `spine_crm_activities` | Old activity table |
| `prospects` | 🟢 MIGRATE | `spine_contacts` + `opportunities` | Merge into spine |

---

## 5. Channel-Specific Tool UIs

| Component | Status | Replacement | Notes |
|-----------|--------|-------------|-------|
| Standalone email composer/studio | 🟡 DEPRECATE | External tool + OS orchestration | OS doesn't build emails |
| LinkedIn sequencer UI | 🟡 DEPRECATE | External tool + OS orchestration | OS orchestrates, doesn't create |
| SMS composer | 🟡 DEPRECATE | External tool + OS orchestration | Thin send UI only |
| Drag-drop workflow builder | 🔴 KILL | None | No visual workflow builders |
| Custom automation graphs | 🔴 KILL | Canonical optimization loop | All automation via kernel |

---

## 6. Kernel/Module Registry Conflicts

| File | Status | Replacement | Notes |
|------|--------|-------------|-------|
| `kernel/agents/cmo_orchestrator.json` | 🟡 DEPRECATE | Revenue OS kernel | Single orchestrator |
| `kernel/agents/cmo_optimizer.json` | 🟡 DEPRECATE | Revenue OS kernel | Optimization in kernel |
| `registry/modules/cmo.manifest.json` | 🟡 DEPRECATE | OS manifest only | No per-role modules |
| `registry/modules/cro.manifest.json` | 🟡 DEPRECATE | OS manifest only | No per-role modules |
| `registry/modules/cfo.manifest.json` | 🟡 DEPRECATE | OS manifest only | No per-role modules |
| `registry/modules/coo.manifest.json` | 🟡 DEPRECATE | OS manifest only | No per-role modules |

---

## 7. Edge Functions to Consolidate

| Function | Status | Replacement | Notes |
|----------|--------|-------------|-------|
| `cmo-orchestrator` | 🟡 DEPRECATE | `revenue-os-kernel` | Unified kernel |
| `cmo-optimizer` | 🟡 DEPRECATE | `revenue-os-kernel` | Optimization in kernel |
| `cmo-optimizer-cron` | 🟡 DEPRECATE | `revenue-os-triggers` | Unified trigger system |
| Any `cro-*` functions | 🟡 DEPRECATE | Revenue OS functions | No role-specific functions |
| Any `cfo-*` functions | 🟡 DEPRECATE | Revenue OS functions | No role-specific functions |

---

## 8. Non-Revenue Features

| Feature | Status | Reason | Action |
|---------|--------|--------|--------|
| Generic chat widgets | 🔴 KILL | No revenue attribution | Remove completely |
| Content analytics (no attribution) | 🔴 KILL | Vanity metrics | Remove or add attribution |
| Engagement scores (unused) | 🔴 KILL | Not in decision loop | Remove |
| Social likes/shares (standalone) | 🔴 KILL | No pipeline connection | Remove or connect to pipeline |

---

## Migration Timeline

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 1 | Week 1-2 | Migrate metric tables to `metric_snapshots_daily` |
| Phase 2 | Week 2-3 | Migrate CRM tables to spine |
| Phase 3 | Week 3-4 | Consolidate edge functions |
| Phase 4 | Week 4-5 | Remove role dashboards, redirect routes |
| Phase 5 | Week 5-6 | Delete deprecated prompts and code |
| Phase 6 | Week 6+ | Monitor, cleanup stragglers |

---

## Enforcement

1. **Code Review Gate:** PRs adding anything on kill list are auto-rejected
2. **Weekly Audit:** Check for re-introduction of deprecated patterns
3. **Monitoring:** Alert on any calls to deprecated edge functions
4. **Documentation:** Update all docs to reference new patterns only

**Goal:** Complete convergence to Revenue OS within 6 weeks.
