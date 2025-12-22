-- Add tenant_id column to workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS tenant_id uuid;