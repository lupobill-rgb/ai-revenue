-- Add reply_count column to campaign_metrics
ALTER TABLE public.campaign_metrics
ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0;
-- Add index for efficient reply analytics queries
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_reply_count 
ON public.campaign_metrics(campaign_id, reply_count);
-- Add index on cmo_metrics_snapshots for reply queries
CREATE INDEX IF NOT EXISTS idx_cmo_metrics_snapshots_campaign_date 
ON public.cmo_metrics_snapshots(campaign_id, snapshot_date DESC);
-- Create helper function to increment reply count atomically
CREATE OR REPLACE FUNCTION public.increment_campaign_reply_count(p_campaign_id UUID, p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO campaign_metrics (campaign_id, workspace_id, reply_count)
  VALUES (p_campaign_id, p_workspace_id, 1)
  ON CONFLICT (campaign_id) 
  DO UPDATE SET 
    reply_count = campaign_metrics.reply_count + 1,
    updated_at = now();
END;
$$;
-- Create helper function to record reply in metrics snapshot
CREATE OR REPLACE FUNCTION public.record_reply_metric_snapshot(
  p_workspace_id UUID,
  p_campaign_id UUID,
  p_tenant_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  INSERT INTO cmo_metrics_snapshots (
    workspace_id,
    campaign_id,
    snapshot_date,
    metric_type,
    conversions,
    custom_metrics
  )
  VALUES (
    p_workspace_id,
    p_campaign_id,
    today,
    'email_reply',
    1,
    jsonb_build_object('reply_count', 1, 'tenant_id', p_tenant_id)
  )
  ON CONFLICT (campaign_id, snapshot_date, metric_type) 
  DO UPDATE SET 
    conversions = cmo_metrics_snapshots.conversions + 1,
    custom_metrics = jsonb_set(
      cmo_metrics_snapshots.custom_metrics,
      '{reply_count}',
      to_jsonb(COALESCE((cmo_metrics_snapshots.custom_metrics->>'reply_count')::int, 0) + 1)
    );
END;
$$;
-- Add unique constraint for snapshot upserts if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cmo_metrics_snapshots_campaign_date_type_key'
  ) THEN
    ALTER TABLE public.cmo_metrics_snapshots 
    ADD CONSTRAINT cmo_metrics_snapshots_campaign_date_type_key 
    UNIQUE (campaign_id, snapshot_date, metric_type);
  END IF;
EXCEPTION WHEN duplicate_table THEN
  NULL;
END $$;
