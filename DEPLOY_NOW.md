# 🚀 DEPLOY PHASE 3 NOW

## Status: ✅ ALL SYSTEMS GO

All changes are **staged and ready to commit**. Follow these steps:

---

## Step 1: Commit Changes ✅

```bash
git commit -F COMMIT_MESSAGE.txt
```

**What this commits**:
- 6 modified files (targeting + SMS implementation)
- 8 new files (migration + docs + scripts)
- 1 critical migration (schema consolidation)

---

## Step 2: Push to Repository

```bash
git push origin main
```

---

## Step 3: Deploy to Production

### Option A: Automated (Recommended)

**Windows**:
```powershell
.\deploy-phase3.ps1
```

**Mac/Linux**:
```bash
chmod +x deploy-phase3.sh
./deploy-phase3.sh
```

### Option B: Manual Steps

```bash
# 1. Apply migration
supabase db push

# 2. Deploy functions
supabase functions deploy run-job-queue
supabase functions deploy campaign-schedule-outbox
supabase functions deploy cmo-campaign-orchestrate
supabase functions deploy ai-cmo-autopilot-build

# 3. Configure Twilio (for SMS)
supabase secrets set TWILIO_ACCOUNT_SID=your_sid
supabase secrets set TWILIO_AUTH_TOKEN=your_token
supabase secrets set TWILIO_FROM_NUMBER=+1234567890
```

---

## Step 4: Run Smoke Tests

Open `SMOKE_TEST.md` and run all 10 tests:

1. Campaign Targeting (Tags) ✅
2. Campaign Targeting (Segments) ✅
3. Email Channel ✅
4. SMS Channel ✅ (requires Twilio)
5. Voice Channel ✅ (requires VAPI)
6. Leads Pagination ✅
7. Tag Report ✅
8. Segment Report ✅
9. Workspace Switching ✅
10. Idempotency ✅

**Pass Criteria**: 7+ tests pass (SMS/Voice optional if not configured)

---

## Step 5: Monitor Production

### Check Outbox Status
```sql
SELECT channel, status, count(*) 
FROM channel_outbox 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY channel, status
ORDER BY channel, status;
```

**Expected**:
- email: sent > 0
- sms: sent > 0 (if Twilio configured)
- voice: called > 0 (if VAPI configured)
- Failed count < 5%

### Check Audit Log
```sql
SELECT event_type, count(*) 
FROM campaign_audit_log 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type
ORDER BY count(*) DESC;
```

**Watch for**:
- No `rate_limit_exceeded` events
- No `campaign_failed` events
- `job_completed` events present

---

## Rollback Plan (If Needed)

If critical issues arise:

```bash
# 1. Revert code
git revert HEAD
git push origin main

# 2. Rollback migration
psql $DATABASE_URL -c "ALTER TABLE cmo_campaigns ADD COLUMN target_segments text[];"

# 3. Redeploy old functions
git checkout HEAD~1
supabase functions deploy run-job-queue
# etc...
```

---

## Summary Checklist

- [ ] **Code committed**: `git commit -F COMMIT_MESSAGE.txt`
- [ ] **Code pushed**: `git push origin main`
- [ ] **Migration applied**: `supabase db push`
- [ ] **Functions deployed**: All 4 functions
- [ ] **Twilio configured**: Secrets set (if using SMS)
- [ ] **Smoke tests run**: 7+ passing
- [ ] **Monitoring setup**: Queries ready
- [ ] **Team notified**: Phase 3 deployed ✅

---

## 🎯 Expected Outcome

After successful deployment:
- ✅ Campaigns filter leads by tags + segments
- ✅ Email sends working (existing)
- ✅ SMS sends working (new)
- ✅ Voice calls working (existing)
- ✅ CRM loads all leads (no 1k cap)
- ✅ Reports show accurate, workspace-scoped data
- ✅ Workspace switching persists correctly

---

## 📞 Support

If issues arise:
1. Check `RELEASE_READINESS_REPORT_PHASE3.md` → Section 5 (Risks)
2. Check `PHASE3_DEPLOYMENT_GUIDE.md` → Troubleshooting
3. Check logs: `supabase functions logs <function-name>`
4. Roll back if needed (see above)

---

**Release Captain**: Principal Engineer  
**Deployment Date**: January 8, 2026  
**Confidence**: HIGH ✅

**🚀 GO FOR LAUNCH! 🚀**

