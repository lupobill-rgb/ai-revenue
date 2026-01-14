-- Add platform_certification_run_id column to workspaces for traceability
-- This UUID uniquely identifies each certification attempt
ALTER TABLE public.workspaces 
ADD COLUMN IF NOT EXISTS platform_certification_run_id UUID;
