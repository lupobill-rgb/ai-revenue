-- Landing Pages: Auto-generated page assets from Campaign Builder
CREATE TABLE landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  template_type text NOT NULL,
  internal_name text NOT NULL,
  url_slug text NOT NULL,
  hero_headline text NOT NULL,
  hero_subheadline text,
  hero_supporting_points text[] DEFAULT '{}',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  primary_cta_label text NOT NULL,
  primary_cta_type text CHECK (primary_cta_type IN ('form','calendar')) NOT NULL,
  form_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT false,
  url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Enable RLS
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
-- RLS Policies for tenant isolation
CREATE POLICY "tenant_read_landing_pages"
  ON landing_pages FOR SELECT
  USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));
CREATE POLICY "tenant_insert_landing_pages"
  ON landing_pages FOR INSERT
  WITH CHECK (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));
CREATE POLICY "tenant_update_landing_pages"
  ON landing_pages FOR UPDATE
  USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));
CREATE POLICY "tenant_delete_landing_pages"
  ON landing_pages FOR DELETE
  USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));
-- Unique index for tenant + slug
CREATE UNIQUE INDEX landing_pages_tenant_slug_idx ON landing_pages (tenant_id, url_slug);
-- Additional indexes for common lookups
CREATE INDEX idx_landing_pages_tenant ON landing_pages(tenant_id);
CREATE INDEX idx_landing_pages_campaign ON landing_pages(campaign_id);
CREATE INDEX idx_landing_pages_published ON landing_pages(published);
-- Updated at trigger
CREATE TRIGGER set_landing_pages_updated_at
BEFORE UPDATE ON landing_pages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
