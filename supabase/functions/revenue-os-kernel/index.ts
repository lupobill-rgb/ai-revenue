import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

// =====================================================
// REVENUE OS KERNEL - Optimization Loop Implementation
// =====================================================

interface TriggerCondition {
  type: 'scheduled' | 'metric_deviation' | 'lifecycle_event';
  source: string;
  threshold_exceeded?: boolean;
  metric_id?: string;
  deviation_pct?: number;
}

interface KernelInput {
  tenant_id: string;
  trigger: TriggerCondition;
  config?: {
    metric_window_days?: number;
    min_cycle_separation_hours?: number;
    deep_cycle?: boolean;
  };
}

interface MetricSnapshot {
  metric_id: string;
  value: number;
  date: string;
  dimension?: Record<string, unknown>;
}

interface BindingConstraint {
  constraint: 'demand' | 'conversion' | 'economics' | 'data_quality';
  gap_to_target_pct: number;
  trend: 'improving' | 'degrading' | 'flat';
  priority_metric: string;
  supporting_metrics: string[];
}

interface Action {
  action_id: string;
  priority_rank: number;
  owner_subsystem: 'campaigns' | 'crm' | 'routing' | 'pricing' | 'lifecycle' | 'data';
  lens_emphasis: 'cmo' | 'cro' | 'cfo' | 'blended';
  type: 'data_correction' | 'experiment' | 'config_change' | 'alert' | 'forecast_update';
  target_metric: string;
  target_direction: 'increase' | 'decrease' | 'stabilize';
  hypothesis: string;
  proposed_change: {
    description: string;
    scope: string;
    parameters: Record<string, unknown>;
  };
  guardrails: {
    max_additional_spend: number | null;
    min_sample_size: number | null;
    max_exposure_percent: number | null;
    abort_conditions: string[];
  };
  dependencies: string[];
  expected_observation_window_days: number;
  notes_for_humans: string;
}

// Canonical metric definitions with targets
const METRIC_TARGETS: Record<string, { target: number; direction: 'higher_is_better' | 'lower_is_better'; domain: 'demand' | 'conversion' | 'economics' }> = {
  pipeline_total: { target: 100000, direction: 'higher_is_better', domain: 'demand' },
  leads_qualified: { target: 50, direction: 'higher_is_better', domain: 'demand' },
  opps_created: { target: 20, direction: 'higher_is_better', domain: 'demand' },
  win_rate: { target: 0.25, direction: 'higher_is_better', domain: 'conversion' },
  sales_cycle_days: { target: 30, direction: 'lower_is_better', domain: 'conversion' },
  speed_to_lead_mins: { target: 5, direction: 'lower_is_better', domain: 'conversion' },
  bookings_count: { target: 10, direction: 'higher_is_better', domain: 'conversion' },
  cac_blended: { target: 500, direction: 'lower_is_better', domain: 'economics' },
  payback_months: { target: 12, direction: 'lower_is_better', domain: 'economics' },
  gross_margin_pct: { target: 0.70, direction: 'higher_is_better', domain: 'economics' },
  contribution_margin_pct: { target: 0.50, direction: 'higher_is_better', domain: 'economics' },
  ltv_cac_ratio: { target: 3.0, direction: 'higher_is_better', domain: 'economics' },
  revenue_per_fte: { target: 150000, direction: 'higher_is_better', domain: 'economics' },
  sales_efficiency_ratio: { target: 1.0, direction: 'higher_is_better', domain: 'economics' },
  cash_runway_months: { target: 12, direction: 'higher_is_better', domain: 'economics' },
};

// CFO Guardrails - configurable per tenant, these are defaults
interface CFOGuardrails {
  payback_target: number;
  payback_tolerance: number;
  margin_floor: number;
  cash_runway_threshold: number;
  max_cac: number | null;
  cash_risk_tolerance: 'low' | 'medium' | 'high';
}

const DEFAULT_CFO_GUARDRAILS: CFOGuardrails = {
  payback_target: 12,
  payback_tolerance: 3, // Allow up to target + 3 months
  margin_floor: 50, // 50% gross margin floor (stored as percentage in DB)
  cash_runway_threshold: 6, // 6 months minimum runway
  max_cac: null, // Optional per-segment CAC cap
  cash_risk_tolerance: 'medium',
};

// Data quality thresholds
const DATA_QUALITY_CONFIG = {
  max_staleness_hours: 48,
  required_metrics: ['pipeline_total', 'bookings_count', 'cac_blended', 'payback_months', 'gross_margin_pct'],
  min_data_points: 7,
};

