-- Add update policy for tenant_rate_limits (for service role updates)
CREATE POLICY "Service role can manage rate limits"
  ON public.tenant_rate_limits FOR ALL
  USING (true)
  WITH CHECK (true);
-- Drop and recreate with proper permissions (service role access)
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.tenant_rate_limits;
-- Add service role insert/update policy for rate limit events
CREATE POLICY "Service role can insert rate limit events"
  ON public.rate_limit_events FOR INSERT
  WITH CHECK (true);
-- Add RPC for updating campaign run status with rate_limited option
CREATE OR REPLACE FUNCTION public.update_campaign_run_status(
  p_run_id uuid,
  p_status text,
  p_started_at timestamptz DEFAULT NULL,
  p_completed_at timestamptz DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE campaign_runs
  SET 
    status = p_status,
    started_at = COALESCE(p_started_at, started_at),
    completed_at = COALESCE(p_completed_at, completed_at),
    error_message = COALESCE(p_error_message, error_message),
    updated_at = now()
  WHERE id = p_run_id;
END;
$$;
