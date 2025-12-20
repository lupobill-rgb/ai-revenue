-- ============================================================
-- ADD IDEMPOTENCY KEY TO CHANNEL_OUTBOX
-- Prevents duplicate sends/calls/posts even with retries
-- ============================================================

-- 1) Add idempotency_key column (nullable first for existing data)
ALTER TABLE public.channel_outbox 
ADD COLUMN IF NOT EXISTS idempotency_key text;

-- 2) Backfill existing rows with a generated key
UPDATE public.channel_outbox 
SET idempotency_key = encode(
  sha256(
    (COALESCE(run_id::text, '') || '-' || 
     COALESCE(recipient_id::text, '') || '-' || 
     channel || '-' || 
     created_at::text)::bytea
  ), 
  'hex'
)
WHERE idempotency_key IS NULL;

-- 3) Make column NOT NULL after backfill
ALTER TABLE public.channel_outbox 
ALTER COLUMN idempotency_key SET NOT NULL;

-- 4) Add unique constraint for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS channel_outbox_idempotency_key_unique 
ON public.channel_outbox (tenant_id, workspace_id, idempotency_key);

-- 5) Add comment explaining the pattern
COMMENT ON COLUMN public.channel_outbox.idempotency_key IS 
'Unique key to prevent duplicate provider calls.
Format: sha256(run_id + lead_id + asset_id + channel + scheduled_for)
Email: sha256(run_id + lead_id + asset_id + scheduled_for)
Voice: sha256(run_id + lead_id + script_version + scheduled_for)  
Social: sha256(run_id + post_id + channel + scheduled_for)';