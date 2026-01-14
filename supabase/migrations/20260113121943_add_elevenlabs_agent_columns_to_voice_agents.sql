-- ============================================================================
-- Add ElevenLabs agent columns to public.voice_agents
-- ============================================================================
-- Problem:
-- - voice_agents was originally created as a config table (no agent_id).
-- - Later a CREATE TABLE IF NOT EXISTS attempted to add agent_id, but it did
--   not run because the table already existed.
-- - ElevenLabs provisioning/functions expect agent_id/use_case/status columns.
--
-- This migration safely adds the missing columns without breaking existing rows.
-- ============================================================================

ALTER TABLE public.voice_agents
  ADD COLUMN IF NOT EXISTS agent_id text;

ALTER TABLE public.voice_agents
  ADD COLUMN IF NOT EXISTS use_case text;

ALTER TABLE public.voice_agents
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Defaults (do not force existing rows to change unless NULL)
ALTER TABLE public.voice_agents
  ALTER COLUMN use_case SET DEFAULT 'sales_outreach';

-- Backfill from config when present (otherwise sensible defaults)
UPDATE public.voice_agents
SET agent_id = NULLIF(config->>'agent_id', '')
WHERE agent_id IS NULL
  AND config ? 'agent_id'
  AND NULLIF(config->>'agent_id', '') IS NOT NULL;

UPDATE public.voice_agents
SET use_case = COALESCE(NULLIF(config->>'use_case', ''), 'sales_outreach')
WHERE use_case IS NULL;

UPDATE public.voice_agents
SET status = 'active'
WHERE status IS NULL
   OR status NOT IN ('draft', 'active', 'disabled');

-- Enforce NOT NULL now that defaults/backfills are in place
ALTER TABLE public.voice_agents
  ALTER COLUMN use_case SET NOT NULL;

-- Constrain status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'voice_agents_status_check'
  ) THEN
    ALTER TABLE public.voice_agents
      ADD CONSTRAINT voice_agents_status_check
      CHECK (status IN ('draft', 'active', 'disabled'));
  END IF;
END $$;

-- Helpful indexes for lookups
CREATE INDEX IF NOT EXISTS idx_voice_agents_workspace_provider
  ON public.voice_agents (workspace_id, provider);

-- Common filter optimization: "active ElevenLabs agents for a workspace"
-- Helps queries like:
--   WHERE workspace_id = ? AND provider = 'elevenlabs' AND status = 'active'
-- and "pick the latest/default agent"
CREATE INDEX IF NOT EXISTS idx_voice_agents_elevenlabs_active_workspace_default_created
  ON public.voice_agents (workspace_id, is_default, created_at DESC)
  WHERE provider = 'elevenlabs' AND status = 'active';

-- Ensure we don't duplicate ElevenLabs agent IDs per workspace when present
CREATE UNIQUE INDEX IF NOT EXISTS ux_voice_agents_workspace_agent_id
  ON public.voice_agents (workspace_id, agent_id)
  WHERE agent_id IS NOT NULL;

