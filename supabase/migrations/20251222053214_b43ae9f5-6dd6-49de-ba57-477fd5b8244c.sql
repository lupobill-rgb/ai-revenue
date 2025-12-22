-- Add data_mode column to campaign_metrics
ALTER TABLE public.campaign_metrics 
ADD COLUMN IF NOT EXISTS data_mode public.data_mode NOT NULL DEFAULT 'live'::public.data_mode;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_data_mode 
ON public.campaign_metrics(workspace_id, data_mode);

-- Create a view that gates campaign_metrics by workspace demo_mode
CREATE OR REPLACE VIEW public.v_campaign_metrics_gated AS
SELECT 
  cm.*,
  w.demo_mode as workspace_demo_mode,
  CASE 
    WHEN w.demo_mode = true AND cm.data_mode = 'demo' THEN true
    WHEN w.demo_mode = false AND cm.data_mode = 'live' THEN true
    ELSE false
  END as is_visible
FROM public.campaign_metrics cm
JOIN public.workspaces w ON w.id = cm.workspace_id
WHERE 
  (w.demo_mode = true AND cm.data_mode = 'demo')
  OR (w.demo_mode = false AND cm.data_mode = 'live');