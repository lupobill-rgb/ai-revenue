
-- Create tenant-specific segments table
CREATE TABLE public.tenant_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  color text DEFAULT '#6B7280',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Enable RLS
ALTER TABLE public.tenant_segments ENABLE ROW LEVEL SECURITY;

-- RLS policy for tenant isolation
CREATE POLICY "tenant_isolation" ON public.tenant_segments
FOR ALL USING (
  tenant_id = auth.uid() OR 
  tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
);

-- Add segment_code to crm_contacts for tagging
ALTER TABLE public.crm_contacts 
ADD COLUMN IF NOT EXISTS segment_code text;

-- Add target_segment_codes to cmo_campaigns for campaign targeting
ALTER TABLE public.cmo_campaigns
ADD COLUMN IF NOT EXISTS target_segment_codes text[] DEFAULT '{}';

-- Create index for faster segment queries
CREATE INDEX idx_crm_contacts_segment ON public.crm_contacts(tenant_id, segment_code);
CREATE INDEX idx_tenant_segments_tenant ON public.tenant_segments(tenant_id);

-- Insert Brain Surgery team's segments (you'll need to replace with actual tenant_id)
-- This is a template - run with actual tenant_id after migration
COMMENT ON TABLE public.tenant_segments IS 'Tenant-specific contact segmentation definitions. Brain Surgery segments: P, VIP, Susp-DNK, Susp-K, Susp-PC, Pros, CC';
