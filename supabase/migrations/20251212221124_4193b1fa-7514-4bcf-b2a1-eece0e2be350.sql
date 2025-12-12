-- =====================================================
-- REVENUE OS CANONICAL DATA SPINE
-- Single source of truth for all revenue decisions
-- =====================================================

-- 1. TENANTS - Tenant registry and configuration
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'test')),
  billing_plan text NOT NULL DEFAULT 'trial' CHECK (billing_plan IN ('trial', 'core', 'scale', 'enterprise')),
  default_currency text NOT NULL DEFAULT 'USD',
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. ACCOUNTS - Companies/customers
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  external_crm_id text,
  industry text,
  size_bucket text CHECK (size_bucket IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+')),
  segment text CHECK (segment IN ('smb', 'mid', 'enterprise', 'strategic')),
  lifecycle_stage text DEFAULT 'prospect' CHECK (lifecycle_stage IN ('prospect', 'customer', 'churned', 'reactivated')),
  arr numeric DEFAULT 0,
  mrr numeric DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. CONTACTS - People (canonical, replaces crm_contacts for spine)
-- Note: We're creating a new spine-aligned table, existing crm_contacts remains for legacy
CREATE TABLE IF NOT EXISTS public.spine_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  email text,
  phone text,
  first_name text,
  last_name text,
  role_title text,
  persona_tag text CHECK (persona_tag IN ('decision_maker', 'influencer', 'champion', 'blocker', 'end_user', 'unknown')),
  lifecycle_stage text DEFAULT 'lead' CHECK (lifecycle_stage IN ('lead', 'mql', 'sql', 'opportunity', 'customer', 'churned')),
  external_crm_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. OPPORTUNITIES - Canonical pipeline
CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.spine_contacts(id) ON DELETE SET NULL,
  name text NOT NULL,
  stage text NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'qualified', 'discovery', 'proposal', 'negotiation', 'verbal', 'closed_won', 'closed_lost')),
  amount numeric DEFAULT 0,
  expected_close_date date,
  owner_user_id uuid,
  source text CHECK (source IN ('inbound', 'outbound', 'partner', 'referral', 'event', 'unknown')),
  campaign_id uuid,
  lost_reason text,
  win_probability numeric DEFAULT 0 CHECK (win_probability >= 0 AND win_probability <= 1),
  external_crm_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

-- 5. SPINE CAMPAIGNS - Logical campaigns (cross-channel)
CREATE TABLE IF NOT EXISTS public.spine_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  objective text CHECK (objective IN ('pipeline', 'bookings', 'expansion', 'awareness', 'retention', 'reactivation')),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'archived')),
  target_segment jsonb DEFAULT '{}'::jsonb,
  budget_currency text DEFAULT 'USD',
  budget_total numeric DEFAULT 0,
  start_date date,
  end_date date,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. SPINE CAMPAIGN CHANNELS - Per-channel executions
CREATE TABLE IF NOT EXISTS public.spine_campaign_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.spine_campaigns(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'paid_search', 'paid_social', 'linkedin', 'voice', 'direct_mail', 'events', 'content', 'organic_social')),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  daily_budget numeric DEFAULT 0,
  bidding_strategy jsonb DEFAULT '{}'::jsonb,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. EVENTS RAW - Unified event ingestion
CREATE TABLE IF NOT EXISTS public.events_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source_system text NOT NULL,
  event_type text NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.spine_contacts(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.spine_campaigns(id) ON DELETE SET NULL,
  campaign_channel_id uuid REFERENCES public.spine_campaign_channels(id) ON DELETE SET NULL,
  properties jsonb DEFAULT '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. REVENUE EVENTS - Normalized revenue & cost facts
CREATE TABLE IF NOT EXISTS public.revenue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('new_booking', 'expansion', 'churn', 'refund', 'discount', 'cogs', 'marketing_spend', 'sales_comp', 'other_cost', 'other_revenue')),
  amount numeric NOT NULL,
  currency text DEFAULT 'USD',
  effective_date date NOT NULL,
  attribution_model text DEFAULT 'last_touch' CHECK (attribution_model IN ('first_touch', 'last_touch', 'multi_touch', 'linear', 'time_decay')),
  attributed_campaign_id uuid REFERENCES public.spine_campaigns(id) ON DELETE SET NULL,
  attributed_channel text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. SPINE CRM ACTIVITIES - Human/AI sales activities
CREATE TABLE IF NOT EXISTS public.spine_crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.spine_contacts(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  activity_type text NOT NULL,
  direction text CHECK (direction IN ('inbound', 'outbound')),
  outcome text,
  performed_by_user_id uuid,
  performed_by_agent_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. METRIC SNAPSHOTS DAILY - Derived metric layer
CREATE TABLE IF NOT EXISTS public.metric_snapshots_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  date date NOT NULL,
  metric_id text NOT NULL,
  dimension jsonb DEFAULT '{}'::jsonb,
  value numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, date, metric_id, dimension)
);

