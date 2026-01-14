-- Fix: Consolidate segment targeting to single canonical column
-- Master Prompt v3 specifies target_segment_codes as the correct column
-- This migration removes the duplicate target_segments column

-- Step 1: Migrate any data from target_segments to target_segment_codes
UPDATE public.cmo_campaigns
SET target_segment_codes = target_segments
WHERE target_segments IS NOT NULL 
  AND target_segment_codes IS NULL;
-- Step 2: Drop the duplicate target_segments column
ALTER TABLE public.cmo_campaigns 
DROP COLUMN IF EXISTS target_segments;
-- Step 3: Ensure target_segment_codes has proper comment
COMMENT ON COLUMN public.cmo_campaigns.target_segment_codes IS 
'Array of segment codes to filter leads for this campaign. References tenant_segments.code. Leads are filtered WHERE segment_code = ANY(target_segment_codes).';
-- Step 4: Verify index exists (should already exist from master_prompt_v3)
CREATE INDEX IF NOT EXISTS idx_cmo_campaigns_target_segment_codes 
ON public.cmo_campaigns USING GIN (target_segment_codes);
-- Rollback instructions:
-- To rollback: ALTER TABLE public.cmo_campaigns ADD COLUMN target_segments text[] DEFAULT NULL;
-- Then: UPDATE public.cmo_campaigns SET target_segments = target_segment_codes WHERE target_segment_codes IS NOT NULL;;
