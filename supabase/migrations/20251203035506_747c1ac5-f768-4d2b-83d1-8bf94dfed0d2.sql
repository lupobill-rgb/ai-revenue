-- Content calendar: fetch by workspace + schedule + status
CREATE INDEX IF NOT EXISTS idx_content_calendar_ws_schedule_status
ON public.content_calendar (workspace_id, status, scheduled_at);
-- Automation jobs: workspace + scheduled_at
CREATE INDEX IF NOT EXISTS idx_automation_jobs_ws_schedule
ON public.automation_jobs (workspace_id, scheduled_at DESC);
-- Campaigns: workspace + status
CREATE INDEX IF NOT EXISTS idx_campaigns_ws_status
ON public.campaigns (workspace_id, status);
-- Sequence enrollments: workspace + status + next_email_at
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_ws_status_next
ON public.sequence_enrollments (workspace_id, status, next_email_at);
-- Leads: workspace + status
CREATE INDEX IF NOT EXISTS idx_leads_ws_status
ON public.leads (workspace_id, status);
