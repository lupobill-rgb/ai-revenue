# Phase 3 Smoke Test Suite

Run these tests after deployment to verify all features are working.

## Pre-Test Setup

1. Ensure you have at least one workspace selected
2. Have 3-5 test leads with:
   - Valid email addresses
   - Valid phone numbers (for SMS/Voice)
   - At least one tag (e.g., "Hot", "Qualified")
   - At least one segment_code (e.g., "VIP", "Pros")

## Test 1: Campaign Targeting (Tags)

**Objective**: Verify campaigns filter leads by tags

**Steps**:
1. Go to Campaign Builder → Autopilot Campaign
2. Fill in ICP and Offer
3. Enable "Target Specific Tags"
4. Select one tag (e.g., "Hot")
5. Click "Build Campaign"
6. Check database:
   ```sql
   SELECT target_tags FROM cmo_campaigns ORDER BY created_at DESC LIMIT 1;
   ```
   **Expected**: `['Hot']`

7. Launch campaign
8. Check outbox:
   ```sql
   SELECT count(*) FROM channel_outbox 
   WHERE campaign_id = 'your_campaign_id'
   AND recipient_id IN (
     SELECT id FROM leads WHERE tags && ARRAY['Hot']::text[]
   );
   ```
   **Expected**: Count matches leads with "Hot" tag

**Result**: ✅ / ❌

---

## Test 2: Campaign Targeting (Segments)

**Objective**: Verify campaigns filter leads by segments

**Steps**:
1. Go to Campaign Builder → Autopilot Campaign
2. Fill in ICP and Offer
3. Enable "Target Specific Segments"
4. Select one segment (e.g., "VIP")
5. Click "Build Campaign"
6. Check database:
   ```sql
   SELECT target_segment_codes FROM cmo_campaigns ORDER BY created_at DESC LIMIT 1;
   ```
   **Expected**: `['VIP']`

7. Launch campaign
8. Check outbox:
   ```sql
   SELECT count(*) FROM channel_outbox 
   WHERE campaign_id = 'your_campaign_id'
   AND recipient_id IN (
     SELECT id FROM leads WHERE segment_code = 'VIP'
   );
   ```
   **Expected**: Count matches leads with segment_code = 'VIP'

**Result**: ✅ / ❌

---

## Test 3: Email Channel End-to-End

**Objective**: Verify email sending works

**Steps**:
1. Create campaign with email channel
2. Target specific test lead with your own email
3. Launch campaign
4. Check outbox:
   ```sql
   SELECT status, provider_message_id, error
   FROM channel_outbox 
   WHERE channel = 'email' 
   ORDER BY created_at DESC LIMIT 5;
   ```
   **Expected**: status = 'sent', provider_message_id not null

5. Check your email inbox
   **Expected**: Email received within 2 minutes

**Result**: ✅ / ❌

---

## Test 4: SMS Channel End-to-End

**Objective**: Verify SMS sending works (requires Twilio)

**Pre-requisite**: Twilio credentials configured

**Steps**:
1. Create campaign with SMS channel
2. Target test lead with your own phone number
3. Launch campaign
4. Check outbox:
   ```sql
   SELECT status, provider_message_id, error
   FROM channel_outbox 
   WHERE channel = 'sms' 
   ORDER BY created_at DESC LIMIT 5;
   ```
   **Expected**: status = 'sent', provider_message_id starts with 'SM'

5. Check your phone
   **Expected**: SMS received within 1 minute

**Result**: ✅ / ❌

---

## Test 5: Voice Channel (Live Calls)

**Objective**: Verify voice calls work via VAPI

**Pre-requisite**: VAPI credentials configured

**Steps**:
1. Create campaign with voice channel
2. Target test lead with your own phone number
3. Launch campaign
4. Check outbox:
   ```sql
   SELECT status, provider, provider_message_id, error
   FROM channel_outbox 
   WHERE channel = 'voice' 
   ORDER BY created_at DESC LIMIT 5;
   ```
   **Expected**: status = 'called' or 'sent', provider = 'vapi'

5. Check your phone
   **Expected**: Call received within 2 minutes

**Result**: ✅ / ❌

---

## Test 6: CRM Leads List Pagination

**Objective**: Verify leads list handles large datasets

