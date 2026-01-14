-- DAY 2 (LinkedIn Social + Landing Pages): Minimal approvals table for campaign_assets approvals.
-- NOTE: This is separate from existing `asset_approvals` (which is for `assets` table).

CREATE TABLE IF NOT EXISTS public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  asset_id uuid NOT NULL, -- references campaign_assets.id logically (no FK to avoid coupling)
  channel text NOT NULL,  -- 'social_linkedin' | 'landing_page'
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid
);
CREATE INDEX IF NOT EXISTS idx_approvals_campaign_status
  ON public.approvals (campaign_id, status, created_at DESC);
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
