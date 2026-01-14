-- Align linkedin_tasks with proper foreign keys and constraints

-- Add step_id column if not exists
ALTER TABLE linkedin_tasks 
ADD COLUMN IF NOT EXISTS step_id uuid;
-- Add notes column if not exists
ALTER TABLE linkedin_tasks 
ADD COLUMN IF NOT EXISTS notes text;
-- Rename run_id to sequence_run_id for clarity (if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_tasks' AND column_name = 'run_id') THEN
    ALTER TABLE linkedin_tasks RENAME COLUMN run_id TO sequence_run_id;
  END IF;
END $$;
-- Add sequence_run_id column if it doesn't exist after rename
ALTER TABLE linkedin_tasks 
ADD COLUMN IF NOT EXISTS sequence_run_id uuid;
-- Add foreign key constraints
ALTER TABLE linkedin_tasks 
DROP CONSTRAINT IF EXISTS linkedin_tasks_prospect_id_fkey;
ALTER TABLE linkedin_tasks 
ADD CONSTRAINT linkedin_tasks_prospect_id_fkey 
FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE;
ALTER TABLE linkedin_tasks 
DROP CONSTRAINT IF EXISTS linkedin_tasks_sequence_run_id_fkey;
ALTER TABLE linkedin_tasks 
ADD CONSTRAINT linkedin_tasks_sequence_run_id_fkey 
FOREIGN KEY (sequence_run_id) REFERENCES outbound_sequence_runs(id) ON DELETE CASCADE;
ALTER TABLE linkedin_tasks 
DROP CONSTRAINT IF EXISTS linkedin_tasks_step_id_fkey;
ALTER TABLE linkedin_tasks 
ADD CONSTRAINT linkedin_tasks_step_id_fkey 
FOREIGN KEY (step_id) REFERENCES outbound_sequence_steps(id) ON DELETE CASCADE;
-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_linkedin_tasks_status ON linkedin_tasks(status);
CREATE INDEX IF NOT EXISTS idx_linkedin_tasks_tenant_id ON linkedin_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_tasks_workspace_id ON linkedin_tasks(workspace_id);
-- Add RLS policy if not exists (uses workspace_id for tenant isolation)
DROP POLICY IF EXISTS "tenant_isolation" ON linkedin_tasks;
CREATE POLICY "tenant_isolation" ON linkedin_tasks
FOR ALL USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
);
-- Enable RLS
ALTER TABLE linkedin_tasks ENABLE ROW LEVEL SECURITY;
