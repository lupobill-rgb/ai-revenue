-- Fix STEP 3/4: Add service_role RLS policies for optimization tables
CREATE POLICY service_role_full_access_actions
ON optimization_actions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY service_role_full_access_results
ON optimization_action_results
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix STEP 6: Replace broken get_weekly_cfo_snapshot function
-- The issue is jsonb_array_length being called on text[] instead of jsonb
DROP FUNCTION IF EXISTS get_weekly_cfo_snapshot();

CREATE OR REPLACE FUNCTION public.get_weekly_cfo_snapshot()
RETURNS TABLE(
  tenant_id uuid,
  tenant_name text,
  cfo_enabled boolean,
  payback_months numeric,
  cac_blended numeric,
  gross_margin_pct numeric,
  contribution_margin_pct numeric,
  revenue_per_fte numeric,
  sales_efficiency_ratio numeric,
  econ_actions_total bigint,
  econ_actions_improved bigint,
  econ_actions_hurt bigint,
  cfo_gates_triggered bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_start_date date := CURRENT_DATE - INTERVAL '7 days';
BEGIN
  RETURN QUERY
  WITH econ_metrics AS (
    SELECT
      ms.tenant_id,
      ms.metric_id,
      ms.value,
      ms.date,
      ROW_NUMBER() OVER (
        PARTITION BY ms.tenant_id, ms.metric_id
        ORDER BY ms.date DESC
      ) AS rn
    FROM metric_snapshots_daily ms
    WHERE ms.date BETWEEN v_start_date AND v_today
      AND ms.metric_id IN (
        'payback_months',
        'gross_margin_pct',
        'contribution_margin_pct',
        'cac_blended',
        'revenue_per_fte',
        'sales_efficiency_ratio'
      )
  ),
  latest_econ AS (
    SELECT
      em.tenant_id,
      em.metric_id,
      em.value
    FROM econ_metrics em
    WHERE em.rn = 1
  ),
  econ_actions AS (
    SELECT
      ar.tenant_id,
      ar.metric_id,
      ar.delta_direction,
      ar.delta,
      oa.id AS action_id,
      oa.owner_subsystem,
      oa.type,
      oa.status,
      ar.observation_end_date
    FROM optimization_action_results ar
    JOIN optimization_actions oa
      ON oa.id = ar.optimization_action_id
    WHERE ar.observation_end_date::date BETWEEN v_start_date AND v_today
      AND ar.metric_id IN (
        'payback_months',
        'gross_margin_pct',
        'contribution_margin_pct',
        'cac_blended',
        'revenue_per_fte',
        'sales_efficiency_ratio'
      )
  ),
  econ_action_rollup AS (
    SELECT
      ea.tenant_id,
      COUNT(*) AS econ_actions_total,
      COUNT(*) FILTER (
        WHERE ea.metric_id IN ('payback_months', 'cac_blended')
          AND ea.delta_direction = 'decrease'
      ) + 
      COUNT(*) FILTER (
        WHERE ea.metric_id IN (
          'gross_margin_pct',
          'contribution_margin_pct',
          'revenue_per_fte',
          'sales_efficiency_ratio'
        )
        AND ea.delta_direction = 'increase'
      ) AS econ_actions_improved,
      COUNT(*) FILTER (
        WHERE ea.metric_id IN ('payback_months', 'cac_blended')
          AND ea.delta_direction = 'increase'
      ) +
      COUNT(*) FILTER (
        WHERE ea.metric_id IN (
          'gross_margin_pct',
          'contribution_margin_pct',
          'revenue_per_fte',
          'sales_efficiency_ratio'
        )
        AND ea.delta_direction = 'decrease'
      ) AS econ_actions_hurt
    FROM econ_actions ea
    GROUP BY ea.tenant_id
  ),
  cfo_gates AS (
    SELECT
      oc.tenant_id,
      COUNT(*) AS gates_triggered
    FROM optimization_cycles oc
    WHERE oc.invoked_at >= v_start_date
      AND oc.cfo_gates_active IS NOT NULL
      AND (
        -- Handle both jsonb array and text[] cases
        CASE 
          WHEN pg_typeof(oc.cfo_gates_active) = 'jsonb'::regtype THEN
            jsonb_array_length(oc.cfo_gates_active) > 0
          ELSE
            array_length(oc.cfo_gates_active::text[], 1) > 0
        END
      )
    GROUP BY oc.tenant_id
  )
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    COALESCE((t.config->>'cfo_expansion_enabled')::boolean, t.cfo_expansion_enabled) AS cfo_enabled,
    MAX(CASE WHEN le.metric_id = 'payback_months' THEN le.value END) AS payback_months,
    MAX(CASE WHEN le.metric_id = 'cac_blended' THEN le.value END) AS cac_blended,
    MAX(CASE WHEN le.metric_id = 'gross_margin_pct' THEN le.value END) AS gross_margin_pct,
    MAX(CASE WHEN le.metric_id = 'contribution_margin_pct' THEN le.value END) AS contribution_margin_pct,
    MAX(CASE WHEN le.metric_id = 'revenue_per_fte' THEN le.value END) AS revenue_per_fte,
    MAX(CASE WHEN le.metric_id = 'sales_efficiency_ratio' THEN le.value END) AS sales_efficiency_ratio,
    COALESCE(ea.econ_actions_total, 0) AS econ_actions_total,
    COALESCE(ea.econ_actions_improved, 0) AS econ_actions_improved,
    COALESCE(ea.econ_actions_hurt, 0) AS econ_actions_hurt,
    COALESCE(cg.gates_triggered, 0) AS cfo_gates_triggered
  FROM tenants t
  LEFT JOIN latest_econ le ON le.tenant_id = t.id
  LEFT JOIN econ_action_rollup ea ON ea.tenant_id = t.id
  LEFT JOIN cfo_gates cg ON cg.tenant_id = t.id
  WHERE t.status = 'active'
  GROUP BY
    t.id,
    t.name,
    t.config,
    t.cfo_expansion_enabled,
    ea.econ_actions_total,
    ea.econ_actions_improved,
    ea.econ_actions_hurt,
    cg.gates_triggered
  ORDER BY t.name;
END;
$$;