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
  ltv_cac_ratio: { target: 3.0, direction: 'higher_is_better', domain: 'economics' },
};

// Data quality thresholds
const DATA_QUALITY_CONFIG = {
  max_staleness_hours: 48,
  required_metrics: ['pipeline_total', 'bookings_count', 'cac_blended', 'payback_months'],
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
      // 4. Identify binding constraint
      bindingConstraint = identifyBindingConstraint(inputBundle.metrics, inputBundle.tenantConfig);

      // 5. Generate action candidates
      const candidates = generateActionCandidates(bindingConstraint, inputBundle, trigger);

      // 6. Filter and rank (top 3-7)
      actions = filterAndRankActions(candidates, inputBundle.activeActions);
    }

    // 7. Build kernel output
    const kernelOutput = {
      tenant_id,
      cycle_summary: {
        binding_constraint: bindingConstraint.constraint,
        diagnosis: buildDiagnosis(bindingConstraint, inputBundle.metrics),
        priority_metric: bindingConstraint.priority_metric,
        supporting_metrics: bindingConstraint.supporting_metrics,
      },
      actions,
      data_quality_actions: dataQualityActions,
      learning_plan: buildLearningPlan(actions, bindingConstraint),
    };

    // 8. Persist optimization cycle
    const durationMs = Date.now() - startTime;
    const cycleId = await persistOptimizationCycle(supabase, tenant_id, kernelOutput, trigger, durationMs);

    // 9. Persist optimization actions
    if (actions.length > 0) {
      await persistOptimizationActions(supabase, tenant_id, cycleId, actions);
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
  const [metricsResult, revenueEventsResult, activitiesResult, campaignsResult, activeActionsResult, tenantResult] = await Promise.all([
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
  ]);

  return {
    metrics: metricsResult.data || [],
    revenueEvents: revenueEventsResult.data || [],
    activities: activitiesResult.data || [],
    campaigns: campaignsResult.data || [],
    activeActions: activeActionsResult.data || [],
    tenantConfig: tenantResult.data?.config || {},
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

function identifyBindingConstraint(metrics: MetricSnapshot[], tenantConfig: Record<string, unknown>): BindingConstraint {
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
  trigger: TriggerCondition
): Action[] {
  const candidates: Action[] = [];
  const timestamp = Date.now();

  // Generate lens-specific actions based on constraint
  if (constraint.constraint === 'demand') {
    // CMO lens actions
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

function filterAndRankActions(candidates: Action[], activeActions: any[]): Action[] {
  // Remove duplicates with active actions
  const activeActionTypes = new Set(activeActions.map(a => a.action_id?.split('_').slice(0, -1).join('_')));
  
  const filtered = candidates.filter(c => {
    const actionType = c.action_id.split('_').slice(0, -1).join('_');
    return !activeActionTypes.has(actionType);
  });

  // Sort by priority and take top N
  return filtered
    .sort((a, b) => a.priority_rank - b.priority_rank)
    .slice(0, MAX_ACTIONS_PER_CYCLE);
}

function buildDiagnosis(constraint: BindingConstraint, metrics: MetricSnapshot[]): string {
  const trendText = constraint.trend === 'improving' ? 'showing improvement' : 
                    constraint.trend === 'degrading' ? 'declining' : 'stable';
  
  const gapText = constraint.gap_to_target_pct > 0 
    ? `${Math.round(constraint.gap_to_target_pct)}% below target` 
    : 'on target';

  return `Primary constraint: ${constraint.constraint}. ` +
         `Key metric ${constraint.priority_metric} is ${gapText} and ${trendText}. ` +
         `Focus optimization efforts on ${constraint.constraint} improvements.`;
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
  durationMs: number
): Promise<string> {
  const { data, error } = await supabase
    .from('optimization_cycles')
    .insert({
      tenant_id: tenantId,
      invoked_at: new Date().toISOString(),
      binding_constraint: output.cycle_summary.binding_constraint,
      priority_metric_id: output.cycle_summary.priority_metric,
      input_snapshot_ref: { trigger },
      raw_kernel_output: output,
      duration_ms: durationMs,
      status: 'completed',
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function persistOptimizationActions(
  supabase: any,
  tenantId: string,
  cycleId: string,
  actions: Action[]
): Promise<void> {
  const rows = actions.map(action => ({
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
    status: 'pending',
    expected_observation_window_days: action.expected_observation_window_days,
    notes_for_humans: action.notes_for_humans,
  }));

  const { error } = await supabase
    .from('optimization_actions')
    .insert(rows);

  if (error) throw error;
}