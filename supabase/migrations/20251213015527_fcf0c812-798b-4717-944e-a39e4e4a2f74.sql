-- Create weekly_cfo_snapshot RPC function (per-tenant snapshot)
CREATE OR REPLACE FUNCTION public.weekly_cfo_snapshot()
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  payback_months numeric,
  cac_blended numeric,
  gross_margin_pct numeric,
  contribution_margin_pct numeric,
  revenue_per_fte numeric,
  sales_efficiency_ratio numeric,
  econ_actions_total integer,
  econ_actions_improved integer,
  econ_actions_hurt integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH date_bounds AS (
    SELECT
      CURRENT_DATE AS today,
      CURRENT_DATE - INTERVAL '7 days' AS start_date
  ),
  econ_metrics AS (
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
    JOIN date_bounds d
      ON ms.date BETWEEN d.start_date AND d.today
    WHERE ms.metric_id IN (
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
      tenant_id,
      metric_id,
      value
    FROM econ_metrics
    WHERE rn = 1
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
    JOIN date_bounds d
      ON ar.observation_end_date::date BETWEEN d.start_date AND d.today
    WHERE ar.metric_id IN (
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
      COUNT(*)::integer AS econ_actions_total,
      COUNT(*) FILTER (
        WHERE ea.metric_id IN ('payback_months', 'cac_blended')
          AND ea.delta_direction = 'decrease'
      )::integer AS econ_actions_improved_low_better,
      COUNT(*) FILTER (
        WHERE ea.metric_id IN ('payback_months', 'cac_blended')
          AND ea.delta_direction = 'increase'
      )::integer AS econ_actions_hurt_low_better,
      COUNT(*) FILTER (
        WHERE ea.metric_id IN (
          'gross_margin_pct',
          'contribution_margin_pct',
          'revenue_per_fte',
          'sales_efficiency_ratio'
        )
        AND ea.delta_direction = 'increase'
      )::integer AS econ_actions_improved_high_better,
      COUNT(*) FILTER (
        WHERE ea.metric_id IN (
          'gross_margin_pct',
          'contribution_margin_pct',
          'revenue_per_fte',
          'sales_efficiency_ratio'
        )
        AND ea.delta_direction = 'decrease'
      )::integer AS econ_actions_hurt_high_better
    FROM econ_actions ea
    GROUP BY ea.tenant_id
  )
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    MAX(CASE WHEN le.metric_id = 'payback_months' THEN le.value END) AS payback_months,
    MAX(CASE WHEN le.metric_id = 'cac_blended' THEN le.value END) AS cac_blended,
    MAX(CASE WHEN le.metric_id = 'gross_margin_pct' THEN le.value END) AS gross_margin_pct,
    MAX(CASE WHEN le.metric_id = 'contribution_margin_pct' THEN le.value END) AS contribution_margin_pct,
    MAX(CASE WHEN le.metric_id = 'revenue_per_fte' THEN le.value END) AS revenue_per_fte,
    MAX(CASE WHEN le.metric_id = 'sales_efficiency_ratio' THEN le.value END) AS sales_efficiency_ratio,
    COALESCE(ea.econ_actions_total, 0)::integer AS econ_actions_total,
    (COALESCE(ea.econ_actions_improved_low_better, 0)
      + COALESCE(ea.econ_actions_improved_high_better, 0))::integer
      AS econ_actions_improved,
    (COALESCE(ea.econ_actions_hurt_low_better, 0)
      + COALESCE(ea.econ_actions_hurt_high_better, 0))::integer
      AS econ_actions_hurt
  FROM tenants t
  LEFT JOIN latest_econ le
    ON le.tenant_id = t.id
  LEFT JOIN econ_action_rollup ea
    ON ea.tenant_id = t.id
  WHERE t.status = 'active'
  GROUP BY
    t.id,
    t.name,
    ea.econ_actions_total,
    ea.econ_actions_improved_low_better,
    ea.econ_actions_improved_high_better,
    ea.econ_actions_hurt_low_better,
    ea.econ_actions_hurt_high_better
  ORDER BY t.name;
$$;