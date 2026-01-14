-- ============================================================================
-- Add tenant_id back to cmo_campaigns (schema cache fix)
-- ============================================================================
-- Goal:
-- 1) add column tenant_id uuid
-- 2) backfill tenant_id using workspace_id (workspace_id == tenant_id in this system)
-- 3) set tenant_id NOT NULL
-- 4) add index on (tenant_id)
--
-- Notes:
-- - Use IF NOT EXISTS / safe updates so existing rows are not broken.
-- - This intentionally reintroduces tenant_id even if it was previously deprecated.
-- ============================================================================

ALTER TABLE public.cmo_campaigns
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Backfill any existing rows
UPDATE public.cmo_campaigns
SET tenant_id = workspace_id
WHERE tenant_id IS NULL;

-- Enforce NOT NULL now that existing rows are backfilled
ALTER TABLE public.cmo_campaigns
  ALTER COLUMN tenant_id SET NOT NULL;

-- Index for tenant scoping
CREATE INDEX IF NOT EXISTS cmo_campaigns_tenant_id_idx
  ON public.cmo_campaigns (tenant_id);

