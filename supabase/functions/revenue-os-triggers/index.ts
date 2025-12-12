import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

// =====================================================
// REVENUE OS TRIGGERS - Checks trigger conditions and invokes kernel
// =====================================================

interface TriggerConfig {
  // Time-based
  daily_cycle_hour_utc: number; // 0-23
  weekly_deep_cycle_day: number; // 0-6 (Sunday = 0)
  
  // Metric deviation thresholds
  cac_deviation_threshold_pct: number;
  payback_deviation_threshold_pct: number;
  pipeline_deviation_threshold_pct: number;
  bookings_deviation_threshold_pct: number;
  
  // Lifecycle triggers
  hours_after_campaign_launch: number;
  opps_created_threshold: number;
  completed_actions_threshold: number;
}

const DEFAULT_TRIGGER_CONFIG: TriggerConfig = {
  daily_cycle_hour_utc: 2,
  weekly_deep_cycle_day: 1, // Monday
  cac_deviation_threshold_pct: 20,
  payback_deviation_threshold_pct: 25,
  pipeline_deviation_threshold_pct: 15,
  bookings_deviation_threshold_pct: 20,
  hours_after_campaign_launch: 48,
  opps_created_threshold: 10,
  completed_actions_threshold: 5,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { check_type, tenant_id } = await req.json();

    // Get all active tenants if no specific tenant
    let tenantIds: string[] = [];
    if (tenant_id) {
      tenantIds = [tenant_id];
    } else {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id')
        .eq('status', 'active');
      tenantIds = (tenants || []).map(t => t.id);
    }

    const results: { tenant_id: string; triggered: boolean; trigger_type?: string; error?: string }[] = [];

    for (const tid of tenantIds) {
      try {
        const triggerResult = await checkTriggerConditions(supabase, tid, check_type);
        
        if (triggerResult.should_trigger) {
          // Invoke the kernel
          const { data, error } = await supabase.functions.invoke('revenue-os-kernel', {
            body: {
              tenant_id: tid,
              trigger: {
                type: triggerResult.trigger_type,
                source: triggerResult.source,
                threshold_exceeded: triggerResult.threshold_exceeded,
                metric_id: triggerResult.metric_id,
                deviation_pct: triggerResult.deviation_pct,
              },
              config: {
                deep_cycle: triggerResult.trigger_type === 'scheduled' && triggerResult.source === 'weekly',
              },
            },
          });

          if (error) {
            results.push({ tenant_id: tid, triggered: false, error: error.message });
          } else {
            results.push({ tenant_id: tid, triggered: true, trigger_type: triggerResult.trigger_type });
          }
        } else {
          results.push({ tenant_id: tid, triggered: false });
        }
      } catch (error) {
        results.push({ 
          tenant_id: tid, 
          triggered: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      tenants_checked: tenantIds.length,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Revenue OS Triggers error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

interface TriggerResult {
  should_trigger: boolean;
  trigger_type: 'scheduled' | 'metric_deviation' | 'lifecycle_event';
  source: string;
  threshold_exceeded?: boolean;
  metric_id?: string;
  deviation_pct?: number;
}

async function checkTriggerConditions(
  supabase: any, 
  tenantId: string,
  checkType?: string
): Promise<TriggerResult> {
  const config = DEFAULT_TRIGGER_CONFIG;
  const now = new Date();

  // 1. Time-based triggers
  if (!checkType || checkType === 'scheduled') {
    const currentHour = now.getUTCHours();
    const currentDay = now.getUTCDay();

    // Check weekly deep cycle (higher priority)
    if (currentDay === config.weekly_deep_cycle_day && currentHour === config.daily_cycle_hour_utc) {
      return {
        should_trigger: true,
        trigger_type: 'scheduled',
        source: 'weekly',
      };
    }

    // Check daily cycle
    if (currentHour === config.daily_cycle_hour_utc) {
      return {
        should_trigger: true,
        trigger_type: 'scheduled',
        source: 'daily',
      };
    }
  }

  // 2. Metric deviation triggers
  if (!checkType || checkType === 'metric_deviation') {
    const deviation = await checkMetricDeviations(supabase, tenantId, config);
    if (deviation) {
      return {
        should_trigger: true,
        trigger_type: 'metric_deviation',
        source: deviation.metric_id,
        threshold_exceeded: true,
        metric_id: deviation.metric_id,
        deviation_pct: deviation.deviation_pct,
      };
    }
  }

  // 3. Lifecycle triggers
  if (!checkType || checkType === 'lifecycle_event') {
    const lifecycle = await checkLifecycleTriggers(supabase, tenantId, config);
    if (lifecycle) {
      return {
        should_trigger: true,
        trigger_type: 'lifecycle_event',
        source: lifecycle.source,
      };
    }
  }

  return {
    should_trigger: false,
    trigger_type: 'scheduled',
    source: 'none',
  };
}

async function checkMetricDeviations(
  supabase: any,
  tenantId: string,
  config: TriggerConfig
): Promise<{ metric_id: string; deviation_pct: number } | null> {
  // Get latest metrics
  const { data: metrics } = await supabase
    .from('metric_snapshots_daily')
    .select('metric_id, value, date')
    .eq('tenant_id', tenantId)
    .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (!metrics || metrics.length === 0) return null;

  // Get targets (from tenant config or defaults)
  const targets: Record<string, { target: number; threshold: number; higher_is_better: boolean }> = {
    cac_blended: { target: 500, threshold: config.cac_deviation_threshold_pct, higher_is_better: false },
    payback_months: { target: 12, threshold: config.payback_deviation_threshold_pct, higher_is_better: false },
    pipeline_total: { target: 100000, threshold: config.pipeline_deviation_threshold_pct, higher_is_better: true },
    bookings_count: { target: 10, threshold: config.bookings_deviation_threshold_pct, higher_is_better: true },
  };

  // Check each metric
  for (const [metricId, targetConfig] of Object.entries(targets)) {
    const latestMetric = metrics.find((m: any) => m.metric_id === metricId);
    if (!latestMetric) continue;

    let deviationPct: number;
    if (targetConfig.higher_is_better) {
      deviationPct = ((targetConfig.target - latestMetric.value) / targetConfig.target) * 100;
    } else {
      deviationPct = ((latestMetric.value - targetConfig.target) / targetConfig.target) * 100;
    }

    if (deviationPct > targetConfig.threshold) {
      return { metric_id: metricId, deviation_pct: deviationPct };
    }
  }

  return null;
}

async function checkLifecycleTriggers(
  supabase: any,
  tenantId: string,
  config: TriggerConfig
): Promise<{ source: string } | null> {
  const hoursAgo = new Date(Date.now() - config.hours_after_campaign_launch * 3600000).toISOString();

  // Check for recently launched campaigns
  const { data: recentCampaigns } = await supabase
    .from('spine_campaigns')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'running')
    .gte('updated_at', hoursAgo)
    .limit(1);

  if (recentCampaigns && recentCampaigns.length > 0) {
    // Check if we already ran a cycle for this
    const { data: recentCycles } = await supabase
      .from('optimization_cycles')
      .select('id')
      .eq('tenant_id', tenantId)
      .gte('invoked_at', hoursAgo)
      .limit(1);

    if (!recentCycles || recentCycles.length === 0) {
      return { source: 'campaign_launch' };
    }
  }

  // Check for N new opportunities
  const periodStart = new Date(Date.now() - 24 * 3600000).toISOString();
  const { count: oppCount } = await supabase
    .from('opportunities')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', periodStart);

  if (oppCount && oppCount >= config.opps_created_threshold) {
    return { source: 'opportunities_surge' };
  }

  // Check for N completed actions with results
  const { count: completedCount } = await supabase
    .from('optimization_action_results')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());

  if (completedCount && completedCount >= config.completed_actions_threshold) {
    return { source: 'learning_ready' };
  }

  return null;
}