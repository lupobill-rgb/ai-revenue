-- Add config column to outbound_campaigns for orchestration rules
ALTER TABLE outbound_campaigns 
ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{
  "max_daily_sends_email": 200,
  "max_daily_sends_linkedin": 40,
  "business_hours_only": true,
  "timezone": "America/Chicago",
  "linkedin_delivery_mode": "manual_queue"
}'::jsonb;