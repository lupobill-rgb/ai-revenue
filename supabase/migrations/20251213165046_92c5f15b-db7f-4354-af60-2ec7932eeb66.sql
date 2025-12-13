
-- 1. Human Acknowledge Gate: Add fields to optimization_actions
ALTER TABLE public.optimization_actions 
ADD COLUMN IF NOT EXISTS requires_acknowledgment boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
ADD COLUMN IF NOT EXISTS acknowledged_by uuid;

-- Add tenant onboarding date for 30-day rule
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS revenue_os_activated_at timestamptz;

-- 2. Snapshot Before Execution: Add context_snapshot to optimization_action_results
ALTER TABLE public.optimization_action_results
ADD COLUMN IF NOT EXISTS context_snapshot jsonb;

-- Add comment explaining the fields
COMMENT ON COLUMN public.optimization_actions.requires_acknowledgment IS 'True if action requires human acknowledgment before execution (spend increases, pricing changes, budget reallocation)';
COMMENT ON COLUMN public.optimization_actions.acknowledged_at IS 'Timestamp when human acknowledged the action';
COMMENT ON COLUMN public.optimization_actions.acknowledged_by IS 'User ID who acknowledged the action';
COMMENT ON COLUMN public.tenants.revenue_os_activated_at IS 'When Revenue OS was first activated for this tenant (for 30-day acknowledgment gate)';
COMMENT ON COLUMN public.optimization_action_results.context_snapshot IS 'Full metric state snapshot captured before action execution for auditability';

-- Create index for finding actions requiring acknowledgment
CREATE INDEX IF NOT EXISTS idx_optimization_actions_requires_ack 
ON public.optimization_actions(tenant_id, requires_acknowledgment, status) 
WHERE requires_acknowledgment = true AND status = 'pending';
