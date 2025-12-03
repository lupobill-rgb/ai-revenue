-- Make workspace_id NOT NULL on key multi-tenant tables
ALTER TABLE public.content_calendar
ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE public.automation_jobs
ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE public.campaigns
ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE public.sequence_enrollments
ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE public.leads
ALTER COLUMN workspace_id SET NOT NULL;