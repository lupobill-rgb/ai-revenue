import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify internal secret for cron authorization
    const internalSecret = req.headers.get('x-internal-secret');
    const expectedSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
    
    if (!internalSecret || internalSecret !== expectedSecret) {
      console.error('[revenue-os-daily-cron] Unauthorized: invalid or missing x-internal-secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[revenue-os-daily-cron] Starting daily kernel cycles...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all tenants with Revenue OS enabled
    const { data: enabledTenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, revenue_os_enabled, cfo_expansion_enabled')
      .eq('revenue_os_enabled', true)
      .eq('status', 'active');

    if (tenantsError) {
      throw new Error(`Failed to fetch enabled tenants: ${tenantsError.message}`);
    }

    if (!enabledTenants || enabledTenants.length === 0) {
      console.log('[revenue-os-daily-cron] No tenants with revenue_os_enabled=true');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No enabled tenants',
        cycles_created: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[revenue-os-daily-cron] Found ${enabledTenants.length} enabled tenant(s)`);

    const results: Array<{
      tenant_id: string;
      tenant_name: string;
      success: boolean;
      cycle_id?: string;
      actions_count?: number;
      error?: string;
    }> = [];

    // Run kernel cycle for each enabled tenant
    for (const tenant of enabledTenants) {
      console.log(`[revenue-os-daily-cron] Running cycle for tenant: ${tenant.name} (${tenant.id})`);

      try {
        // Check if we already ran a cycle today for this tenant
        const today = new Date().toISOString().split('T')[0];
        const { data: existingCycle } = await supabase
          .from('optimization_cycles')
          .select('id')
          .eq('tenant_id', tenant.id)
          .gte('invoked_at', `${today}T00:00:00Z`)
          .lt('invoked_at', `${today}T23:59:59Z`)
          .limit(1)
          .maybeSingle();

        if (existingCycle) {
          console.log(`[revenue-os-daily-cron] Cycle already exists today for ${tenant.name}, skipping`);
          results.push({
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            success: true,
            cycle_id: existingCycle.id,
            error: 'Cycle already exists for today',
          });
          continue;
        }

        // Fetch targets for this tenant
        const { data: targets } = await supabase
          .from('tenant_targets')
          .select('*')
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        // Fetch recent metrics for this tenant
        const { data: metrics } = await supabase
          .from('metric_snapshots_daily')
          .select('metric_id, value, date')
          .eq('tenant_id', tenant.id)
          .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('date', { ascending: false });

        // Fetch recent action results for learning
        const { data: recentResults } = await supabase
          .from('optimization_action_results')
          .select('*, optimization_actions(*)')
          .eq('tenant_id', tenant.id)
          .gte('observation_end_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('observation_end_date', { ascending: false })
          .limit(20);

        // Determine CFO gates
        const cfoGates: string[] = [];
        if (tenant.cfo_expansion_enabled && targets) {
          const paybackMetric = metrics?.find(m => m.metric_id === 'payback_months');
          const marginMetric = metrics?.find(m => m.metric_id === 'gross_margin_pct');

          if (paybackMetric && targets.target_payback_months) {
            if (paybackMetric.value > targets.target_payback_months * 1.1) {
              cfoGates.push('payback_exceeded');
            }
          }

          if (marginMetric && targets.margin_floor_pct) {
            if (marginMetric.value < targets.margin_floor_pct) {
              cfoGates.push('margin_below_floor');
            }
          }

          if (targets.cash_risk_tolerance === 'low') {
            cfoGates.push('cash_constrained');
          }
        }

        // Create the optimization cycle
        const { data: cycle, error: cycleError } = await supabase
          .from('optimization_cycles')
          .insert({
            tenant_id: tenant.id,
            trigger_type: 'scheduled',
            trigger_id: `daily-cron-${today}`,
            invoked_at: new Date().toISOString(),
            cfo_gates_active: cfoGates.length > 0 ? cfoGates : null,
          })
          .select()
          .single();

        if (cycleError) {
          throw new Error(`Failed to create cycle: ${cycleError.message}`);
        }

        // Generate 3-7 actions based on metrics and targets
        const actionsToCreate = generateActions(tenant.id, cycle.id, metrics || [], targets, cfoGates, recentResults || []);

        if (actionsToCreate.length > 0) {
          const { error: actionsError } = await supabase
            .from('optimization_actions')
            .insert(actionsToCreate);

          if (actionsError) {
            throw new Error(`Failed to create actions: ${actionsError.message}`);
          }
        }

        console.log(`[revenue-os-daily-cron] Created cycle ${cycle.id} with ${actionsToCreate.length} actions for ${tenant.name}`);

        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          success: true,
          cycle_id: cycle.id,
          actions_count: actionsToCreate.length,
        });

      } catch (tenantError) {
        console.error(`[revenue-os-daily-cron] Error for tenant ${tenant.name}:`, tenantError);
        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          success: false,
          error: tenantError instanceof Error ? tenantError.message : 'Unknown error',
        });
      }
    }

    // Log the cron run
    const successCount = results.filter(r => r.success && !r.error?.includes('already exists')).length;
    const totalActions = results.reduce((sum, r) => sum + (r.actions_count || 0), 0);

    console.log(`[revenue-os-daily-cron] Completed: ${successCount}/${enabledTenants.length} tenants, ${totalActions} total actions`);

    return new Response(JSON.stringify({
      success: true,
      tenants_processed: enabledTenants.length,
      cycles_created: successCount,
      total_actions: totalActions,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[revenue-os-daily-cron] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Generate 3-7 optimization actions based on tenant state
 */
function generateActions(
  tenantId: string,
  cycleId: string,
  metrics: Array<{ metric_id: string; value: number; date: string }>,
  targets: any,
  cfoGates: string[],
  recentResults: any[]
): any[] {
  const actions: any[] = [];
  const now = new Date().toISOString();

  // Get latest value for each metric
  const latestMetrics: Record<string, number> = {};
  for (const m of metrics) {
    if (!latestMetrics[m.metric_id]) {
      latestMetrics[m.metric_id] = m.value;
    }
  }

  // Identify failed actions to avoid repeating
  const failedActionTypes = new Set(
    recentResults
      .filter(r => r.delta_direction === 'decrease' && ['payback_months', 'cac_blended'].includes(r.metric_id))
      .concat(recentResults.filter(r => r.delta_direction === 'increase' && !['payback_months', 'cac_blended'].includes(r.metric_id)))
      .map(r => r.optimization_actions?.type)
      .filter(Boolean)
  );

  // Priority 1: If payback is high, focus on efficiency
  if (cfoGates.includes('payback_exceeded') && !failedActionTypes.has('improve_conversion_rate')) {
    actions.push({
      tenant_id: tenantId,
      cycle_id: cycleId,
      owner_subsystem: 'crm',
      type: 'improve_conversion_rate',
      target_metric: 'payback_months',
      guardrails: { max_budget_change_pct: 0, require_ab_test: true },
      observation_window_days: 14,
      status: 'pending',
      priority_rank: 1,
      cfo_score: 0.9,
      created_at: now,
    });
  }

  // Priority 2: If margin is low, focus on pricing
  if (cfoGates.includes('margin_below_floor') && !failedActionTypes.has('optimize_pricing')) {
    actions.push({
      tenant_id: tenantId,
      cycle_id: cycleId,
      owner_subsystem: 'pricing',
      type: 'optimize_pricing',
      target_metric: 'gross_margin_pct',
      guardrails: { max_price_change_pct: 5, require_ab_test: true },
      observation_window_days: 21,
      status: 'pending',
      priority_rank: 2,
      cfo_score: 0.85,
      created_at: now,
    });
  }

  // Priority 3: Pipeline improvement (if not cash constrained)
  if (!cfoGates.includes('cash_constrained') && !failedActionTypes.has('increase_pipeline')) {
    actions.push({
      tenant_id: tenantId,
      cycle_id: cycleId,
      owner_subsystem: 'campaigns',
      type: 'increase_pipeline',
      target_metric: 'pipeline_total',
      guardrails: { max_budget_increase_pct: 10, daily_spend_cap: 500 },
      observation_window_days: 14,
      status: 'pending',
      priority_rank: 3,
      cfo_score: 0.7,
      created_at: now,
    });
  }

  // Priority 4: Win rate optimization
  if (!failedActionTypes.has('improve_win_rate')) {
    actions.push({
      tenant_id: tenantId,
      cycle_id: cycleId,
      owner_subsystem: 'crm',
      type: 'improve_win_rate',
      target_metric: 'win_rate',
      guardrails: { require_ab_test: false },
      observation_window_days: 21,
      status: 'pending',
      priority_rank: 4,
      cfo_score: 0.65,
      created_at: now,
    });
  }

  // Priority 5: Sales cycle reduction
  if (!failedActionTypes.has('reduce_sales_cycle')) {
    actions.push({
      tenant_id: tenantId,
      cycle_id: cycleId,
      owner_subsystem: 'crm',
      type: 'reduce_sales_cycle',
      target_metric: 'avg_sales_cycle_days',
      guardrails: { require_ab_test: false },
      observation_window_days: 30,
      status: 'pending',
      priority_rank: 5,
      cfo_score: 0.6,
      created_at: now,
    });
  }

  // Ensure we have at least 3 actions
  if (actions.length < 3) {
    const fallbackActions = [
      {
        type: 'optimize_email_cadence',
        target_metric: 'reply_rate',
        owner_subsystem: 'campaigns',
        guardrails: { require_ab_test: true },
        observation_window_days: 7,
        cfo_score: 0.5,
      },
      {
        type: 'improve_lead_scoring',
        target_metric: 'qualified_opps_created',
        owner_subsystem: 'crm',
        guardrails: { require_ab_test: false },
        observation_window_days: 14,
        cfo_score: 0.55,
      },
    ];

    for (const fallback of fallbackActions) {
      if (actions.length >= 3) break;
      if (!failedActionTypes.has(fallback.type)) {
        actions.push({
          tenant_id: tenantId,
          cycle_id: cycleId,
          owner_subsystem: fallback.owner_subsystem,
          type: fallback.type,
          target_metric: fallback.target_metric,
          guardrails: fallback.guardrails,
          observation_window_days: fallback.observation_window_days,
          status: 'pending',
          priority_rank: actions.length + 1,
          cfo_score: fallback.cfo_score,
          created_at: now,
        });
      }
    }
  }

  // Cap at 7 actions
  return actions.slice(0, 7);
}
