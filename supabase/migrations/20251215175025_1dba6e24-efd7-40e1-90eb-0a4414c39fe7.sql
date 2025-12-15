-- Add segment_ids array column to assets table for multi-segment targeting
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS segment_ids text[] DEFAULT '{}';

-- Migrate existing segment_id to segment_ids
UPDATE public.assets 
SET segment_ids = ARRAY[segment_id::text]
WHERE segment_id IS NOT NULL AND (segment_ids IS NULL OR segment_ids = '{}');