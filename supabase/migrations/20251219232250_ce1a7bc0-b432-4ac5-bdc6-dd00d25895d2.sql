-- Add onboarding_completed_at to user_tenants table
ALTER TABLE public.user_tenants 
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_tenants_onboarding ON public.user_tenants(user_id, onboarding_completed_at);