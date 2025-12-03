-- Enable RLS on rate_limit_counters (no policies = service role only)
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;