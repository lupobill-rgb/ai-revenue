-- Create RPC function for portfolio-level CFO summary
CREATE OR REPLACE FUNCTION public.get_weekly_cfo_portfolio_summary()
RETURNS TABLE (
  tenants_active bigint,
  avg_payback_months numeric,
  avg_cac_blended numeric,
  avg_gross_margin_pct numeric,
  avg_contribution_margin_pct numeric,
  avg_revenue_per_fte numeric,
  avg_sales_efficiency_ratio numeric,
  total_econ_actions bigint,
  total_econ_actions_improved bigint,
  total_econ_actions_hurt bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) AS tenants_active,
    AVG(payback_months) AS avg_payback_months,
    AVG(cac_blended) AS avg_cac_blended,
    AVG(gross_margin_pct) AS avg_gross_margin_pct,
    AVG(contribution_margin_pct) AS avg_contribution_margin_pct,
    AVG(revenue_per_fte) AS avg_revenue_per_fte,
    AVG(sales_efficiency_ratio) AS avg_sales_efficiency_ratio,
    SUM(econ_actions_total) AS total_econ_actions,
    SUM(econ_actions_improved) AS total_econ_actions_improved,
    SUM(econ_actions_hurt) AS total_econ_actions_hurt
  FROM get_weekly_cfo_snapshot();
$$;