-- Add schedule configuration column to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT NULL;

-- Add comment describing the schedule structure
COMMENT ON COLUMN public.campaigns.schedule IS 'Campaign schedule config: { days: { monday: bool, ... }, timeOfDay: string, timezone: string }';