-- Add target_segments column to cmo_campaigns for segment-based lead filtering
ALTER TABLE public.cmo_campaigns 
ADD COLUMN IF NOT EXISTS target_segments text[] DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.cmo_campaigns.target_segments IS 'Array of segment codes to filter leads for this campaign. Only leads in matching segments will be included.';

-- Create an index for efficient segment filtering
CREATE INDEX IF NOT EXISTS idx_cmo_campaigns_target_segments ON public.cmo_campaigns USING GIN(target_segments);

-- Ensure leads table has an index on segment_code for efficient filtering
CREATE INDEX IF NOT EXISTS idx_leads_segment_code ON public.leads(segment_code);