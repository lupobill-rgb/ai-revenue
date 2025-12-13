-- Create tenant_targets table for growth/economics targets and guardrails
CREATE TABLE public.tenant_targets (
  tenant_id uuid PRIMARY KEY NOT NULL,
  -- Growth targets
  target_pipeline numeric DEFAULT 500000,
  target_bookings numeric DEFAULT 150000,
  -- Economics guardrails
  target_payback_months numeric DEFAULT 12,
  margin_floor_pct numeric DEFAULT 60,
  max_cac numeric DEFAULT 2500,
  max_cac_by_segment jsonb DEFAULT '{}'::jsonb,
  cash_risk_tolerance text DEFAULT 'medium' CHECK (cash_risk_tolerance IN ('low', 'medium', 'high')),
  -- Budget controls
  monthly_budget_cap numeric DEFAULT 50000,
  experiment_exposure_pct numeric DEFAULT 20,
  -- Channel levers
  email_enabled boolean DEFAULT true,
  voice_enabled boolean DEFAULT true,
  sms_enabled boolean DEFAULT false,
  landing_pages_enabled boolean DEFAULT true,
  linkedin_enabled boolean DEFAULT false,
  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_targets ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for tenant isolation
CREATE POLICY "tenant_isolation" ON public.tenant_targets
FOR ALL
USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT user_tenants.tenant_id FROM user_tenants WHERE user_tenants.user_id = auth.uid()))
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_tenant_targets_updated_at
BEFORE UPDATE ON public.tenant_targets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();