-- Add demo_mode column to workspaces table for data integrity enforcement
ALTER TABLE IF EXISTS workspaces
  ADD COLUMN IF NOT EXISTS demo_mode boolean NOT NULL DEFAULT false;