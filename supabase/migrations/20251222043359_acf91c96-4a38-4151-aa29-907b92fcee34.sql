-- Fix security definer view issue by explicitly setting SECURITY INVOKER
-- This ensures RLS policies are enforced based on the querying user
ALTER VIEW v_campaign_dashboard_metrics SET (security_invoker = on);
