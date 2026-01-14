-- ============================================================================
-- Ads Operator: per-ad-account execution kill switch
-- ============================================================================

ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS execution_enabled boolean NOT NULL DEFAULT true;

