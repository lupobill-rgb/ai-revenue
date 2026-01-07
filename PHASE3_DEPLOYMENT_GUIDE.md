# Phase 3 Deployment Guide

## Quick Start (5 Minutes)

### Step 1: Apply Migration
```bash
cd C:\Users\bill\.cursor\ubigrowth-marketing-hub
supabase db push
```
**Verifies**: Schema consolidation (removes duplicate `target_segments` column)

### Step 2: Deploy Edge Functions
```bash
supabase functions deploy run-job-queue
supabase functions deploy campaign-schedule-outbox
supabase functions deploy cmo-campaign-orchestrate
supabase functions deploy ai-cmo-autopilot-build
```

### Step 3: Configure Twilio (SMS)
```bash
supabase secrets set TWILIO_ACCOUNT_SID=your_account_sid_here
supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token_here
supabase secrets set TWILIO_FROM_NUMBER=+1234567890
```

### Step 4: Smoke Test
1. Go to Campaign Builder → Create Autopilot Campaign
2. Select tags: `['Hot', 'Qualified']`
3. Select segments: `['VIP']`
4. Launch campaign
5. Verify:
   ```sql
   SELECT channel, status, count(*) 
   FROM channel_outbox 
   WHERE workspace_id = 'your_workspace_id'
   GROUP BY channel, status;
   ```
   Expected: Rows for `email`, `sms` with status `queued` or `sent`

---

## What's New in Phase 3

✅ **Campaign Targeting**
- Filter leads by tags (array overlap)
- Filter leads by segments (IN segment_code)
- UI: AutopilotCampaignWizard supports tag/segment selection
- Backend: Targeting filters applied in outbox creation

✅ **Multi-Channel Execution**
- **Email**: Resend integration (existing, verified)
- **SMS**: Twilio integration (NEW - added in this release)
- **Voice**: VAPI live calls (existing, verified)
- **Voicemail Drops**: Documented (requires Slybroadcast - future enhancement)

✅ **CRM Leads Management**
- Pagination: Batched 1000-row fetches
- Total count display (no 1k cap)
- Filters: Status, search, segment
- Sorting: By created_at, name, company, score, status

✅ **Reports & Analytics**
- Tag report: All-time counts, workspace-scoped
- Segment report: Tenant-isolated, paginated
- Channel stats: Email/SMS/Voice delivery tracking
- Trend charts: 30/60/90-day views

✅ **Workspace Consistency**
- No auto-routing to "oldest workspace"
- Explicit selection persisted in localStorage
- Context-driven workspace resolution

---

## Files Changed Summary

### Modified (6 files)
```
M src/lib/cmo/api.ts                                   (target_segment_codes)
M src/lib/cmo/types.ts                                 (type definition)
M supabase/functions/ai-cmo-autopilot-build/index.ts  (column rename)
M supabase/functions/campaign-schedule-outbox/index.ts (targeting filters)
M supabase/functions/cmo-campaign-orchestrate/index.ts (column rename)
M supabase/functions/run-job-queue/index.ts           (SMS batch processor)
```

### New (4 files)
```
?? supabase/migrations/20260108000001_fix_segment_column_confusion.sql
?? supabase/functions/run-job-queue/SMS_IMPLEMENTATION.md
?? supabase/functions/run-job-queue/VOICEMAIL_DROP_STATUS.md
?? RELEASE_READINESS_REPORT_PHASE3.md
```

---

## Pre-Flight Checklist

- [ ] **Database Migration Applied**
  - Verify: `SELECT column_name FROM information_schema.columns WHERE table_name = 'cmo_campaigns' AND column_name LIKE 'target_%';`
  - Expected: `target_tags`, `target_segment_codes` (NOT `target_segments`)

- [ ] **Edge Functions Deployed**
  - Verify: Check Supabase Dashboard → Edge Functions → Last Deployed timestamp

- [ ] **Twilio Configured** (if using SMS)
  - Verify: `supabase secrets list` shows TWILIO_* vars
  - Test: Send test SMS via Twilio dashboard first

- [ ] **Workspace Selected**
  - Verify: UI shows workspace selector with current selection
  - No console errors about missing workspace_id

---

## Rollback Procedure

If critical issues arise:

### 1. Revert Code
```bash
git reset --hard HEAD~1  # or specific commit
supabase functions deploy run-job-queue
supabase functions deploy campaign-schedule-outbox
# etc...
```

### 2. Rollback Migration (if needed)
```sql
-- Restore duplicate column (only if business logic requires it)
ALTER TABLE public.cmo_campaigns 
ADD COLUMN IF NOT EXISTS target_segments text[] DEFAULT NULL;

UPDATE public.cmo_campaigns 
SET target_segments = target_segment_codes 
WHERE target_segment_codes IS NOT NULL;
```

---

## Known Limitations

1. **Voicemail Drops**: Live voice calls work (VAPI). Pre-recorded voicemail drops require Slybroadcast integration (future enhancement).
2. **SMS Opt-Out**: Relies on Twilio's built-in STOP handling. Recommend adding `sms_opted_out` column to `leads` table for explicit tracking.
3. **Rate Limits**: SMS/Voice channels have provider rate limits (configurable via `check_tenant_rate_limit` RPC).

---

## Support & Troubleshooting

### Issue: SMS Not Sending
**Check**:
1. Twilio credentials configured? `supabase secrets list`
2. Twilio account has positive balance?
3. Check `channel_outbox` for error messages:
   ```sql
   SELECT error FROM channel_outbox WHERE channel = 'sms' AND status = 'failed' ORDER BY created_at DESC LIMIT 5;
   ```

### Issue: Campaign Targets Zero Leads
**Check**:
1. Do leads have matching tags or segment_code?
   ```sql
   SELECT count(*) FROM leads WHERE workspace_id = 'your_id' AND tags && ARRAY['YourTag']::text[];
   ```
2. Are target_tags/target_segment_codes set on campaign?
   ```sql
   SELECT target_tags, target_segment_codes FROM cmo_campaigns WHERE id = 'campaign_id';
   ```

### Issue: Outbox Rows Stuck in "queued"
**Check**:
1. Is `run-job-queue` cron running? Check Supabase Dashboard → Edge Functions → Logs
2. Check for rate limit errors:
   ```sql
   SELECT event_type, details FROM campaign_audit_log WHERE event_type = 'rate_limit_exceeded' ORDER BY created_at DESC LIMIT 5;
   ```

---

## Next Steps

After successful deployment:
1. Monitor `channel_outbox` status distribution
2. Review `campaign_audit_log` for execution errors
3. Set up alerting for failed outbox rows
4. Plan Slybroadcast integration for voicemail drops
5. Add `sms_opted_out` column for compliance

---

**Deployed By**: Principal Engineer  
**Date**: January 8, 2026  
**Version**: Phase 3.0

