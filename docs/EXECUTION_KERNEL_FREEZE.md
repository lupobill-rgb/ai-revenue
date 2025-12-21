# Execution Kernel v1.0 — FROZEN

> **This kernel is frozen. Any changes require passing the QA Certification Harness.**

---

## What Is The Execution Kernel?

The execution kernel is the set of components responsible for campaign execution with guaranteed:
- **Exactly-once delivery** (no duplicate provider actions)
- **Crash recovery** (idempotency key prevents re-sends)
- **Terminal state tracking** (every action reaches a final status)
- **Full auditability** (complete trace from run → job → outbox → provider)

---

## Frozen Components

### Database Tables (Schema)
| Table | Purpose | Frozen Columns |
|-------|---------|----------------|
| `campaign_runs` | Run lifecycle | `id`, `campaign_id`, `tenant_id`, `workspace_id`, `status`, `channel`, `run_config`, `started_at`, `completed_at`, `error_message` |
| `job_queue` | Work unit processing | `id`, `run_id`, `tenant_id`, `workspace_id`, `job_type`, `status`, `attempts`, `locked_at`, `locked_by`, `last_error` |
| `channel_outbox` | Provider action records | `id`, `run_id`, `job_id`, `tenant_id`, `workspace_id`, `channel`, `provider`, `status`, `idempotency_key`, `provider_message_id`, `provider_response`, `skipped`, `skip_reason`, `error` |

### Database Functions
| Function | Purpose |
|----------|---------|
| `deploy_campaign(uuid)` | Creates run + job with `queued` status |
| `claim_queued_jobs(text, int)` | Atomic job claiming with `FOR UPDATE SKIP LOCKED` |
| `complete_job(uuid, boolean, text)` | Terminal job status update |
| `check_campaign_launch_prerequisites(uuid, uuid)` | Pre-launch validation |

### Database Constraints
| Constraint | Table | Purpose |
|------------|-------|---------|
| `channel_outbox_idempotency_key` (UNIQUE) | `channel_outbox` | Prevents duplicate provider actions |
| `channel_outbox_status_check` | `channel_outbox` | Valid status values only |
| `channel_outbox_skipped_status_check` | `channel_outbox` | skipped=true → status='skipped' |

### Edge Functions
| Function | Purpose | Frozen? |
|----------|---------|---------|
| `run-job-queue` | Job processor, outbox writes, status transitions | ✅ FROZEN |
| `_shared/outbox-contract.ts` | Helper for outbox operations | ✅ FROZEN |

### Frontend Components
| Component | Purpose |
|-----------|---------|
| `CampaignRunDetailsDrawer` | Run/job/outbox visibility |
| `CampaignLaunchPrerequisites` | Pre-launch checklist UI |

---

## Frozen Files

```
# Edge Functions (FROZEN)
supabase/functions/run-job-queue/index.ts
supabase/functions/_shared/outbox-contract.ts

# Documentation (FROZEN)
docs/EXECUTION_CONTRACT.md
docs/EXECUTION_KERNEL_FREEZE.md

# QA Harness (maintains the freeze)
src/pages/platform-admin/ExecutionCertQA.tsx
supabase/functions/qa-execution-cert/index.ts
```

---

## Change Policy

### Before Modifying Any Frozen Component:

1. **Open a dedicated PR** with `[KERNEL]` prefix
2. **Run QA Certification Harness** in staging:
   - Q1: Idempotency - no duplicate outbox rows
   - Q2: Crash recovery - idempotency conflict prevents re-send
   - Q3: Scheduler SLA - queued jobs processed < 2 minutes
3. **Run E2E Provider Tests**:
   - E1: Email received with `provider_message_id` stored
   - V1: Voice call attempted with `callId` stored
4. **Verify UX**:
   - UX1: Run/job/outbox visible in drawer
   - UX2: Retry creates new linked run

### PR Checklist

```markdown
## Kernel Change Checklist

- [ ] Opened with `[KERNEL]` prefix
- [ ] QA Harness Q1 PASS (staging)
- [ ] QA Harness Q2 PASS (staging)
- [ ] QA Harness Q3 PASS (staging)
- [ ] E2E Email E1 PASS (real provider)
- [ ] E2E Voice V1 PASS (real provider)
- [ ] UX1 visible in RunDetailsDrawer
- [ ] UX2 retry creates new run
- [ ] Evidence JSON attached
- [ ] Reviewed by 2+ engineers
```

---

## CI Gate Requirements

### Staging Deployment Gate

Before any PR touching frozen files can merge:

1. **Automated Tests**
   - `npm run test:kernel` must pass
   - No TypeScript errors in frozen files

2. **Manual Certification**
   - Navigate to `/platform-admin/qa/execution-cert`
   - Run all tests, export evidence
   - Attach evidence JSON to PR

3. **Real Provider E2E**
   - Send one real email, verify inbox receipt
   - Make one real voice call attempt
   - Screenshot outbox with provider IDs

### Production Gate

- All staging gates PASS
- 24-hour soak test in staging
- Rollback plan documented

---

## Version History

| Version | Date | Changes | QA Cert |
|---------|------|---------|---------|
| v1.0 | 2024-12-21 | Initial freeze | Q1-Q3 PASS, E1/V1 PASS, UX1/UX2 PASS |

---

## Emergency Procedures

### Hotfix Process

1. **Immediate**: Create hotfix branch from `main`
2. **Fix**: Minimal change to frozen component
3. **Test**: Run QA Harness (can be abbreviated for P0)
4. **Deploy**: Fast-track merge with senior approval
5. **Document**: Post-mortem within 24 hours

### Rollback Process

1. Revert to last known-good kernel version
2. Run QA Harness to confirm
3. Investigate root cause
4. Create proper fix following standard process

---

## Contacts

| Role | Responsibility |
|------|----------------|
| Kernel Owner | Approves all kernel changes |
| QA Lead | Certifies test results |
| On-Call Engineer | Emergency kernel issues |

---

## Appendix: Invariants Reference

From `EXECUTION_CONTRACT.md`:

1. **Outbox INSERT before provider call** — Always
2. **Idempotency key required and unique** — Always
3. **Job completes only when all items terminal** — Always
4. **Campaign run status from job outcomes** — Always

These invariants are **non-negotiable**. Any change that weakens them is rejected.
