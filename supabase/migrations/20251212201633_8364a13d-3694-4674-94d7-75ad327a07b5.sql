-- 1. Add unique index to prevent duplicate webhook events
CREATE UNIQUE INDEX IF NOT EXISTS email_events_dedupe_idx 
ON email_events (tenant_id, provider_message_id, event_type)
WHERE provider_message_id IS NOT NULL;