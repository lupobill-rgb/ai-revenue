-- Add segment_code to leads table for CRM segmentation
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS segment_code TEXT;
-- Create index for faster segment filtering
CREATE INDEX IF NOT EXISTS idx_leads_segment_code ON public.leads(segment_code);
