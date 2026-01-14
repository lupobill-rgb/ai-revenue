-- Add target_tags column to cmo_campaigns for tag-based lead filtering
ALTER TABLE public.cmo_campaigns 
ADD COLUMN IF NOT EXISTS target_tags text[] DEFAULT NULL;
-- Add comment explaining the column
COMMENT ON COLUMN public.cmo_campaigns.target_tags IS 'Array of tags to filter leads for this campaign. Only leads with matching tags will be included.';
-- Create an index for efficient tag filtering
CREATE INDEX IF NOT EXISTS idx_cmo_campaigns_target_tags ON public.cmo_campaigns USING GIN(target_tags);
-- Also ensure leads table has an index on tags for efficient filtering
CREATE INDEX IF NOT EXISTS idx_leads_tags ON public.leads USING GIN(tags);
