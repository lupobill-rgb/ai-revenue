-- Add wants_product_updates to user_tenants (our user-tenant mapping table)
ALTER TABLE public.user_tenants
ADD COLUMN IF NOT EXISTS wants_product_updates boolean NOT NULL DEFAULT true;

-- Create release_notes table for storing weekly updates
CREATE TABLE IF NOT EXISTS public.release_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  body_md text NOT NULL,
  released_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Global release notes have tenant_id = NULL
CREATE INDEX idx_release_notes_tenant ON public.release_notes(tenant_id, released_at DESC);
CREATE INDEX idx_release_notes_global ON public.release_notes(released_at DESC) WHERE tenant_id IS NULL;

-- Enable RLS
ALTER TABLE public.release_notes ENABLE ROW LEVEL SECURITY;

-- Admins can manage release notes
CREATE POLICY "Admins can manage release notes"
  ON public.release_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Users can view release notes for their tenant or global ones
CREATE POLICY "Users can view release notes"
  ON public.release_notes
  FOR SELECT
  USING (
    tenant_id IS NULL 
    OR tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid())
  );

-- Add email_events entry type for tracking
COMMENT ON TABLE public.release_notes IS 'Weekly software update release notes, global (tenant_id NULL) or tenant-specific';