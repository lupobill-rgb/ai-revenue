-- SLO Metrics table for historical tracking
CREATE TABLE public.slo_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  threshold numeric NOT NULL,
  is_breached boolean NOT NULL DEFAULT false,
  tenant_id uuid,
  workspace_id uuid,
  measured_at timestamp with time zone NOT NULL DEFAULT now(),
  window_start timestamp with time zone NOT NULL,
  window_end timestamp with time zone NOT NULL,
  details jsonb DEFAULT '{}'::jsonb
);
-- SLO Alerts table for alert history
CREATE TABLE public.slo_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  metric_name text,
  metric_value numeric,
  threshold numeric,
  tenant_id uuid,
  workspace_id uuid,
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  details jsonb DEFAULT '{}'::jsonb
);
-- SLO Configuration table
CREATE TABLE public.slo_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  threshold numeric NOT NULL,
  comparison text NOT NULL DEFAULT 'gte', -- gte, lte, eq
  unit text DEFAULT '%',
  alert_severity text DEFAULT 'warning',
  is_hard_slo boolean DEFAULT false,
  enabled boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
-- Insert default SLO configurations
INSERT INTO public.slo_config (metric_name, display_name, description, threshold, comparison, unit, alert_severity, is_hard_slo) VALUES
  ('scheduler_sla', 'Scheduler SLA', '99% of queued jobs start within 120 seconds', 99, 'gte', '%', 'critical', false),
  ('execution_success', 'Execution Success Rate', '97% of outbox items reach terminal state without retry', 97, 'gte', '%', 'warning', false),
  ('duplicate_sends', 'Duplicate Sends', 'Zero duplicate sends allowed', 0, 'eq', 'count', 'critical', true),
  ('oldest_queued_job', 'Oldest Queued Job', 'Alert if oldest queued job exceeds 180 seconds', 180, 'lte', 'seconds', 'warning', false),
  ('job_retries_per_tenant', 'Job Retries per Tenant', 'Alert if retries exceed threshold per tenant', 10, 'lte', 'count', 'warning', false),
  ('email_error_rate', 'Email Provider Error Rate', 'Email provider error rate threshold', 5, 'lte', '%', 'warning', false),
  ('voice_error_rate', 'Voice Provider Error Rate', 'Voice provider error rate threshold', 5, 'lte', '%', 'warning', false),
  ('idempotent_replay_rate', 'Idempotent Replay Rate', 'Rate of skipped outbox items due to idempotent replay', 5, 'lte', '%', 'warning', false);
-- Enable RLS
ALTER TABLE public.slo_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slo_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slo_config ENABLE ROW LEVEL SECURITY;
-- RLS policies for slo_metrics (platform admins only)
CREATE POLICY "Platform admins can view slo_metrics"
  ON public.slo_metrics FOR SELECT
  USING (is_platform_admin());
CREATE POLICY "Service role can insert slo_metrics"
  ON public.slo_metrics FOR INSERT
  WITH CHECK (true);
-- RLS policies for slo_alerts
CREATE POLICY "Platform admins can view slo_alerts"
  ON public.slo_alerts FOR SELECT
  USING (is_platform_admin());
CREATE POLICY "Platform admins can update slo_alerts"
  ON public.slo_alerts FOR UPDATE
  USING (is_platform_admin());
CREATE POLICY "Service role can insert slo_alerts"
  ON public.slo_alerts FOR INSERT
  WITH CHECK (true);
-- RLS policies for slo_config
CREATE POLICY "Platform admins can view slo_config"
  ON public.slo_config FOR SELECT
  USING (is_platform_admin());
CREATE POLICY "Platform admins can update slo_config"
  ON public.slo_config FOR UPDATE
  USING (is_platform_admin());
-- Indexes for performance
CREATE INDEX idx_slo_metrics_measured_at ON public.slo_metrics(measured_at DESC);
CREATE INDEX idx_slo_metrics_metric_name ON public.slo_metrics(metric_name);
CREATE INDEX idx_slo_alerts_created_at ON public.slo_alerts(created_at DESC);
CREATE INDEX idx_slo_alerts_resolved ON public.slo_alerts(resolved_at) WHERE resolved_at IS NULL;
