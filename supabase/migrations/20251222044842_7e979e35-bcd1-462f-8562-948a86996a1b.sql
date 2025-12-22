-- Backfill workspace_id for campaign_channel_stats_daily via cmo_campaigns
UPDATE campaign_channel_stats_daily s
SET workspace_id = c.workspace_id
FROM cmo_campaigns c
WHERE c.id = s.campaign_id
  AND s.workspace_id IS NULL;

-- Backfill workspace_id for channel_spend_daily via cmo_campaign_channels -> cmo_campaigns
UPDATE channel_spend_daily d
SET workspace_id = c.workspace_id
FROM cmo_campaign_channels ch
JOIN cmo_campaigns c ON c.id = ch.campaign_id
WHERE ch.id = d.channel_id
  AND d.workspace_id IS NULL;

-- Now enforce NOT NULL
ALTER TABLE campaign_channel_stats_daily 
ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE channel_spend_daily 
ALTER COLUMN workspace_id SET NOT NULL;