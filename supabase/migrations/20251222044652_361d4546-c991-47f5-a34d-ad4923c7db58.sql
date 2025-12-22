-- Add workspace_id to campaign_channel_stats_daily
ALTER TABLE public.campaign_channel_stats_daily 
ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);

-- Add workspace_id to channel_spend_daily
ALTER TABLE public.channel_spend_daily 
ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);

-- Create indexes for performance
CREATE INDEX idx_campaign_channel_stats_daily_workspace ON public.campaign_channel_stats_daily(workspace_id);
CREATE INDEX idx_channel_spend_daily_workspace ON public.channel_spend_daily(workspace_id);

-- Recreate view with proper workspace_id joins
DROP VIEW IF EXISTS public.v_impressions_clicks_by_workspace;

CREATE OR REPLACE VIEW public.v_impressions_clicks_by_workspace AS
WITH ws AS (
  SELECT w.id AS workspace_id,
         w.tenant_id,
         w.demo_mode,
         w.stripe_connected,
         (EXISTS (SELECT 1 FROM social_integrations si
                  WHERE si.workspace_id = w.id 
                    AND si.is_active = true 
                    AND si.platform = ANY (ARRAY['google_analytics','meta','facebook','linkedin']))) AS analytics_connected
  FROM workspaces w
),
mode AS (
  SELECT ws.workspace_id, ws.tenant_id, ws.demo_mode, ws.stripe_connected, ws.analytics_connected,
         CASE WHEN ws.demo_mode THEN 'demo'::data_mode ELSE 'live'::data_mode END AS required_mode
  FROM ws
),
email_stats AS (
  SELECT s.tenant_id, s.workspace_id,
         sum(s.clicks) AS email_clicks, 
         sum(s.opens) AS email_opens, 
         sum(s.sends) AS email_sends
  FROM campaign_channel_stats_daily s
  JOIN mode m ON m.tenant_id = s.tenant_id 
             AND m.workspace_id = s.workspace_id 
             AND m.required_mode = s.data_mode
  WHERE s.channel = 'email'
  GROUP BY s.tenant_id, s.workspace_id
),
paid_stats AS (
  SELECT c.tenant_id, c.workspace_id,
         sum(c.impressions) AS paid_impressions, 
         sum(c.clicks) AS paid_clicks
  FROM channel_spend_daily c
  JOIN mode m ON m.tenant_id = c.tenant_id 
             AND m.workspace_id = c.workspace_id 
             AND m.required_mode = c.data_mode
  GROUP BY c.tenant_id, c.workspace_id
),
cmo_stats AS (
  SELECT ms.tenant_id, ms.workspace_id,
         sum(ms.impressions) AS cmo_impressions, 
         sum(ms.clicks) AS cmo_clicks, 
         sum(ms.conversions) AS cmo_conversions
  FROM cmo_metrics_snapshots ms
  JOIN mode m ON m.tenant_id = ms.tenant_id 
             AND m.workspace_id = ms.workspace_id 
             AND m.required_mode = ms.data_mode
  GROUP BY ms.tenant_id, ms.workspace_id
)
SELECT m.workspace_id, m.tenant_id, m.demo_mode, m.stripe_connected, m.analytics_connected,
       CASE
         WHEN m.demo_mode THEN 'DEMO_MODE'
         WHEN NOT m.analytics_connected AND NOT m.stripe_connected THEN 'NO_PROVIDER_CONNECTED'
         WHEN NOT m.analytics_connected THEN 'NO_ANALYTICS_CONNECTED'
         WHEN NOT m.stripe_connected THEN 'NO_STRIPE_CONNECTED'
         ELSE 'LIVE_OK'
       END AS data_quality_status,
       COALESCE(e.email_sends, 0::bigint) AS email_sends,
       COALESCE(e.email_opens, 0::bigint) AS email_opens,
       COALESCE(e.email_clicks, 0::bigint) AS email_clicks,
       CASE WHEN NOT m.demo_mode AND NOT m.analytics_connected THEN 0::numeric 
            ELSE COALESCE(p.paid_impressions, 0::numeric) END AS paid_impressions,
       CASE WHEN NOT m.demo_mode AND NOT m.analytics_connected THEN 0::numeric 
            ELSE COALESCE(p.paid_clicks, 0::numeric) END AS paid_clicks,
       CASE WHEN NOT m.demo_mode AND NOT m.analytics_connected THEN 0::bigint 
            ELSE COALESCE(c.cmo_impressions, 0::bigint) END AS cmo_impressions,
       CASE WHEN NOT m.demo_mode AND NOT m.analytics_connected THEN 0::bigint 
            ELSE COALESCE(c.cmo_clicks, 0::bigint) END AS cmo_clicks,
       COALESCE(c.cmo_conversions, 0::bigint) AS cmo_conversions,
       CASE WHEN NOT m.demo_mode AND NOT m.analytics_connected THEN 0::numeric 
            ELSE COALESCE(p.paid_impressions, 0::numeric) + COALESCE(c.cmo_impressions, 0::bigint)::numeric END AS total_impressions,
       CASE WHEN NOT m.demo_mode AND NOT m.analytics_connected THEN 0::numeric 
            ELSE COALESCE(e.email_clicks, 0::bigint)::numeric + COALESCE(p.paid_clicks, 0::numeric) + COALESCE(c.cmo_clicks, 0::bigint)::numeric END AS total_clicks
FROM mode m
LEFT JOIN email_stats e ON e.workspace_id = m.workspace_id AND e.tenant_id = m.tenant_id
LEFT JOIN paid_stats p ON p.workspace_id = m.workspace_id AND p.tenant_id = m.tenant_id
LEFT JOIN cmo_stats c ON c.workspace_id = m.workspace_id AND c.tenant_id = m.tenant_id;