**Steps**:
1. Go to CRM → Leads List
2. Check total count display (top of page)
   **Expected**: Shows "X leads total"

3. If you have < 1000 leads:
   - Add more test leads via CSV import
   - Aim for 1500+ leads

4. Reload page
5. Watch loading progress bar
   **Expected**: Shows "Loading X%" as batches load

6. Verify all leads display
   **Expected**: No "1000 leads max" message

**Result**: ✅ / ❌

---

## Test 7: Tag Report (Workspace Scoped)

**Objective**: Verify tag reports are scoped to workspace

**Steps**:
1. Go to CRM → Reports
2. Scroll to "Lead Tags Report"
3. Check tag counts
   **Expected**: Only tags from current workspace shown

4. Switch workspace (if you have multiple)
5. Check tag report again
   **Expected**: Different tags/counts appear

6. Check database:
   ```sql
   SELECT tags, count(*) 
   FROM leads 
   WHERE workspace_id = 'your_workspace_id' 
   GROUP BY tags;
   ```
   **Expected**: Matches UI counts

**Result**: ✅ / ❌

---

## Test 8: Segment Report (Tenant Isolated)

**Objective**: Verify segment reports are tenant-isolated

**Steps**:
1. Go to CRM → Reports
2. Scroll to "Lead Segments Report"
3. Check segment counts
   **Expected**: Only segments from current tenant shown

4. Check database:
   ```sql
   SELECT segment_code, count(*) 
   FROM leads 
   WHERE workspace_id = 'your_workspace_id' 
   GROUP BY segment_code;
   ```
   **Expected**: Matches UI counts

5. Verify no cross-tenant data:
   ```sql
   SELECT DISTINCT tenant_id 
   FROM tenant_segments 
   WHERE code IN (
     SELECT DISTINCT segment_code FROM leads WHERE workspace_id = 'your_workspace_id'
   );
   ```
   **Expected**: Only your tenant_id

**Result**: ✅ / ❌

---

## Test 9: Workspace Switching

**Objective**: Verify workspace selection persists

**Steps**:
1. Select Workspace A from dropdown
2. Note current leads count
3. Refresh browser (F5)
   **Expected**: Still on Workspace A with same count

4. Open new tab → Navigate to CRM
   **Expected**: Workspace A still selected

5. Switch to Workspace B
6. Check localStorage:
   - Open DevTools → Application → Local Storage
   - Find key: `currentWorkspaceId`
   - **Expected**: Value = Workspace B's ID

**Result**: ✅ / ❌

---

## Test 10: Idempotency (No Duplicate Sends)

**Objective**: Verify outbox prevents duplicate sends

**Steps**:
1. Create campaign with 1 test lead
2. Launch campaign
3. Check initial outbox row:
   ```sql
   SELECT id, idempotency_key, status 
   FROM channel_outbox 
   WHERE campaign_id = 'your_campaign_id' 
   LIMIT 1;
   ```
   Note the idempotency_key

4. Try to insert duplicate row manually:
   ```sql
   INSERT INTO channel_outbox (
     tenant_id, workspace_id, channel, provider, 
     recipient_email, payload, status, idempotency_key
   ) VALUES (
     'your_tenant', 'your_workspace', 'email', 'resend',
     'test@example.com', '{}', 'queued', 'SAME_KEY_AS_ABOVE'
   );
   ```
   **Expected**: Error - unique constraint violation (23505)

**Result**: ✅ / ❌

---

## Summary

| Test | Status | Notes |
|------|--------|-------|
| 1. Campaign Targeting (Tags) | ⬜ | |
| 2. Campaign Targeting (Segments) | ⬜ | |
| 3. Email Channel | ⬜ | |
| 4. SMS Channel | ⬜ | Requires Twilio |
| 5. Voice Channel | ⬜ | Requires VAPI |
| 6. Leads Pagination | ⬜ | |
| 7. Tag Report | ⬜ | |
| 8. Segment Report | ⬜ | |
| 9. Workspace Switching | ⬜ | |
| 10. Idempotency | ⬜ | |

**Overall Result**: ___/10 tests passed

**Tested By**: ___________________  
**Date**: ___________________  
**Environment**: ☐ Staging  ☐ Production

---

## Rollback Criteria

If 3 or more tests fail, initiate rollback procedure (see PHASE3_DEPLOYMENT_GUIDE.md).