-- 11. OPTIMIZATION CYCLES - Log kernel runs
CREATE TABLE IF NOT EXISTS public.optimization_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoked_at timestamptz NOT NULL DEFAULT now(),
  binding_constraint text CHECK (binding_constraint IN ('demand', 'conversion', 'economics', 'data_quality')),
  priority_metric_id text,
  input_snapshot_ref jsonb DEFAULT '{}'::jsonb,
  raw_kernel_output jsonb DEFAULT '{}'::jsonb,
  duration_ms integer,
  status text DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 12. OPTIMIZATION ACTIONS - Actions emitted by kernel
CREATE TABLE IF NOT EXISTS public.optimization_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  optimization_cycle_id uuid NOT NULL REFERENCES public.optimization_cycles(id) ON DELETE CASCADE,
  action_id text NOT NULL,
  priority_rank integer,
  owner_subsystem text CHECK (owner_subsystem IN ('campaigns', 'crm', 'routing', 'pricing', 'lifecycle', 'data')),
  lens_emphasis text CHECK (lens_emphasis IN ('cmo', 'cro', 'cfo', 'blended')),
  type text CHECK (type IN ('data_correction', 'experiment', 'config_change', 'alert', 'forecast_update')),
  target_metric text,
  target_direction text CHECK (target_direction IN ('increase', 'decrease', 'stabilize')),
  hypothesis text,
  config jsonb DEFAULT '{}'::jsonb,
  guardrails jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'executing', 'completed', 'aborted', 'failed')),
  expected_observation_window_days integer,
  notes_for_humans text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 13. OPTIMIZATION ACTION RESULTS - Close the loop
CREATE TABLE IF NOT EXISTS public.optimization_action_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  optimization_action_id uuid NOT NULL REFERENCES public.optimization_actions(id) ON DELETE CASCADE,
  observation_start_date date,
  observation_end_date date,
  metric_id text NOT NULL,
  baseline_value numeric,
  observed_value numeric,
  delta numeric,
  delta_direction text CHECK (delta_direction IN ('increase', 'decrease', 'neutral')),
  confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_accounts_tenant ON public.accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_spine_contacts_tenant ON public.spine_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_spine_contacts_account ON public.spine_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_tenant ON public.opportunities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_account ON public.opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON public.opportunities(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_spine_campaigns_tenant ON public.spine_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_spine_campaign_channels_campaign ON public.spine_campaign_channels(campaign_id);
CREATE INDEX IF NOT EXISTS idx_events_raw_tenant_occurred ON public.events_raw(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_raw_type ON public.events_raw(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_raw_idempotency ON public.events_raw(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_revenue_events_tenant_date ON public.revenue_events(tenant_id, effective_date);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_tenant_date ON public.metric_snapshots_daily(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_metric ON public.metric_snapshots_daily(tenant_id, metric_id);
CREATE INDEX IF NOT EXISTS idx_optimization_cycles_tenant ON public.optimization_cycles(tenant_id, invoked_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_actions_cycle ON public.optimization_actions(optimization_cycle_id);
CREATE INDEX IF NOT EXISTS idx_optimization_actions_status ON public.optimization_actions(tenant_id, status);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spine_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spine_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spine_campaign_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spine_crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_snapshots_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optimization_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optimization_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optimization_action_results ENABLE ROW LEVEL SECURITY;

-- Tenants: Users can only see tenants they belong to
CREATE POLICY "tenant_access" ON public.tenants FOR ALL
USING (id = auth.uid() OR id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

-- Standard tenant isolation policy for all spine tables
CREATE POLICY "tenant_isolation" ON public.accounts FOR ALL
USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation" ON public.spine_contacts FOR ALL
USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation" ON public.opportunities FOR ALL
USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation" ON public.spine_campaigns FOR ALL
USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation" ON public.spine_campaign_channels FOR ALL
USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation" ON public.events_raw FOR ALL
USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation" ON public.revenue_events FOR ALL
USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation" ON public.spine_crm_activities FOR ALL
USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation" ON public.metric_snapshots_daily FOR ALL
USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation" ON public.optimization_cycles FOR ALL
USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation" ON public.optimization_actions FOR ALL
USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation" ON public.optimization_action_results FOR ALL
USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================
CREATE TRIGGER set_tenants_updated_at BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_accounts_updated_at BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_spine_contacts_updated_at BEFORE UPDATE ON public.spine_contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_opportunities_updated_at BEFORE UPDATE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_spine_campaigns_updated_at BEFORE UPDATE ON public.spine_campaigns
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_spine_campaign_channels_updated_at BEFORE UPDATE ON public.spine_campaign_channels
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_optimization_actions_updated_at BEFORE UPDATE ON public.optimization_actions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();