import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

// =====================================================
// REVENUE OS ACTION EXECUTOR
// Executes pending optimization actions and records baselines
// =====================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { tenant_id, action_id, operation } = await req.json();

    if (operation === 'execute_pending') {
      // Find and execute pending actions
      const results = await executePendingActions(supabase, tenant_id);
      return new Response(JSON.stringify({ success: true, results }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (operation === 'record_baseline') {
      // Record baseline for an action being executed
      await recordActionBaseline(supabase, tenant_id, action_id);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (operation === 'evaluate_results') {
      // Evaluate actions that have completed their observation window
      const results = await evaluateActionResults(supabase, tenant_id);
      return new Response(JSON.stringify({ success: true, results }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (operation === 'abort_action') {
      // Abort a specific action
      await abortAction(supabase, action_id);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (operation === 'acknowledge_action') {
      // Human acknowledges action - allows execution to proceed
      const { user_id } = await req.json();
      await acknowledgeAction(supabase, action_id, user_id);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown operation' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Revenue OS Action Executor error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function executePendingActions(supabase: any, tenantId?: string) {
  // Get pending actions (excludes pending_acknowledgment which need human approval)
  let query = supabase
    .from('optimization_actions')
    .select('*, optimization_cycles(tenant_id)')
    .eq('status', 'pending')
    .order('priority_rank', { ascending: true })
    .limit(10);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data: actions, error } = await query;
  if (error) throw error;

  const results: { action_id: string; status: string; error?: string; requires_ack?: boolean }[] = [];

  for (const action of actions || []) {
    // Skip actions that require acknowledgment but haven't been acknowledged
    if (action.requires_acknowledgment && !action.acknowledged_at) {
      results.push({ 
        action_id: action.action_id, 
        status: 'awaiting_acknowledgment',
        requires_ack: true 
      });
      continue;
    }

    try {
      // Snapshot metric state BEFORE execution for auditability
      const contextSnapshot = await captureContextSnapshot(supabase, action.tenant_id, action.target_metric);
      
      // Execute based on action type
      const executed = await executeAction(supabase, action);
      
      if (executed) {
        // Update status to executing
        await supabase
          .from('optimization_actions')
          .update({ status: 'executing', updated_at: new Date().toISOString() })
          .eq('id', action.id);

        // Record baseline metrics WITH context snapshot
        await recordActionBaseline(supabase, action.tenant_id, action.id, contextSnapshot);
        
        results.push({ action_id: action.action_id, status: 'executing' });
      } else {
        results.push({ action_id: action.action_id, status: 'skipped' });
      }
    } catch (err) {
      await supabase
        .from('optimization_actions')
        .update({ 
          status: 'failed', 
          updated_at: new Date().toISOString(),
          notes_for_humans: `Execution failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        })
        .eq('id', action.id);
      
      results.push({ 
        action_id: action.action_id, 
        status: 'failed', 
        error: err instanceof Error ? err.message : 'Unknown error' 
      });
    }
  }

  return results;
}

// Capture full metric state before execution for CFO audit trail
async function captureContextSnapshot(supabase: any, tenantId: string, targetMetric: string): Promise<Record<string, any>> {
  const keyMetrics = [
    targetMetric,
    'cac_blended', 'cac_paid', 'payback_months', 'gross_margin_pct',
    'pipeline_total', 'bookings_count', 'roas_paid', 'spend_paid_total'
  ];

  const { data: metrics } = await supabase
    .from('metric_snapshots_daily')
    .select('metric_id, value, date')
    .eq('tenant_id', tenantId)
    .in('metric_id', keyMetrics)
    .order('date', { ascending: false })
    .limit(keyMetrics.length * 3); // Last 3 days for trend

  // Build snapshot with latest values and 3-day trend
  const snapshot: Record<string, any> = {
    captured_at: new Date().toISOString(),
    metrics: {},
  };

  const latestByMetric = new Map<string, any[]>();
  for (const m of metrics || []) {
    if (!latestByMetric.has(m.metric_id)) {
      latestByMetric.set(m.metric_id, []);
    }
    latestByMetric.get(m.metric_id)!.push({ value: m.value, date: m.date });
  }

  for (const [metricId, values] of latestByMetric) {
    const sorted = values.sort((a, b) => b.date.localeCompare(a.date));
    snapshot.metrics[metricId] = {
      current: sorted[0]?.value,
      trend_3d: sorted.map(v => ({ date: v.date, value: v.value })),
    };
  }

  return snapshot;
}

async function executeAction(supabase: any, action: any): Promise<boolean> {
  const config = action.config || {};
  
  switch (action.type) {
    case 'config_change':
      // Apply configuration changes
      return await applyConfigChange(supabase, action.tenant_id, action.owner_subsystem, config);

    case 'experiment':
      // Set up experiment tracking
      return await setupExperiment(supabase, action.tenant_id, action);

    case 'data_correction':
      // Log alert for data team
      console.log(`[DATA_CORRECTION] Tenant ${action.tenant_id}: ${config.description}`);
      return true;

    case 'alert':
      // Log alert
      console.log(`[ALERT] Tenant ${action.tenant_id}: ${config.description}`);
      return true;

    case 'forecast_update':
      // Update forecast models
      return true;

    default:
      console.log(`Unknown action type: ${action.type}`);
      return false;
  }
}

async function applyConfigChange(supabase: any, tenantId: string, subsystem: string, config: any): Promise<boolean> {
  switch (subsystem) {
    case 'campaigns':
      // Update campaign/channel configurations
      if (config.parameters?.budget_increase_pct) {
        // Find active campaigns and adjust budget
        const { data: channels } = await supabase
          .from('spine_campaign_channels')
          .select('id, daily_budget')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .limit(5);

        if (channels) {
          for (const channel of channels) {
            const newBudget = channel.daily_budget * (1 + config.parameters.budget_increase_pct / 100);
            await supabase
              .from('spine_campaign_channels')
              .update({ daily_budget: newBudget })
              .eq('id', channel.id);
          }
        }
      }
      return true;

    case 'crm':
      // Update CRM/sequence configurations
      console.log(`[CRM_CONFIG] Applying: ${JSON.stringify(config)}`);
      return true;

    case 'pricing':
      // Log pricing change for manual review (high-risk)
      console.log(`[PRICING_CONFIG] Requires manual review: ${JSON.stringify(config)}`);
      return true;

    case 'routing':
      // Update routing rules
      console.log(`[ROUTING_CONFIG] Applying: ${JSON.stringify(config)}`);
      return true;

    default:
      return true;
  }
}

async function setupExperiment(supabase: any, tenantId: string, action: any): Promise<boolean> {
  const guardrails = action.guardrails || {};
  
  // Create experiment tracking record
  console.log(`[EXPERIMENT] Setting up: ${action.action_id}`);
  console.log(`  - Hypothesis: ${action.hypothesis}`);
  console.log(`  - Target metric: ${action.target_metric}`);
  console.log(`  - Observation window: ${action.expected_observation_window_days} days`);
  console.log(`  - Max exposure: ${guardrails.max_exposure_percent || 100}%`);
  console.log(`  - Abort conditions: ${JSON.stringify(guardrails.abort_conditions)}`);

  return true;
}

async function recordActionBaseline(supabase: any, tenantId: string, actionId: string, contextSnapshot?: Record<string, any>) {
  // Get the action details
  const { data: action } = await supabase
    .from('optimization_actions')
    .select('target_metric, optimization_cycle_id')
    .eq('id', actionId)
    .single();

  if (!action) return;

  // Get the cycle's learning plan for supporting metrics
  const { data: cycle } = await supabase
    .from('optimization_cycles')
    .select('raw_kernel_output')
    .eq('id', action.optimization_cycle_id)
    .single();

  const learningPlan = cycle?.raw_kernel_output?.learning_plan || {};
  const metricsToTrack = [action.target_metric, ...(learningPlan.metrics_to_monitor || [])];

  // Get latest values for each metric
  const { data: latestMetrics } = await supabase
    .from('metric_snapshots_daily')
    .select('metric_id, value, date')
    .eq('tenant_id', tenantId)
    .in('metric_id', metricsToTrack)
    .order('date', { ascending: false });

  // Record baseline for each metric
  const latestByMetric = new Map<string, { value: number; date: string }>();
  for (const m of latestMetrics || []) {
    if (!latestByMetric.has(m.metric_id)) {
      latestByMetric.set(m.metric_id, { value: m.value, date: m.date });
    }
  }

  const baselineRecords = Array.from(latestByMetric.entries()).map(([metricId, data]) => ({
    tenant_id: tenantId,
    optimization_action_id: actionId,
    metric_id: metricId,
    baseline_value: data.value,
    observation_start_date: new Date().toISOString().split('T')[0],
    // Include full context snapshot for auditability
    context_snapshot: contextSnapshot || null,
  }));

  if (baselineRecords.length > 0) {
    await supabase
      .from('optimization_action_results')
      .insert(baselineRecords);
  }
}

async function evaluateActionResults(supabase: any, tenantId?: string) {
  // Find executing actions past their observation window
  let query = supabase
    .from('optimization_actions')
    .select('*')
    .eq('status', 'executing');

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data: actions } = await query;
  const results: { action_id: string; outcome: string; delta?: number }[] = [];

  for (const action of actions || []) {
    // Check if observation window has passed
    const windowDays = action.expected_observation_window_days || 14;
    const actionStarted = new Date(action.updated_at);
    const windowEnd = new Date(actionStarted.getTime() + windowDays * 86400000);

    if (new Date() < windowEnd) {
      continue; // Not ready yet
    }

    // Get baseline and current values
    const { data: resultRecords } = await supabase
      .from('optimization_action_results')
      .select('*')
      .eq('optimization_action_id', action.id)
      .eq('metric_id', action.target_metric);

    if (!resultRecords || resultRecords.length === 0) {
      results.push({ action_id: action.action_id, outcome: 'no_baseline' });
      continue;
    }

    const baseline = resultRecords[0];

    // Get latest metric value
    const { data: latestMetric } = await supabase
      .from('metric_snapshots_daily')
      .select('value, date')
      .eq('tenant_id', action.tenant_id)
      .eq('metric_id', action.target_metric)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (!latestMetric) {
      results.push({ action_id: action.action_id, outcome: 'no_current_data' });
      continue;
    }

    // Calculate delta
    const delta = latestMetric.value - baseline.baseline_value;
    const deltaDirection = delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'neutral';
    
    // Determine if successful based on target direction
    const isSuccess = (
      (action.target_direction === 'increase' && delta > 0) ||
      (action.target_direction === 'decrease' && delta < 0) ||
      (action.target_direction === 'stabilize' && Math.abs(delta) < baseline.baseline_value * 0.05)
    );

    // Get economic deltas for CFO learning loop
    const economicMetrics = ['cac_blended', 'payback_months', 'gross_margin_pct', 'revenue_per_fte'];
    const { data: economicSnapshots } = await supabase
      .from('metric_snapshots_daily')
      .select('metric_id, value')
      .eq('tenant_id', action.tenant_id)
      .in('metric_id', economicMetrics)
      .order('date', { ascending: false })
      .limit(economicMetrics.length);

    // Fetch prior results for this action to compute economic deltas
    const { data: priorResultsData } = await supabase
      .from('optimization_action_results')
      .select('metric_id, baseline_value')
      .eq('action_id', action.id);

    const economicDeltas: Record<string, number> = {};
    for (const es of economicSnapshots || []) {
      const baselineEcon = (priorResultsData || []).find((r: any) => r.metric_id === es.metric_id);
      if (baselineEcon?.baseline_value) {
        economicDeltas[`delta_${es.metric_id}`] = es.value - baselineEcon.baseline_value;
      }
    }

    // Update the result record with economic deltas
    await supabase
      .from('optimization_action_results')
      .update({
        observation_end_date: new Date().toISOString().split('T')[0],
        observed_value: latestMetric.value,
        delta,
        delta_direction: deltaDirection,
        confidence: 0.7,
        economic_deltas: economicDeltas, // CFO learning signal
      })
      .eq('id', baseline.id);

    // Update action status
    await supabase
      .from('optimization_actions')
      .update({
        status: isSuccess ? 'completed' : 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', action.id);

    results.push({
      action_id: action.action_id,
      outcome: isSuccess ? 'success' : 'failed',
      delta,
    });
  }

  return results;
}

async function abortAction(supabase: any, actionId: string) {
  await supabase
    .from('optimization_actions')
    .update({
      status: 'aborted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', actionId);
}

// Human acknowledges an action - transitions from pending_acknowledgment to pending
async function acknowledgeAction(supabase: any, actionId: string, userId?: string) {
  const { error } = await supabase
    .from('optimization_actions')
    .update({
      status: 'pending',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', actionId)
    .eq('status', 'pending_acknowledgment'); // Only acknowledge if still pending

  if (error) throw error;
  
  console.log(`[ACTION ACKNOWLEDGED] Action ${actionId} acknowledged by user ${userId || 'unknown'}`);
}