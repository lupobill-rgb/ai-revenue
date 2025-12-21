-- ============================================================
-- Zero-Tolerance Silent Failure Prevention
-- Enforces that failed outbox rows MUST have readable errors
-- This is a database-level constraint that cannot be bypassed
-- ============================================================

-- Trigger function to prevent silent failures in channel_outbox
CREATE OR REPLACE FUNCTION public.enforce_outbox_error_on_failure()
RETURNS TRIGGER AS $$
DECLARE
  MIN_ERROR_LENGTH CONSTANT INTEGER := 10;
  error_text TEXT;
BEGIN
  -- Only check when status is 'failed'
  IF NEW.status = 'failed' THEN
    error_text := COALESCE(TRIM(NEW.error), '');
    
    -- Enforce minimum error length
    IF LENGTH(error_text) < MIN_ERROR_LENGTH THEN
      RAISE EXCEPTION 'SILENT FAILURE BLOCKED: channel_outbox row with status="failed" requires error with at least % characters. Got: "%" (% chars)',
        MIN_ERROR_LENGTH,
        CASE WHEN LENGTH(error_text) > 50 THEN SUBSTRING(error_text, 1, 50) || '...' ELSE error_text END,
        LENGTH(error_text);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create the trigger (drop if exists first)
DROP TRIGGER IF EXISTS enforce_outbox_error_trigger ON public.channel_outbox;

CREATE TRIGGER enforce_outbox_error_trigger
  BEFORE INSERT OR UPDATE ON public.channel_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_outbox_error_on_failure();

-- Add helpful comment
COMMENT ON TRIGGER enforce_outbox_error_trigger ON public.channel_outbox IS 
  'Prevents silent failures by requiring all failed outbox rows to have readable error messages (min 10 chars)';

-- ============================================================
-- Run-level invariant enforcement
-- If a campaign_run has any failed outbox rows, its status cannot be 'completed'
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_run_status_consistency()
RETURNS TRIGGER AS $$
DECLARE
  failed_count INTEGER;
  MIN_ERROR_LENGTH CONSTANT INTEGER := 10;
  error_text TEXT;
BEGIN
  -- Only check when status is changing to 'completed'
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    -- Count failed outbox rows for this run
    SELECT COUNT(*) INTO failed_count
    FROM public.channel_outbox
    WHERE run_id = NEW.id AND status = 'failed';
    
    IF failed_count > 0 THEN
      RAISE EXCEPTION 'RUN STATUS VIOLATION: Cannot mark campaign_run % as "completed" when it has % failed outbox row(s). Use "partial" or "failed" status instead.',
        NEW.id, failed_count;
    END IF;
  END IF;
  
  -- When status is 'failed' or 'partial', require error_message
  IF NEW.status IN ('failed', 'partial') THEN
    error_text := COALESCE(TRIM(NEW.error_message), '');
    
    IF LENGTH(error_text) < MIN_ERROR_LENGTH THEN
      RAISE EXCEPTION 'RUN ERROR REQUIRED: campaign_run with status="%" requires error_message with at least % characters. Got: "%" (% chars)',
        NEW.status, MIN_ERROR_LENGTH,
        CASE WHEN LENGTH(error_text) > 50 THEN SUBSTRING(error_text, 1, 50) || '...' ELSE error_text END,
        LENGTH(error_text);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create the trigger (drop if exists first)
DROP TRIGGER IF EXISTS enforce_run_status_trigger ON public.campaign_runs;

CREATE TRIGGER enforce_run_status_trigger
  BEFORE INSERT OR UPDATE ON public.campaign_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_run_status_consistency();

COMMENT ON TRIGGER enforce_run_status_trigger ON public.campaign_runs IS 
  'Enforces run status consistency: completed runs cannot have failed outbox rows; failed/partial runs require error_message';