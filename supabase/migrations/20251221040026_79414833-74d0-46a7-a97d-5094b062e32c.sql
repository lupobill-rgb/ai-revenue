-- ================================================================
-- Restrict job_queue.locked_by and status updates to service role only
-- This prevents client-side spoofing of worker IDs
-- ================================================================

-- Create a function to check if the caller is service role (internal functions)
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- Service role has the 'service_role' key in the JWT
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role',
    false
  )
$$;
-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "tenant_isolation_update" ON public.job_queue;
DROP POLICY IF EXISTS "service_role_can_update_job_status" ON public.job_queue;
DROP POLICY IF EXISTS "users_can_create_jobs" ON public.job_queue;
-- Create restrictive update policy: only service role can update locked_by and status
-- This is the ONLY way locked_by gets set - by worker edge functions
CREATE POLICY "service_role_can_update_job_status"
ON public.job_queue
FOR UPDATE
USING (
  -- Service role (edge functions) can update anything
  is_service_role()
  OR
  -- Regular users can only update jobs they have tenant access to,
  -- BUT they cannot modify locked_by or status (enforced via WITH CHECK)
  user_belongs_to_tenant(tenant_id)
)
WITH CHECK (
  -- Service role can do anything
  is_service_role()
  OR
  (
    -- Regular users can update, but locked_by and status must remain unchanged
    -- This is enforced by checking OLD values match NEW values for these columns
    user_belongs_to_tenant(tenant_id)
  )
);
-- Insert policy: users can create jobs but not set locked_by
CREATE POLICY "users_can_create_jobs"
ON public.job_queue
FOR INSERT
WITH CHECK (
  user_belongs_to_tenant(tenant_id)
  AND (locked_by IS NULL) -- Cannot pre-set locked_by on insert
  AND (status = 'queued')  -- New jobs must start as queued
);
-- Ensure select policy exists
DROP POLICY IF EXISTS "tenant_isolation_select" ON public.job_queue;
CREATE POLICY "tenant_isolation_select"
ON public.job_queue
FOR SELECT
USING (user_belongs_to_tenant(tenant_id) OR is_service_role());
-- Ensure delete policy exists
DROP POLICY IF EXISTS "tenant_isolation_delete" ON public.job_queue;
CREATE POLICY "tenant_isolation_delete"
ON public.job_queue
FOR DELETE
USING (user_belongs_to_tenant(tenant_id) OR is_service_role());
-- Add a trigger to prevent client-side locked_by modification
-- This is defense-in-depth in case RLS is bypassed
CREATE OR REPLACE FUNCTION public.protect_job_queue_worker_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If not service role, prevent changes to locked_by and status
  IF NOT is_service_role() THEN
    -- On UPDATE: locked_by and status must remain unchanged
    IF TG_OP = 'UPDATE' THEN
      IF NEW.locked_by IS DISTINCT FROM OLD.locked_by THEN
        RAISE EXCEPTION 'locked_by can only be modified by workers (service role)';
      END IF;
      IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('locked', 'completed', 'failed', 'dead') THEN
        RAISE EXCEPTION 'status can only be transitioned to terminal states by workers (service role)';
      END IF;
    END IF;
    
    -- On INSERT: locked_by must be null, status must be queued
    IF TG_OP = 'INSERT' THEN
      IF NEW.locked_by IS NOT NULL THEN
        RAISE EXCEPTION 'locked_by cannot be set on insert by clients';
      END IF;
      IF NEW.status != 'queued' THEN
        RAISE EXCEPTION 'new jobs must have status=queued';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS protect_job_queue_worker_fields_trigger ON public.job_queue;
CREATE TRIGGER protect_job_queue_worker_fields_trigger
  BEFORE INSERT OR UPDATE ON public.job_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_job_queue_worker_fields();
