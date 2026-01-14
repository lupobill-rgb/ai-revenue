-- Add autopilot and goal fields to cmo_campaigns table
ALTER TABLE public.cmo_campaigns
  ADD COLUMN IF NOT EXISTS autopilot_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS goal text CHECK (goal IN ('leads', 'meetings', 'revenue', 'engagement')) NULL;
