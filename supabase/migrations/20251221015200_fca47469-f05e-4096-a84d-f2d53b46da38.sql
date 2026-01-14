-- Fix security definer view issue by dropping and recreating with security invoker
DROP VIEW IF EXISTS public.worker_health_summary;
CREATE VIEW public.worker_health_summary 
WITH (security_invoker = true)
AS
SELECT 
  worker_id,
  COUNT(*) as tick_count,
  AVG(tick_duration_ms)::integer as avg_tick_duration_ms,
  MAX(tick_duration_ms) as max_tick_duration_ms,
  SUM(jobs_claimed) as total_jobs_claimed,
  SUM(jobs_processed) as total_jobs_processed,
  SUM(jobs_succeeded) as total_jobs_succeeded,
  SUM(jobs_failed) as total_jobs_failed,
  SUM(jobs_throttled) as total_jobs_throttled,
  SUM(lock_contention_count) as total_lock_contentions,
  MAX(created_at) as last_tick_at,
  EXTRACT(EPOCH FROM (now() - MAX(created_at))) as seconds_since_last_tick
FROM worker_tick_metrics
WHERE created_at > now() - interval '5 minutes'
GROUP BY worker_id;
GRANT SELECT ON public.worker_health_summary TO authenticated;
