-- Fix complete_job to NOT update campaign_runs status (edge function handles this with partial support)
CREATE OR REPLACE FUNCTION public.complete_job(p_job_id uuid, p_success boolean, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job RECORD;
  v_new_status text;
BEGIN
  SELECT * INTO v_job FROM job_queue WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_success THEN
    v_new_status := 'completed';
  ELSIF v_job.attempts >= 2 THEN
    v_new_status := 'dead';
  ELSE
    v_new_status := 'failed';
  END IF;

  UPDATE job_queue
  SET status = v_new_status,
      attempts = attempts + 1,
      last_error = CASE WHEN NOT p_success THEN p_error ELSE NULL END,
      locked_at = NULL,
      locked_by = NULL,
      updated_at = now()
  WHERE id = p_job_id;

  -- NOTE: campaign_runs status is now managed by run-job-queue edge function
  -- which supports partial status. This function only updates job_queue.
END;
$function$;
