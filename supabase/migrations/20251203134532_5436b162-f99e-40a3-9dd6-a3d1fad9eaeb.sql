-- Create rate_limit_counters table for rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS rate_limit_key_idx ON public.rate_limit_counters(key);
CREATE INDEX IF NOT EXISTS rate_limit_window_idx ON public.rate_limit_counters(window_start);
-- Composite index for garbage collection
CREATE INDEX IF NOT EXISTS rate_limit_gc_idx ON public.rate_limit_counters(window_start, key);
