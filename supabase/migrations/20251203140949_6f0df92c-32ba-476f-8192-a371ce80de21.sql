-- Update check_and_increment_rate_limit to accept window_type
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  rate_key TEXT,
  max_requests INTEGER,
  window_seconds INTEGER,
  p_window_type TEXT DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts        TIMESTAMPTZ := now();
  window_floor  TIMESTAMPTZ := now_ts - (window_seconds * INTERVAL '1 second');
  current_count INTEGER;
BEGIN
  SELECT count
  INTO current_count
  FROM rate_limit_counters
  WHERE key = rate_key
    AND window_start >= window_floor
  FOR UPDATE;

  IF current_count IS NULL THEN
    INSERT INTO rate_limit_counters (key, window_start, count, window_type)
    VALUES (rate_key, now_ts, 1, p_window_type);
    RETURN TRUE;
  END IF;

  IF current_count >= max_requests THEN
    RETURN FALSE;
  END IF;

  UPDATE rate_limit_counters
  SET count = count + 1,
      updated_at = now_ts
  WHERE key = rate_key
    AND window_start >= window_floor;

  RETURN TRUE;
END;
$$;