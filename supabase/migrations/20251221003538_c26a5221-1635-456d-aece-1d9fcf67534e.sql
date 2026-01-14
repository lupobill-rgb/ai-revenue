-- Execution Contract: Database Enforcement (missing constraints only)

-- Check constraint: if skipped=true then status must be 'skipped'
-- Using DO block to avoid error if constraint exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'channel_outbox_skipped_status_check'
  ) THEN
    ALTER TABLE channel_outbox 
    ADD CONSTRAINT channel_outbox_skipped_status_check 
    CHECK (skipped = false OR status = 'skipped');
  END IF;
END $$;
-- Index for efficient run detail queries
CREATE INDEX IF NOT EXISTS idx_channel_outbox_run_id ON channel_outbox(run_id);
-- Index for job-level queries
CREATE INDEX IF NOT EXISTS idx_channel_outbox_job_id ON channel_outbox(job_id);
