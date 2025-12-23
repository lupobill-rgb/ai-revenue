-- Add scheduled_at column to channel_outbox for email scheduling
ALTER TABLE public.channel_outbox 
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NULL;

-- Add index for efficient querying of scheduled emails
CREATE INDEX IF NOT EXISTS idx_channel_outbox_scheduled_at 
ON public.channel_outbox (scheduled_at) 
WHERE scheduled_at IS NOT NULL AND status = 'scheduled';

-- Update status to include 'scheduled' as a valid status
COMMENT ON COLUMN public.channel_outbox.scheduled_at IS 'Timestamp when the email should be sent. NULL means send immediately.';