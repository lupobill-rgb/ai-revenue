# SMS Channel Implementation

## Added to `run-job-queue/index.ts`

### New Function: `processSMSBatch()`
- Fetches campaign with `target_tags` and `target_segment_codes`
- Filters leads by tags (overlaps) AND segments (in segment_code)
- Creates channel_outbox rows with idempotency keys
- Sends SMS via Twilio API
- Updates outbox status: queued → sent/failed
- Logs lead activities

### Environment Variables Required
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

### Job Type
- `sms_send_batch` - triggers SMS batch processing

### Opt-Out/STOP Handling
**Status**: Basic STOP suppression should be added to filter out leads who have opted out.
Recommend adding `sms_opted_out` boolean column to `leads` table and filtering:
```sql
WHERE sms_opted_out = false OR sms_opted_out IS NULL
```

## Integration Points
- Campaign orchestrator needs to create jobs with `job_type: 'sms_send_batch'`
- SMS assets need to be created with channel = 'sms'

