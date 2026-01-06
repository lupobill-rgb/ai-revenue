-- Remove the user_id unique constraint to allow one profile per workspace (not per user)
-- This enables users to have different business profiles for different workspaces

ALTER TABLE public.business_profiles DROP CONSTRAINT IF EXISTS business_profiles_user_id_key;