// Minimum hours between cycles per tenant
const MIN_CYCLE_SEPARATION_HOURS = 12;
const MAX_ACTIONS_PER_CYCLE = 7;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const input: KernelInput = await req.json();
    const { tenant_id, trigger, config = {} } = input;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Check minimum cycle separation
    const canRunCycle = await checkCycleSeparation(supabase, tenant_id, config.min_cycle_separation_hours || MIN_CYCLE_SEPARATION_HOURS);
    if (!canRunCycle) {
      return new Response(JSON.stringify({
        skipped: true,
        reason: 'Minimum cycle separation not met',
        next_allowed_at: new Date(Date.now() + MIN_CYCLE_SEPARATION_HOURS * 3600000).toISOString(),
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Gather input bundle
    const metricWindowDays = config.metric_window_days || 30;
    const inputBundle = await gatherInputBundle(supabase, tenant_id, metricWindowDays);

    // 3. Validate data quality
    const dataQuality = validateDataQuality(inputBundle.metrics);
    
    // 4. Check if CFO expansion is enabled for this tenant
    const cfoExpansionEnabled = inputBundle.tenantConfig?.cfo_expansion_enabled === true;
    console.log(`[Revenue OS] Tenant ${tenant_id}: CFO expansion ${cfoExpansionEnabled ? 'ENABLED' : 'DISABLED'}`);
    
    // 5. Get CFO guardrails (from tenant config or defaults)
    const cfoGuardrails: CFOGuardrails = {
      ...DEFAULT_CFO_GUARDRAILS,
      ...(inputBundle.tenantConfig?.cfo_guardrails || {}),
    };
    
    // 6. Evaluate CFO gates (only if expansion enabled, otherwise no gates)
    const cfoGates: CFOGateStatus = cfoExpansionEnabled 
      ? evaluateCFOGates(inputBundle.metrics, cfoGuardrails)
      : { 
          payback_gate_triggered: false, 
          margin_gate_triggered: false, 
          cash_runway_gate_triggered: false,
          suppress_demand_scaling: false,
          reduce_experiment_exposure: false,
          current_payback_months: null,
          current_margin_pct: null,
          current_runway_months: null,
        };
    
    let bindingConstraint: BindingConstraint;
    let actions: Action[] = [];
    let dataQualityActions: { field: string; issue: string; impact: string; recommended_fix: string }[] = [];

    if (dataQuality.issues.length > 0) {
      // Data quality issues - emit only data_correction actions
      bindingConstraint = {
        constraint: 'data_quality',
        gap_to_target_pct: 0,
        trend: 'flat',
        priority_metric: 'data_coverage_pct',
        supporting_metrics: ['data_freshness_hrs'],
      };
      dataQualityActions = dataQuality.issues;
      actions = generateDataCorrectionActions(dataQuality.issues);
    } else {
      // 6. Identify binding constraint (CFO gates may override)
      bindingConstraint = identifyBindingConstraint(inputBundle.metrics, inputBundle.tenantConfig, cfoGates);

      // 7. Generate action candidates with CFO gating
      const candidates = generateActionCandidates(bindingConstraint, inputBundle, trigger, cfoGates);

      // 8. Score with CFO weights and filter
      const scored = scoreActionsWithCFOWeights(candidates, cfoGates, inputBundle.priorResults);
      
      // 9. Filter and rank (top 3-7)
      actions = filterAndRankActions(scored, inputBundle.activeActions, cfoGates);
    }

    // 10. Build kernel output
    const kernelOutput = {
      tenant_id,
      cycle_summary: {
        binding_constraint: bindingConstraint.constraint,
        diagnosis: buildDiagnosis(bindingConstraint, inputBundle.metrics, cfoGates),
        priority_metric: bindingConstraint.priority_metric,
        supporting_metrics: bindingConstraint.supporting_metrics,
        cfo_gates_active: Object.entries(cfoGates).filter(([_, v]) => v === true).map(([k]) => k),
      },
      actions,
      data_quality_actions: dataQualityActions,
      learning_plan: buildLearningPlan(actions, bindingConstraint),
    };

    // 11. Persist optimization cycle
    const durationMs = Date.now() - startTime;
    const cycleId = await persistOptimizationCycle(supabase, tenant_id, kernelOutput, trigger, durationMs, cfoGates);

    // 12. Persist optimization actions
    if (actions.length > 0) {
      await persistOptimizationActions(supabase, tenant_id, cycleId, actions, inputBundle.tenantActivatedAt);
    }

    return new Response(JSON.stringify({
      success: true,
      cycle_id: cycleId,
      ...kernelOutput,
      duration_ms: durationMs,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Revenue OS Kernel error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// =====================================================
// CFO GATING FUNCTIONS
// =====================================================

interface CFOGateStatus {
  payback_gate_triggered: boolean;
  margin_gate_triggered: boolean;
  cash_runway_gate_triggered: boolean;
  suppress_demand_scaling: boolean;
  reduce_experiment_exposure: boolean;
  current_payback_months: number | null;
  current_margin_pct: number | null;
  current_runway_months: number | null;
}

function evaluateCFOGates(metrics: MetricSnapshot[], guardrails: CFOGuardrails): CFOGateStatus {
  const latestByMetric = new Map<string, number>();
  for (const m of metrics) {
    if (!latestByMetric.has(m.metric_id)) {
      latestByMetric.set(m.metric_id, m.value);
    }
  }

  const paybackMonths = latestByMetric.get('payback_months') ?? null;
  const marginPct = latestByMetric.get('gross_margin_pct') ?? null;
  const runwayMonths = latestByMetric.get('cash_runway_months') ?? null;

  const paybackGateTriggered = paybackMonths !== null && 
    paybackMonths > guardrails.payback_target + guardrails.payback_tolerance;
  
  const marginGateTriggered = marginPct !== null && 
    marginPct < guardrails.margin_floor;
  
  const cashRunwayGateTriggered = runwayMonths !== null && 
    runwayMonths < guardrails.cash_runway_threshold;

  return {
    payback_gate_triggered: paybackGateTriggered,
    margin_gate_triggered: marginGateTriggered,
    cash_runway_gate_triggered: cashRunwayGateTriggered,
    suppress_demand_scaling: paybackGateTriggered || marginGateTriggered,
    reduce_experiment_exposure: cashRunwayGateTriggered || guardrails.cash_risk_tolerance === 'low',
    current_payback_months: paybackMonths,
    current_margin_pct: marginPct,
    current_runway_months: runwayMonths,
  };
}

// CFO-weighted action scoring
interface ScoredAction extends Action {
  cfo_score: number;
}

function scoreActionsWithCFOWeights(
  candidates: Action[], 
  gates: CFOGateStatus,
  priorResults: any[]
): ScoredAction[] {
  // Build map of action types that failed in prior cycles
  const failedActionTypes = new Set<string>();
  for (const result of priorResults) {
    if (result.delta_direction === 'decrease' && result.optimization_actions?.target_direction === 'increase') {
      const actionType = result.optimization_actions?.action_id?.split('_').slice(0, 2).join('_');
      if (actionType) failedActionTypes.add(actionType);
    }
    if (result.delta_direction === 'increase' && result.optimization_actions?.target_direction === 'decrease') {
      const actionType = result.optimization_actions?.action_id?.split('_').slice(0, 2).join('_');
      if (actionType) failedActionTypes.add(actionType);
    }
  }

  return candidates.map(action => {
    let revenue_impact_weight = 0.5;
    let payback_improvement_weight = 0;
    let margin_protection_weight = 0;
    let cash_risk_penalty = 0;

    // Revenue impact based on target metric
    if (['pipeline_total', 'bookings_count', 'opps_created'].includes(action.target_metric)) {
      revenue_impact_weight = 1.0;
    } else if (['win_rate', 'leads_qualified'].includes(action.target_metric)) {
      revenue_impact_weight = 0.8;
    }

    // Payback improvement for efficiency actions
    if (['payback_months', 'cac_blended', 'ltv_cac_ratio'].includes(action.target_metric)) {
      payback_improvement_weight = 1.0;
    } else if (action.lens_emphasis === 'cfo') {
      payback_improvement_weight = 0.5;
    }

    // Margin protection
    if (['gross_margin_pct', 'contribution_margin_pct'].includes(action.target_metric)) {
      margin_protection_weight = 1.0;
    } else if (action.owner_subsystem === 'pricing') {
      margin_protection_weight = 0.7;
    }

    // Cash risk based on spend and experiment type
    if (action.guardrails.max_additional_spend && action.guardrails.max_additional_spend > 1000) {
      cash_risk_penalty = 0.5;
    }
    if (action.type === 'experiment' && action.guardrails.max_exposure_percent && action.guardrails.max_exposure_percent > 30) {
      cash_risk_penalty += 0.3;
    }

    // Penalize repeating failed experiments
    const actionType = action.action_id.split('_').slice(0, 2).join('_');
    if (failedActionTypes.has(actionType)) {
      cash_risk_penalty += 1.0;
    }

    // Calculate CFO-weighted score
    const cfo_score = 
      (revenue_impact_weight * 1.0) +
      (payback_improvement_weight * 1.5) +
      (margin_protection_weight * 1.3) -
      (cash_risk_penalty * 2.0);

    return { ...action, cfo_score };
  });
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function checkCycleSeparation(supabase: any, tenantId: string, minHours: number): Promise<boolean> {
  const threshold = new Date(Date.now() - minHours * 3600000).toISOString();
  
  const { data: recentCycles } = await supabase
    .from('optimization_cycles')
    .select('id, invoked_at')
    .eq('tenant_id', tenantId)
    .gte('invoked_at', threshold)
    .limit(1);

  return !recentCycles || recentCycles.length === 0;
}

async function gatherInputBundle(supabase: any, tenantId: string, windowDays: number) {
  const windowStart = new Date(Date.now() - windowDays * 86400000).toISOString().split('T')[0];

  // Parallel queries for efficiency
  const [metricsResult, revenueEventsResult, activitiesResult, campaignsResult, activeActionsResult, tenantResult, priorResultsResult] = await Promise.all([
    supabase.from('metric_snapshots_daily')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', windowStart)
      .order('date', { ascending: false }),
    supabase.from('revenue_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('effective_date', windowStart),
    supabase.from('spine_crm_activities')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('occurred_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase.from('spine_campaigns')
      .select('*, spine_campaign_channels(*)')
      .eq('tenant_id', tenantId)
      .in('status', ['running', 'draft']),
    supabase.from('optimization_actions')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'scheduled', 'executing']),
    supabase.from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single(),
    // Get prior action results for learning loop
    supabase.from('optimization_action_results')
      .select('*, optimization_actions(*)')
      .eq('tenant_id', tenantId)
      .order('observation_end_date', { ascending: false })
      .limit(50),
  ]);

  // Merge config JSONB with direct columns for CFO expansion
  const tenantData = tenantResult.data;
  const mergedConfig = {
    ...(tenantData?.config || {}),
    cfo_expansion_enabled: tenantData?.cfo_expansion_enabled === true,
  };

  return {
    metrics: metricsResult.data || [],
    revenueEvents: revenueEventsResult.data || [],
    activities: activitiesResult.data || [],
    campaigns: campaignsResult.data || [],
    activeActions: activeActionsResult.data || [],
    tenantConfig: mergedConfig,
    priorResults: priorResultsResult.data || [],
    tenantActivatedAt: tenantData?.revenue_os_activated_at 
      ? new Date(tenantData.revenue_os_activated_at) 
      : null,
  };
}

function validateDataQuality(metrics: MetricSnapshot[]): { valid: boolean; issues: { field: string; issue: string; impact: string; recommended_fix: string }[] } {
  const issues: { field: string; issue: string; impact: string; recommended_fix: string }[] = [];
  const latestByMetric = new Map<string, MetricSnapshot>();

  // Get latest value for each metric
  for (const m of metrics) {
    const existing = latestByMetric.get(m.metric_id);
    if (!existing || new Date(m.date) > new Date(existing.date)) {
      latestByMetric.set(m.metric_id, m);
    }
  }

  // Check required metrics
  for (const requiredMetric of DATA_QUALITY_CONFIG.required_metrics) {
    const latest = latestByMetric.get(requiredMetric);
    if (!latest) {
      issues.push({
        field: requiredMetric,
        issue: 'missing',
        impact: `Cannot compute ${requiredMetric} for optimization decisions`,
        recommended_fix: `Configure data pipeline to populate ${requiredMetric} in metric_snapshots_daily`,
      });
    } else {
      // Check staleness
      const hoursOld = (Date.now() - new Date(latest.date).getTime()) / 3600000;
      if (hoursOld > DATA_QUALITY_CONFIG.max_staleness_hours) {
        issues.push({
          field: requiredMetric,
          issue: 'stale',
          impact: `${requiredMetric} data is ${Math.round(hoursOld)} hours old, may lead to incorrect decisions`,
          recommended_fix: `Ensure analytics job runs at least every ${DATA_QUALITY_CONFIG.max_staleness_hours} hours`,
        });
      }
    }
  }

  // Check minimum data points
  const uniqueDates = new Set(metrics.map(m => m.date));
  if (uniqueDates.size < DATA_QUALITY_CONFIG.min_data_points) {
    issues.push({
      field: 'data_coverage',
      issue: 'inconsistent',
      impact: `Only ${uniqueDates.size} days of data available, need ${DATA_QUALITY_CONFIG.min_data_points} for reliable trends`,
      recommended_fix: 'Wait for more data to accumulate or backfill historical metrics',
    });
  }

  return { valid: issues.length === 0, issues };
}

function identifyBindingConstraint(metrics: MetricSnapshot[], tenantConfig: Record<string, unknown>, cfoGates: CFOGateStatus): BindingConstraint {
  const latestByMetric = new Map<string, MetricSnapshot>();
  const trendByMetric = new Map<string, 'improving' | 'degrading' | 'flat'>();

  // Get latest and compute trends
  for (const m of metrics) {
    const existing = latestByMetric.get(m.metric_id);
    if (!existing || new Date(m.date) > new Date(existing.date)) {
      latestByMetric.set(m.metric_id, m);
    }
  }

  // Compute trends (compare latest week to previous week)
  for (const [metricId, latest] of latestByMetric) {
    const metricData = metrics.filter(m => m.metric_id === metricId).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (metricData.length >= 14) {
      const recentAvg = metricData.slice(0, 7).reduce((sum, m) => sum + m.value, 0) / 7;
      const priorAvg = metricData.slice(7, 14).reduce((sum, m) => sum + m.value, 0) / 7;
      const change = (recentAvg - priorAvg) / (priorAvg || 1);
      trendByMetric.set(metricId, change > 0.05 ? 'improving' : change < -0.05 ? 'degrading' : 'flat');
    } else {
      trendByMetric.set(metricId, 'flat');
    }
  }

  // Calculate gaps for each domain
  const domainGaps: Record<'demand' | 'conversion' | 'economics', { gap: number; metric: string; trend: 'improving' | 'degrading' | 'flat' }> = {
    demand: { gap: 0, metric: 'pipeline_total', trend: 'flat' },
    conversion: { gap: 0, metric: 'win_rate', trend: 'flat' },
    economics: { gap: 0, metric: 'payback_months', trend: 'flat' },
  };

  for (const [metricId, config] of Object.entries(METRIC_TARGETS)) {
    const latest = latestByMetric.get(metricId);
    if (!latest) continue;

    let gap: number;
    if (config.direction === 'higher_is_better') {
      gap = ((config.target - latest.value) / config.target) * 100;
    } else {
      gap = ((latest.value - config.target) / config.target) * 100;
    }

    if (gap > domainGaps[config.domain].gap) {
      domainGaps[config.domain] = {
        gap,
        metric: metricId,
        trend: trendByMetric.get(metricId) || 'flat',
      };
    }
  }

  // Find binding constraint (largest weighted gap)
  const weights = { demand: 1.0, conversion: 1.2, economics: 1.5 }; // Economics weighted higher
  let bindingDomain: 'demand' | 'conversion' | 'economics' = 'demand';
  let maxWeightedGap = 0;

  for (const [domain, data] of Object.entries(domainGaps) as ['demand' | 'conversion' | 'economics', typeof domainGaps.demand][]) {
    const weightedGap = data.gap * weights[domain];
    if (weightedGap > maxWeightedGap) {
      maxWeightedGap = weightedGap;
      bindingDomain = domain;
    }
  }

  const supporting = Object.entries(METRIC_TARGETS)
    .filter(([_, config]) => config.domain === bindingDomain)
    .map(([id]) => id)
    .filter(id => id !== domainGaps[bindingDomain].metric)
    .slice(0, 3);

  return {
    constraint: bindingDomain,
    gap_to_target_pct: domainGaps[bindingDomain].gap,
    trend: domainGaps[bindingDomain].trend,
    priority_metric: domainGaps[bindingDomain].metric,
    supporting_metrics: supporting,
  };
}

function generateActionCandidates(
  constraint: BindingConstraint,
  inputBundle: any,
  trigger: TriggerCondition,
  cfoGates: CFOGateStatus
): Action[] {
  const candidates: Action[] = [];
  const timestamp = Date.now();

  // CFO gate check: suppress demand scaling if triggered
  const suppressDemandScaling = cfoGates.suppress_demand_scaling;
  const reduceExperimentExposure = cfoGates.reduce_experiment_exposure;

  // Generate lens-specific actions based on constraint
  if (constraint.constraint === 'demand' && !suppressDemandScaling) {
    // CMO lens actions - only if CFO gates allow scaling
    candidates.push({
      action_id: `increase_channel_budget_${timestamp}`,
      priority_rank: 1,
      owner_subsystem: 'campaigns',
      lens_emphasis: 'cmo',
      type: 'experiment',
      target_metric: 'leads_qualified',
      target_direction: 'increase',
      hypothesis: 'Increasing budget on top-performing channel will generate more qualified leads',
      proposed_change: {
        description: 'Increase daily budget by 20% on highest-converting channel',
        scope: 'channel',
        parameters: { budget_increase_pct: 20 },
      },
      guardrails: {
        max_additional_spend: 1000,
        min_sample_size: 100,
        max_exposure_percent: 30,
        abort_conditions: ['CAC > 2x target for 3 days', 'Lead quality score < 50%'],
      },
      dependencies: [],
      expected_observation_window_days: 14,
      notes_for_humans: 'Monitor lead quality alongside volume to ensure CAC stays healthy',
    });

    candidates.push({
      action_id: `adjust_icp_targeting_${timestamp}`,
      priority_rank: 2,
      owner_subsystem: 'campaigns',
      lens_emphasis: 'cmo',
      type: 'config_change',
      target_metric: 'opps_created',
      target_direction: 'increase',
      hypothesis: 'Refining ICP targeting will improve lead-to-opportunity conversion',
      proposed_change: {
        description: 'Narrow targeting to top 2 performing segments',
        scope: 'segment',
        parameters: { focus_segments: ['enterprise', 'mid'] },
      },
      guardrails: {
        max_additional_spend: null,
        min_sample_size: 50,
        max_exposure_percent: 100,
        abort_conditions: ['Lead volume drops > 40%'],
      },
      dependencies: [],
      expected_observation_window_days: 21,
      notes_for_humans: 'Trade-off: volume may decrease but quality should improve',
    });
  }

  if (constraint.constraint === 'conversion') {
    // CRO lens actions
    candidates.push({
      action_id: `optimize_follow_up_cadence_${timestamp}`,
      priority_rank: 1,
      owner_subsystem: 'crm',
      lens_emphasis: 'cro',
      type: 'experiment',
      target_metric: 'speed_to_lead_mins',
      target_direction: 'decrease',
      hypothesis: 'Faster initial follow-up will increase connection rates',
      proposed_change: {
        description: 'Reduce target response time from 30 mins to 5 mins for inbound leads',
        scope: 'routing',
        parameters: { target_response_mins: 5 },
      },
      guardrails: {
        max_additional_spend: null,
        min_sample_size: 30,
        max_exposure_percent: 50,
        abort_conditions: ['Agent burnout indicators', 'Quality score drops'],
      },
      dependencies: [],
      expected_observation_window_days: 14,
      notes_for_humans: 'May require additional SDR capacity or automation',
    });

    candidates.push({
      action_id: `ab_test_sequence_${timestamp}`,
      priority_rank: 2,
      owner_subsystem: 'crm',
      lens_emphasis: 'cro',
      type: 'experiment',
      target_metric: 'win_rate',
      target_direction: 'increase',
      hypothesis: 'Shorter, value-focused sequences will improve reply rates',
      proposed_change: {
        description: 'Test 5-step sequence vs current 8-step sequence',
        scope: 'sequence',
        parameters: { variant: 'short_sequence', steps: 5 },
      },
      guardrails: {
        max_additional_spend: null,
        min_sample_size: 100,
        max_exposure_percent: 50,
        abort_conditions: ['Reply rate < 5%', 'Unsubscribe rate > 3%'],
      },
      dependencies: [],
      expected_observation_window_days: 21,
      notes_for_humans: 'Split traffic 50/50 between control and variant',
    });
  }

  if (constraint.constraint === 'economics') {
    // CFO lens actions
    candidates.push({
      action_id: `reduce_low_roi_spend_${timestamp}`,
      priority_rank: 1,
      owner_subsystem: 'campaigns',
      lens_emphasis: 'cfo',
      type: 'config_change',
      target_metric: 'cac_blended',
      target_direction: 'decrease',
      hypothesis: 'Cutting spend on low-ROI channels will improve blended CAC',
      proposed_change: {
        description: 'Reduce budget by 50% on channels with CAC > 2x target',
        scope: 'channel',
        parameters: { reduction_pct: 50, threshold_multiplier: 2 },
      },
      guardrails: {
        max_additional_spend: null,
        min_sample_size: null,
        max_exposure_percent: null,
        abort_conditions: ['Pipeline drops > 30%'],
      },
      dependencies: [],
      expected_observation_window_days: 30,
      notes_for_humans: 'Monitor pipeline impact carefully - may need to reallocate rather than cut',
    });

    candidates.push({
      action_id: `optimize_payback_${timestamp}`,
      priority_rank: 2,
      owner_subsystem: 'pricing',
      lens_emphasis: 'cfo',
      type: 'experiment',
      target_metric: 'payback_months',
      target_direction: 'decrease',
      hypothesis: 'Offering annual prepay discount will accelerate cash collection',
      proposed_change: {
        description: 'Test 15% annual prepay discount for new customers',
        scope: 'pricing',
        parameters: { discount_pct: 15, term: 'annual' },
      },
      guardrails: {
        max_additional_spend: null,
        min_sample_size: 20,
        max_exposure_percent: 30,
        abort_conditions: ['Conversion drops > 20%', 'LTV impact > 10%'],
      },
      dependencies: [],
      expected_observation_window_days: 45,
      notes_for_humans: 'Track impact on both conversion and long-term retention',
    });
  }

  // Always add a blended diagnostic action
  candidates.push({
    action_id: `diagnostic_deep_dive_${timestamp}`,
    priority_rank: candidates.length + 1,
    owner_subsystem: 'data',
    lens_emphasis: 'blended',
    type: 'alert',
    target_metric: constraint.priority_metric,
    target_direction: 'stabilize',
    hypothesis: 'Deep analysis will reveal root cause of constraint',
    proposed_change: {
      description: `Investigate ${constraint.priority_metric} performance across segments`,
      scope: 'analysis',
      parameters: { constraint: constraint.constraint },
    },
    guardrails: {
      max_additional_spend: null,
      min_sample_size: null,
      max_exposure_percent: null,
      abort_conditions: [],
    },
    dependencies: [],
    expected_observation_window_days: 7,
    notes_for_humans: 'Review findings before implementing major changes',
  });

  return candidates;
}

function generateDataCorrectionActions(issues: { field: string; issue: string; impact: string; recommended_fix: string }[]): Action[] {
  return issues.slice(0, 3).map((issue, idx) => ({
    action_id: `data_fix_${issue.field}_${Date.now()}`,
    priority_rank: idx + 1,
    owner_subsystem: 'data' as const,
    lens_emphasis: 'blended' as const,
    type: 'data_correction' as const,
    target_metric: issue.field,
    target_direction: 'stabilize' as const,
    hypothesis: `Fixing ${issue.issue} data will enable accurate optimization`,
    proposed_change: {
      description: issue.recommended_fix,
      scope: 'data_pipeline',
      parameters: { issue_type: issue.issue },
    },
    guardrails: {
      max_additional_spend: null,
      min_sample_size: null,
      max_exposure_percent: null,
      abort_conditions: [],
    },
    dependencies: [],
    expected_observation_window_days: 3,
    notes_for_humans: issue.impact,
  }));
}

function filterAndRankActions(candidates: ScoredAction[], activeActions: any[], cfoGates: CFOGateStatus): Action[] {
  // Remove duplicates with active actions
  const activeActionTypes = new Set(activeActions.map(a => a.action_id?.split('_').slice(0, -1).join('_')));
  
  let filtered = candidates.filter(c => {
    const actionType = c.action_id.split('_').slice(0, -1).join('_');
    return !activeActionTypes.has(actionType);
  });

  // Apply CFO experiment exposure reduction
  if (cfoGates.reduce_experiment_exposure) {
    filtered = filtered.map(a => {
      if (a.type === 'experiment' && a.guardrails.max_exposure_percent && a.guardrails.max_exposure_percent > 10) {
        return {
          ...a,
          guardrails: { ...a.guardrails, max_exposure_percent: 10 },
          notes_for_humans: `${a.notes_for_humans} [CFO: Exposure reduced due to cash runway concerns]`,
        };
      }
      return a;
    });
  }

  // Sort by CFO score (highest first) then priority
  return filtered
    .sort((a, b) => (b.cfo_score || 0) - (a.cfo_score || 0) || a.priority_rank - b.priority_rank)
    .slice(0, MAX_ACTIONS_PER_CYCLE);
}

function buildDiagnosis(constraint: BindingConstraint, metrics: MetricSnapshot[], cfoGates: CFOGateStatus): string {
  const trendText = constraint.trend === 'improving' ? 'showing improvement' : 
                    constraint.trend === 'degrading' ? 'declining' : 'stable';
  
  const gapText = constraint.gap_to_target_pct > 0 
    ? `${Math.round(constraint.gap_to_target_pct)}% below target` 
    : 'on target';

  let cfoNote = '';
  if (cfoGates.payback_gate_triggered) {
    cfoNote += ` [CFO GATE: Payback ${cfoGates.current_payback_months?.toFixed(1)}mo exceeds threshold - demand scaling suppressed]`;
  }
  if (cfoGates.margin_gate_triggered) {
    cfoNote += ` [CFO GATE: Margin ${((cfoGates.current_margin_pct || 0) * 100).toFixed(0)}% below floor - channel scaling blocked]`;
  }
  if (cfoGates.cash_runway_gate_triggered) {
    cfoNote += ` [CFO GATE: Cash runway ${cfoGates.current_runway_months?.toFixed(0)}mo below threshold - experiment exposure reduced]`;
  }

  return `Primary constraint: ${constraint.constraint}. ` +
         `Key metric ${constraint.priority_metric} is ${gapText} and ${trendText}. ` +
         `Focus optimization efforts on ${constraint.constraint} improvements.${cfoNote}`;
}

function buildLearningPlan(actions: Action[], constraint: BindingConstraint) {
  const metricsToMonitor = [constraint.priority_metric, ...constraint.supporting_metrics];
  
  const expectedIfSuccess: Record<string, { direction: string; rough_magnitude: string }> = {};
  for (const action of actions) {
    expectedIfSuccess[action.target_metric] = {
      direction: action.target_direction,
      rough_magnitude: action.type === 'experiment' ? 'medium' : 'small',
    };
  }

  return {
    metrics_to_monitor: metricsToMonitor,
    next_cycle_trigger: actions.some(a => a.type === 'experiment') ? 'min_sample_reached' : '7d_elapsed',
    expected_if_success: expectedIfSuccess,
    fallback_play: `If ${constraint.priority_metric} doesn't improve, escalate to manual review and consider alternative interventions`,
  };
}

async function persistOptimizationCycle(
  supabase: any,
  tenantId: string,
  output: any,
  trigger: TriggerCondition,
  durationMs: number,
  cfoGates: CFOGateStatus
): Promise<string> {
  const { data, error } = await supabase
    .from('optimization_cycles')
    .insert({
      tenant_id: tenantId,
      invoked_at: new Date().toISOString(),
      binding_constraint: output.cycle_summary.binding_constraint,
      priority_metric_id: output.cycle_summary.priority_metric,
      input_snapshot_ref: { trigger, cfo_gates: cfoGates },
      raw_kernel_output: output,
      duration_ms: durationMs,
      status: 'completed',
      cfo_gates_active: output.cycle_summary.cfo_gates_active || [],
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// Actions that require human acknowledgment in first 30 days
const HIGH_RISK_ACTION_TYPES = ['experiment', 'config_change'];
const HIGH_RISK_SUBSYSTEMS = ['pricing', 'campaigns'];

function requiresAcknowledgment(action: Action, tenantActivatedAt: Date | null): boolean {
  // Always require acknowledgment for pricing changes
  if (action.owner_subsystem === 'pricing') return true;
  
  // Require acknowledgment if action increases spend
  if (action.proposed_change?.parameters?.budget_increase_pct) return true;
  
  // Require acknowledgment for experiments with spend
  if (action.type === 'experiment' && action.guardrails?.max_additional_spend) return true;
  
  // Within first 30 days: require acknowledgment for high-risk actions
  if (tenantActivatedAt) {
    const daysSinceActivation = (Date.now() - tenantActivatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActivation <= 30) {
      return HIGH_RISK_ACTION_TYPES.includes(action.type) && 
             HIGH_RISK_SUBSYSTEMS.includes(action.owner_subsystem);
    }
  }
  
  return false;
}

async function persistOptimizationActions(
  supabase: any,
  tenantId: string,
  cycleId: string,
  actions: Action[],
  tenantActivatedAt: Date | null
): Promise<void> {
  const rows = actions.map(action => {
    const needsAck = requiresAcknowledgment(action, tenantActivatedAt);
    return {
      tenant_id: tenantId,
      optimization_cycle_id: cycleId,
      action_id: action.action_id,
      priority_rank: action.priority_rank,
      owner_subsystem: action.owner_subsystem,
      lens_emphasis: action.lens_emphasis,
      type: action.type,
      target_metric: action.target_metric,
      target_direction: action.target_direction,
      hypothesis: action.hypothesis,
      config: action.proposed_change,
      guardrails: action.guardrails,
      status: needsAck ? 'pending_acknowledgment' : 'pending',
      requires_acknowledgment: needsAck,
      expected_observation_window_days: action.expected_observation_window_days,
      notes_for_humans: needsAck 
        ? `${action.notes_for_humans} [REQUIRES HUMAN ACKNOWLEDGMENT]`
        : action.notes_for_humans,
    };
  });

  const { error } = await supabase
    .from('optimization_actions')
    .insert(rows);

  if (error) throw error;
}