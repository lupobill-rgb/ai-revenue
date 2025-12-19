-- Fix 1: Restrict release_notes to authenticated users only
DROP POLICY IF EXISTS "Anyone can view release notes" ON public.release_notes;
DROP POLICY IF EXISTS "Authenticated users can view release notes" ON public.release_notes;

CREATE POLICY "Authenticated users can view release notes"
ON public.release_notes
FOR SELECT
TO authenticated
USING (true);

-- Fix 2: Restrict tenant_segments - only allow viewing segments user has access to
DROP POLICY IF EXISTS "Users can view their tenant segments or global" ON public.tenant_segments;
DROP POLICY IF EXISTS "Users can view segments they have access to" ON public.tenant_segments;

CREATE POLICY "Users can view segments they have access to"
ON public.tenant_segments
FOR SELECT
TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  OR is_global = true
);

-- Fix 3: Add proper RLS policy for rate_limit_counters (should only be accessible via service role)
DROP POLICY IF EXISTS "Service role only" ON public.rate_limit_counters;

-- No SELECT policy for regular users - only service role can access
-- This is intentional as rate limiting is handled by backend functions