-- Create a generic function to increment campaign metric columns
CREATE OR REPLACE FUNCTION public.increment_campaign_metric(
  p_campaign_id UUID,
  p_column_name TEXT,
  p_increment_by INTEGER DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate column name to prevent SQL injection
  IF p_column_name NOT IN ('delivered_count', 'open_count', 'clicks', 'bounce_count', 'unsubscribe_count', 'reply_count', 'sent_count') THEN
    RAISE EXCEPTION 'Invalid column name: %', p_column_name;
  END IF;

  -- Use dynamic SQL to increment the specified column
  EXECUTE format(
    'UPDATE campaign_metrics SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE campaign_id = $2',
    p_column_name,
    p_column_name
  ) USING p_increment_by, p_campaign_id;
END;
$$;
