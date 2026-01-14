-- Add is_global column to tenant_segments for hybrid approach
ALTER TABLE public.tenant_segments ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;
-- Create index for efficient global segment queries
CREATE INDEX IF NOT EXISTS idx_tenant_segments_is_global ON public.tenant_segments(is_global) WHERE is_global = true;
-- Drop existing RLS policies on tenant_segments
DROP POLICY IF EXISTS "tenant_isolation" ON public.tenant_segments;
DROP POLICY IF EXISTS "Users can view tenant segments" ON public.tenant_segments;
DROP POLICY IF EXISTS "Users can insert tenant segments" ON public.tenant_segments;
DROP POLICY IF EXISTS "Users can update tenant segments" ON public.tenant_segments;
DROP POLICY IF EXISTS "Users can delete tenant segments" ON public.tenant_segments;
-- Create new RLS policies for hybrid approach
-- SELECT: Users can see global segments OR their tenant's segments
CREATE POLICY "Users can view segments"
ON public.tenant_segments
FOR SELECT
USING (
  is_global = true 
  OR tenant_id = auth.uid() 
  OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
);
-- INSERT: Users can only create segments for their tenant
CREATE POLICY "Users can create tenant segments"
ON public.tenant_segments
FOR INSERT
WITH CHECK (
  tenant_id = auth.uid() 
  OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
);
-- UPDATE: Users can only update their tenant's segments (not global ones)
CREATE POLICY "Users can update tenant segments"
ON public.tenant_segments
FOR UPDATE
USING (
  is_global = false 
  AND (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
);
-- DELETE: Users can only delete their tenant's segments (not global ones)
CREATE POLICY "Users can delete tenant segments"
ON public.tenant_segments
FOR DELETE
USING (
  is_global = false 
  AND (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
);
-- Mark existing segments as global defaults (they can be used by all tenants)
UPDATE public.tenant_segments SET is_global = true WHERE is_active = true;
