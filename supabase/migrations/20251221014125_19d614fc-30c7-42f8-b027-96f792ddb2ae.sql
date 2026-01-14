-- Create rollout phases table
CREATE TABLE public.rollout_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_number int NOT NULL,
  phase_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'blocked')),
  started_at timestamptz,
  completed_at timestamptz,
  tenant_filter jsonb DEFAULT '{}',
  required_duration_hours int DEFAULT 24,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Create gate checks table
CREATE TABLE public.rollout_gate_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid REFERENCES rollout_phases(id) ON DELETE CASCADE NOT NULL,
  gate_name text NOT NULL,
  gate_type text NOT NULL CHECK (gate_type IN ('zero_duplicates', 'sla_met', 'no_provider_failures', 'custom')),
  description text,
  check_query text,
  is_passed boolean DEFAULT false,
  last_checked_at timestamptz,
  check_result jsonb,
  required boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Create rollout tenant assignments table
CREATE TABLE public.rollout_tenant_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid REFERENCES rollout_phases(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid NOT NULL, -- Note: FK to tenants table omitted as it may not exist
  assigned_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'removed')),
  UNIQUE(phase_id, tenant_id)
);
-- Enable RLS
ALTER TABLE public.rollout_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rollout_gate_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rollout_tenant_assignments ENABLE ROW LEVEL SECURITY;
-- Platform admin policies
CREATE POLICY "Platform admins can manage rollout phases"
  ON public.rollout_phases FOR ALL USING (is_platform_admin());
CREATE POLICY "Platform admins can manage gate checks"
  ON public.rollout_gate_checks FOR ALL USING (is_platform_admin());
CREATE POLICY "Platform admins can manage tenant assignments"
  ON public.rollout_tenant_assignments FOR ALL USING (is_platform_admin());
-- Insert default phases
INSERT INTO public.rollout_phases (phase_number, phase_name, description, tenant_filter, required_duration_hours) VALUES
(1, 'Internal Testing', 'Internal tenants only (24-48 hrs)', '{"type": "internal"}', 24),
(2, 'Trusted Customers', '5-10 trusted customer tenants', '{"type": "trusted", "max_count": 10}', 48),
(3, 'Open Rollout', 'All tenants enabled', '{"type": "all"}', 0);
-- Insert default gates for each phase
INSERT INTO public.rollout_gate_checks (phase_id, gate_name, gate_type, description, required)
SELECT p.id, 'Zero Duplicates', 'zero_duplicates', 'No duplicate messages sent to same recipient within dedup window', true
FROM rollout_phases p;
INSERT INTO public.rollout_gate_checks (phase_id, gate_name, gate_type, description, required)
SELECT p.id, 'SLA Met', 'sla_met', 'All SLO targets met (p95 latency, success rate)', true
FROM rollout_phases p;
INSERT INTO public.rollout_gate_checks (phase_id, gate_name, gate_type, description, required)
SELECT p.id, 'No Provider Failures', 'no_provider_failures', 'No unexplained provider failures in the monitoring window', true
FROM rollout_phases p;
-- Function to check gate status
CREATE OR REPLACE FUNCTION public.check_rollout_gate(p_gate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gate rollout_gate_checks;
  v_result jsonb;
  v_passed boolean;
  v_phase_tenants uuid[];
BEGIN
  SELECT * INTO v_gate FROM rollout_gate_checks WHERE id = p_gate_id;
  IF v_gate IS NULL THEN RETURN jsonb_build_object('error', 'Gate not found'); END IF;
  
  SELECT array_agg(tenant_id) INTO v_phase_tenants
  FROM rollout_tenant_assignments WHERE phase_id = v_gate.phase_id AND status = 'active';
  
  CASE v_gate.gate_type
    WHEN 'zero_duplicates' THEN
      SELECT NOT EXISTS (
        SELECT 1 FROM channel_outbox co
        WHERE co.tenant_id = ANY(COALESCE(v_phase_tenants, ARRAY[]::uuid[]))
          AND co.created_at > now() - interval '24 hours'
        GROUP BY co.tenant_id, co.recipient_email, co.recipient_phone, co.channel
        HAVING count(*) > 1
      ) INTO v_passed;
      v_result := jsonb_build_object('passed', v_passed, 'message', CASE WHEN v_passed THEN 'No duplicates found' ELSE 'Duplicates detected' END);
      
    WHEN 'sla_met' THEN
      SELECT COALESCE(bool_and(
        (s.metrics->>'p95_latency_ms')::numeric <= 500 AND
        (s.metrics->>'success_rate')::numeric >= 0.99
      ), true) INTO v_passed
      FROM slo_snapshots s WHERE s.created_at > now() - interval '24 hours';
      v_result := jsonb_build_object('passed', v_passed, 'message', CASE WHEN v_passed THEN 'SLA targets met' ELSE 'SLA targets not met' END);
      
    WHEN 'no_provider_failures' THEN
      SELECT NOT EXISTS (
        SELECT 1 FROM channel_outbox co
        WHERE co.tenant_id = ANY(COALESCE(v_phase_tenants, ARRAY[]::uuid[]))
          AND co.status = 'failed'
          AND co.created_at > now() - interval '24 hours'
          AND co.error NOT LIKE '%rate limit%'
          AND co.error NOT LIKE '%invalid recipient%'
      ) INTO v_passed;
      v_result := jsonb_build_object('passed', v_passed, 'message', CASE WHEN v_passed THEN 'No unexplained failures' ELSE 'Unexplained failures detected' END);
      
    ELSE
      v_result := jsonb_build_object('passed', false, 'message', 'Unknown gate type');
      v_passed := false;
  END CASE;
  
  UPDATE rollout_gate_checks SET is_passed = v_passed, last_checked_at = now(), check_result = v_result WHERE id = p_gate_id;
  RETURN v_result;
END;
$$;
-- Function to advance rollout phase
CREATE OR REPLACE FUNCTION public.advance_rollout_phase(p_phase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phase rollout_phases;
  v_next_phase rollout_phases;
  v_all_gates_passed boolean;
  v_duration_met boolean;
BEGIN
  SELECT * INTO v_phase FROM rollout_phases WHERE id = p_phase_id;
  IF v_phase IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Phase not found'); END IF;
  IF v_phase.status != 'active' THEN RETURN jsonb_build_object('success', false, 'error', 'Phase is not active'); END IF;
  
  SELECT bool_and(is_passed) INTO v_all_gates_passed FROM rollout_gate_checks WHERE phase_id = p_phase_id AND required = true;
  IF NOT COALESCE(v_all_gates_passed, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not all required gates have passed');
  END IF;
  
  v_duration_met := v_phase.started_at IS NOT NULL AND 
    (now() - v_phase.started_at) >= (v_phase.required_duration_hours || ' hours')::interval;
  IF NOT v_duration_met THEN
    RETURN jsonb_build_object('success', false, 'error', format('Required duration not met. Started: %s, Required: %s hours', v_phase.started_at, v_phase.required_duration_hours));
  END IF;
  
  UPDATE rollout_phases SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = p_phase_id;
  
  SELECT * INTO v_next_phase FROM rollout_phases WHERE phase_number = v_phase.phase_number + 1;
  IF v_next_phase IS NOT NULL THEN
    UPDATE rollout_phases SET status = 'active', started_at = now(), updated_at = now() WHERE id = v_next_phase.id;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'completed_phase', v_phase.phase_name, 'next_phase', v_next_phase.phase_name);
END;
$$;
