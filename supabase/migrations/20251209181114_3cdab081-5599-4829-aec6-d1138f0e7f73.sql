-- Drop existing RLS policy
DROP POLICY IF EXISTS "tenant_isolation" ON linkedin_tasks;

-- Create new tenant access policy with simpler pattern
CREATE POLICY "tenant access linkedin_tasks"
  ON linkedin_tasks
  FOR ALL
  USING (tenant_id = auth.uid()::uuid)
  WITH CHECK (tenant_id = auth.uid()::uuid);