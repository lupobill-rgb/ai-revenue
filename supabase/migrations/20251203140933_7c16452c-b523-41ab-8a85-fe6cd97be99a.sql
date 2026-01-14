-- Add window_type column if not exists
ALTER TABLE public.rate_limit_counters 
ADD COLUMN IF NOT EXISTS window_type text;
-- Create index for GC performance
CREATE INDEX IF NOT EXISTS idx_rate_limit_window_type_start
  ON public.rate_limit_counters (window_type, window_start);
-- Rate limit GC function
CREATE OR REPLACE FUNCTION public.gc_rate_limit_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete minute windows older than 1 day
  DELETE FROM public.rate_limit_counters
  WHERE window_type = 'minute'
    AND window_start < now() - interval '1 day';

  -- Delete hour windows older than 7 days
  DELETE FROM public.rate_limit_counters
  WHERE window_type = 'hour'
    AND window_start < now() - interval '7 days';

  -- Delete day windows older than 30 days
  DELETE FROM public.rate_limit_counters
  WHERE window_type = 'day'
    AND window_start < now() - interval '30 days';
    
  -- Delete any records without window_type older than 30 days (legacy cleanup)
  DELETE FROM public.rate_limit_counters
  WHERE window_type IS NULL
    AND window_start < now() - interval '30 days';
END;
$$;
