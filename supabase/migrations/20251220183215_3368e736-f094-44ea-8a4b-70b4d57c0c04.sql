-- Gate 2.1: Idempotency - Add unique constraint and tracking columns

-- Add skipped and skip_reason columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'channel_outbox' 
                   AND column_name = 'skipped') THEN
        ALTER TABLE public.channel_outbox ADD COLUMN skipped boolean DEFAULT false;
    END IF;
END $$;
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'channel_outbox' 
                   AND column_name = 'skip_reason') THEN
        ALTER TABLE public.channel_outbox ADD COLUMN skip_reason text NULL;
    END IF;
END $$;
-- Create unique index on idempotency_key for upsert conflict handling
-- This prevents duplicate provider calls when run-job-queue runs concurrently
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_outbox_idempotency 
ON public.channel_outbox (tenant_id, workspace_id, idempotency_key);
-- Add index for faster lookups by run_id
CREATE INDEX IF NOT EXISTS idx_channel_outbox_run_id 
ON public.channel_outbox (run_id) 
WHERE run_id IS NOT NULL;
