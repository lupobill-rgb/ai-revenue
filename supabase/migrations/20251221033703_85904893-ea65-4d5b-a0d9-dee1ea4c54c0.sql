-- Add certification latch columns to workspaces
ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS platform_certified_at timestamptz,
ADD COLUMN IF NOT EXISTS platform_certification_hash text,
ADD COLUMN IF NOT EXISTS platform_certification_version text;

-- Create index for quick certification lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_certified 
ON public.workspaces(platform_certified_at) 
WHERE platform_certified_at IS NOT NULL;

-- Function to check if workspace is certified
CREATE OR REPLACE FUNCTION public.is_workspace_certified(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id
      AND platform_certified_at IS NOT NULL
  )
$$;

-- Function to get certification details
CREATE OR REPLACE FUNCTION public.get_workspace_certification(_workspace_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT jsonb_build_object(
    'certified', platform_certified_at IS NOT NULL,
    'certified_at', platform_certified_at,
    'certification_hash', platform_certification_hash,
    'certification_version', platform_certification_version
  )
  FROM public.workspaces
  WHERE id = _workspace_id
$$;