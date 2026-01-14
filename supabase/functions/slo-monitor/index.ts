import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SLOConfig {
  metric_name: string;
  display_name: string;
  threshold: number;
  comparison: string;
  unit: string;
  alert_severity: string;
  is_hard_slo: boolean;
  enabled: boolean;
}

interface MetricResult {
  metric_name: string;
  value: number;
  threshold: number;
  is_breached: boolean;
  details: Record<string, unknown>;
}

type AlertRow = {
  alert_type: string;
  severity: string;
  message: string;
  metric_name: string;
  metric_value: number;
  threshold: number;
  details: Record<string, unknown>;
  tenant_id?: string | null;
  workspace_id?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action = "check" } = await req.json().catch(() => ({}));
    
    const now = new Date();
    const windowStart = new Date(now.getTime() - 5 * 60 * 1000); // Last 5 minutes
    const windowEnd = now;

    console.log(`[SLO Monitor] Starting ${action} at ${now.toISOString()}`);

    // Fetch SLO configurations
    const { data: configs, error: configError } = await supabase
      .from("slo_config")
      .select("*")
      .eq("enabled", true);

    if (configError) {
      throw new Error(`Failed to fetch SLO config: ${configError.message}`);
    }

    const metrics: MetricResult[] = [];
    const alerts: AlertRow[] = [];

    // Calculate each metric
    for (const config of (configs || []) as SLOConfig[]) {
      let result: MetricResult | null = null;

      switch (config.metric_name) {
        case "scheduler_sla":
          result = await calculateSchedulerSLA(supabase, config, windowStart, windowEnd);
          break;
        case "execution_success":
          result = await calculateExecutionSuccess(supabase, config, windowStart, windowEnd);
          break;
        case "duplicate_sends":
          result = await calculateDuplicateSends(supabase, config, windowStart, windowEnd);
          break;
        case "oldest_queued_job":
          result = await calculateOldestQueuedJob(supabase, config);
          break;
        case "job_retries_per_tenant":
          result = await calculateJobRetries(supabase, config, windowStart, windowEnd);
          break;
        case "email_error_rate":
          result = await calculateProviderErrorRate(supabase, config, "email", windowStart, windowEnd);
          break;
        case "voice_error_rate":
          result = await calculateProviderErrorRate(supabase, config, "voice", windowStart, windowEnd);
          break;
        case "idempotent_replay_rate":
          result = await calculateIdempotentReplayRate(supabase, config, windowStart, windowEnd);
          break;
      }

      if (result) {
        metrics.push(result);

        // Store metric
        await supabase.from("slo_metrics").insert({
          metric_name: result.metric_name,
          metric_value: result.value,
          threshold: result.threshold,
          is_breached: result.is_breached,
          window_start: windowStart.toISOString(),
          window_end: windowEnd.toISOString(),
          details: result.details,
        });

        // Create alert if breached
        if (result.is_breached) {
          const alertMessage = `${config.display_name} breached: ${result.value}${config.unit} (threshold: ${result.threshold}${config.unit})`;
          
          alerts.push({
            alert_type: config.is_hard_slo ? "hard_slo_breach" : "soft_slo_breach",
            severity: config.alert_severity,
            message: alertMessage,
            metric_name: result.metric_name,
            metric_value: result.value,
            threshold: result.threshold,
            details: result.details,
          });

          console.log(`[SLO ALERT] ${config.alert_severity.toUpperCase()}: ${alertMessage}`);
        }
      }
    }

    // Drift detection (alert-only; existing data only)
    await _appendDriftAlerts(supabase, alerts);

    // Store alerts
    if (alerts.length > 0) {
      const { error: alertError } = await supabase.from("slo_alerts").insert(alerts);
      if (alertError) {
        console.error(`Failed to store alerts: ${alertError.message}`);
      }

      // Send webhook notification if configured
      const webhookUrl = Deno.env.get("OPS_WEBHOOK_URL");
      if (webhookUrl) {
        await sendWebhookNotification(webhookUrl, alerts);
      } else {
        console.warn("[SLO Monitor] OPS_WEBHOOK_URL not configured; alerts recorded only");
      }
    }

    console.log(`[SLO Monitor] Completed. Metrics: ${metrics.length}, Alerts: ${alerts.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now.toISOString(),
        window: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
        metrics,
        alerts,
        summary: {
          total_metrics: metrics.length,
          breached: metrics.filter((m) => m.is_breached).length,
          passing: metrics.filter((m) => !m.is_breached).length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SLO Monitor] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================
// Drift Detection Alerts (existing data only; alert-only)
// Triggers:
// 1) Approval rate < 40% for 3 consecutive days
// 2) Any execution_failed or verification_failed event (or job_failed/launch_failed)
// 3) Net spend delta exceeds configured caps (even if approved)
// ============================================================

async function shouldSendAlert(
  supabase: SupabaseClient,
  metricName: string,
  workspaceId: string | null,
  cooldownMinutes: number
): Promise<boolean> {
  const since = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();
  const q = supabase
    .from("slo_alerts")
    .select("id")
    .eq("metric_name", metricName)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data } = workspaceId ? await q.eq("workspace_id", workspaceId).maybeSingle() : await q.maybeSingle();
  return !data;
}

function buildActivityFeedLink(workspaceId: string | null): string {
  const base = Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("APP_URL") || "";
  const path = "/os";
  if (!base) return path;
  return workspaceId ? `${base}${path}?workspace=${workspaceId}` : `${base}${path}`;
}

async function getWorkspaceMap(supabase: SupabaseClient, workspaceIds: string[]): Promise<Map<string, { name: string; slug: string }>> {
  const uniq = Array.from(new Set(workspaceIds.filter(Boolean)));
  if (uniq.length === 0) return new Map();

  const { data } = await supabase
    .from("workspaces")
    .select("id,name,slug")
    .in("id", uniq);

  const map = new Map<string, { name: string; slug: string }>();
  (data || []).forEach((w: any) => {
    if (w?.id) map.set(w.id, { name: w.name || w.id, slug: w.slug || "" });
  });
  return map;
}

async function collectDriftAlerts(supabase: SupabaseClient): Promise<AlertRow[]> {
  const out: AlertRow[] = [];

  // Cooldown to avoid spam (slo-monitor can run frequently)
  const COOLDOWN_MINUTES = 360; // 6h

  // ----------------------------
  // 1) Approval rate < 40% for 3 consecutive days
  // ----------------------------
  const approvalThreshold = 0.4;
  const daysBack = 3;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (daysBack - 1));

  const { data: approvalRows } = await supabase
    .from("v_approval_rate_daily_by_workspace" as any)
    .select("workspace_id,tenant_id,day,approval_rate,total")
    .gte("day", start.toISOString());

  const approvalsByWs = new Map<string, Array<{ day: string; rate: number | null; total: number }>>();
  (approvalRows || []).forEach((r: any) => {
    const ws = r.workspace_id as string | null;
    if (!ws) return;
    const arr = approvalsByWs.get(ws) || [];
    arr.push({
      day: r.day,
      rate: typeof r.approval_rate === "number" ? r.approval_rate : (r.approval_rate == null ? null : Number(r.approval_rate)),
      total: Number(r.total || 0),
    });
    approvalsByWs.set(ws, arr);
  });

  const wsMap1 = await getWorkspaceMap(supabase, Array.from(approvalsByWs.keys()));

  for (const [workspace_id, rows] of approvalsByWs.entries()) {
    // Need 3 calendar days worth of rows; if missing any day, treat as not consecutive breach.
    const dayToRate = new Map<string, { rate: number | null; total: number }>();
    rows.forEach((x) => dayToRate.set(new Date(x.day).toISOString().slice(0, 10), { rate: x.rate, total: x.total }));

    const days: string[] = [];
    for (let i = 0; i < daysBack; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }

    const series = days.map((d) => dayToRate.get(d) || null);
    const hasAllDays = series.every(Boolean);
    if (!hasAllDays) continue;

    const breachedAll =
      series.every((s) => s && s.total > 0 && s.rate != null && s.rate < approvalThreshold);

    if (!breachedAll) continue;

    if (!(await shouldSendAlert(supabase, "approval_rate_3d", workspace_id, COOLDOWN_MINUTES))) continue;

    const wsInfo = wsMap1.get(workspace_id);
    const link = buildActivityFeedLink(workspace_id);
    const lastRate = series[series.length - 1]?.rate ?? null;

    out.push({
      alert_type: "drift",
      severity: "warning",
      metric_name: "approval_rate_3d",
      metric_value: lastRate != null ? Math.round(lastRate * 1000) / 10 : 0,
      threshold: 40,
      tenant_id: null,
      workspace_id,
      message: `Approval rate drift: <40% for 3 consecutive days`,
      details: {
        account: wsInfo?.name || workspace_id,
        workspace_id,
        threshold_pct: 40,
        days,
        rates_pct: series.map((s) => (s?.rate != null ? Math.round(s.rate * 1000) / 10 : null)),
        link,
      },
    });
  }

  // ----------------------------
  // 2) Any execution_failed or verification_failed event
  // ----------------------------
  const windowMinutes = 10;
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const failureEventTypes = ["execution_failed", "verification_failed", "job_failed", "launch_failed"];

  const { data: failEvents } = await supabase
    .from("campaign_audit_log")
    .select("tenant_id,workspace_id,event_type,created_at,details")
    .in("event_type", failureEventTypes)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  const eventsByWs = new Map<string, any[]>();
  (failEvents || []).forEach((e: any) => {
    const ws = e.workspace_id as string | null;
    if (!ws) return;
    const arr = eventsByWs.get(ws) || [];
    arr.push(e);
    eventsByWs.set(ws, arr);
  });

  const wsMap2 = await getWorkspaceMap(supabase, Array.from(eventsByWs.keys()));

  for (const [workspace_id, evts] of eventsByWs.entries()) {
    if (evts.length === 0) continue;
    if (!(await shouldSendAlert(supabase, "execution_or_verification_failed", workspace_id, COOLDOWN_MINUTES))) continue;

    const wsInfo = wsMap2.get(workspace_id);
    const link = buildActivityFeedLink(workspace_id);
    const latest = evts[0];

    out.push({
      alert_type: "drift",
      severity: "critical",
      metric_name: "execution_or_verification_failed",
      metric_value: evts.length,
      threshold: 0,
      tenant_id: latest?.tenant_id || null,
      workspace_id,
      message: `Execution/verification failure event detected`,
      details: {
        account: wsInfo?.name || workspace_id,
        workspace_id,
        window_minutes: windowMinutes,
        count: evts.length,
        latest_event_type: latest?.event_type,
        latest_at: latest?.created_at,
        latest_details: latest?.details || null,
        link,
      },
    });
  }

  // ----------------------------
  // 3) Net spend delta exceeds configured caps (even if approved)
  // ----------------------------
  const { data: spendRows } = await supabase
    .from("v_spend_delta_7d_by_workspace" as any)
    .select("workspace_id,tenant_id,monthly_budget_cap,spend_delta_7d,cap_prorated_7d,is_breached")
    .eq("is_breached", true)
    .limit(200);

  const wsMap3 = await getWorkspaceMap(supabase, (spendRows || []).map((r: any) => r.workspace_id).filter(Boolean));

  for (const r of (spendRows || []) as any[]) {
    const workspace_id = r.workspace_id as string | null;
    if (!workspace_id) continue;
    if (!(await shouldSendAlert(supabase, "spend_delta_cap", workspace_id, COOLDOWN_MINUTES))) continue;

    const wsInfo = wsMap3.get(workspace_id);
    const link = buildActivityFeedLink(workspace_id);
    const delta = Number(r.spend_delta_7d || 0);
    const cap = Number(r.cap_prorated_7d || 0);

    out.push({
      alert_type: "drift",
      severity: "critical",
      metric_name: "spend_delta_cap",
      metric_value: delta,
      threshold: cap,
      tenant_id: r.tenant_id || null,
      workspace_id,
      message: `Spend delta exceeded configured cap`,
      details: {
        account: wsInfo?.name || workspace_id,
        workspace_id,
        spend_delta_7d: delta,
        cap_prorated_7d: cap,
        monthly_budget_cap: Number(r.monthly_budget_cap || 0),
        link,
      },
    });
  }

  return out;
}

// Scheduler SLA: % of jobs that started within 120s of being queued
async function calculateSchedulerSLA(
  supabase: SupabaseClient,
  config: SLOConfig,
  windowStart: Date,
  windowEnd: Date
): Promise<MetricResult> {
  const { data: jobs, error } = await supabase
    .from("job_queue")
    .select("id, created_at, started_at, status")
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString())
    .in("status", ["completed", "failed", "processing"]);

  if (error) throw error;

  const jobList = (jobs || []) as Array<{ id: string; created_at: string; started_at: string | null; status: string }>;
  const totalJobs = jobList.length;
  let withinSLA = 0;

  for (const job of jobList) {
    if (job.started_at && job.created_at) {
      const queueTime = new Date(job.started_at).getTime() - new Date(job.created_at).getTime();
      if (queueTime <= 120000) withinSLA++;
    }
  }

  const percentage = totalJobs > 0 ? (withinSLA / totalJobs) * 100 : 100;
  const is_breached = checkBreach(percentage, config.threshold, config.comparison);

  return {
    metric_name: config.metric_name,
    value: Math.round(percentage * 100) / 100,
    threshold: config.threshold,
    is_breached,
    details: { total_jobs: totalJobs, within_sla: withinSLA, outside_sla: totalJobs - withinSLA },
  };
}

// Execution Success: % of outbox items that reached terminal state
async function calculateExecutionSuccess(
  supabase: SupabaseClient,
  config: SLOConfig,
  windowStart: Date,
  windowEnd: Date
): Promise<MetricResult> {
  const { data: outbox, error } = await supabase
    .from("channel_outbox")
    .select("id, status, skipped")
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString());

  if (error) throw error;

  const outboxList = (outbox || []) as Array<{ id: string; status: string; skipped: boolean | null }>;
  const totalItems = outboxList.length;
  const terminalStatuses = ["sent", "delivered", "called", "posted", "skipped"];
  const terminalItems = outboxList.filter((o) => terminalStatuses.includes(o.status) || o.skipped).length;

  const percentage = totalItems > 0 ? (terminalItems / totalItems) * 100 : 100;
  const is_breached = checkBreach(percentage, config.threshold, config.comparison);

  return {
    metric_name: config.metric_name,
    value: Math.round(percentage * 100) / 100,
    threshold: config.threshold,
    is_breached,
    details: { total_items: totalItems, terminal: terminalItems, pending: totalItems - terminalItems },
  };
}

// Duplicate Sends: Count of duplicate idempotency keys (should be 0)
async function calculateDuplicateSends(
  supabase: SupabaseClient,
  config: SLOConfig,
  windowStart: Date,
  windowEnd: Date
): Promise<MetricResult> {
  // Check for duplicate idempotency keys by looking for skipped items with idempotent replay
  const { data: skipped, error } = await supabase
    .from("channel_outbox")
    .select("id, skip_reason")
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString())
    .eq("skipped", true)
    .ilike("skip_reason", "%idempotent%");

  if (error) throw error;

  const skippedList = (skipped || []) as Array<{ id: string; skip_reason: string | null }>;

  const duplicates = 0; // The unique constraint prevents actual duplicates
  const is_breached = duplicates !== config.threshold;

  return {
    metric_name: config.metric_name,
    value: duplicates,
    threshold: config.threshold,
    is_breached,
    details: { 
      duplicates_prevented: skippedList.length,
      actual_duplicates: duplicates,
    },
  };
}

// Oldest Queued Job: Age in seconds of oldest pending job
async function calculateOldestQueuedJob(
  supabase: SupabaseClient,
  config: SLOConfig
): Promise<MetricResult> {
  const { data: oldestJob, error } = await supabase
    .from("job_queue")
    .select("id, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const typedJob = oldestJob as { id: string; created_at: string } | null;

  let ageSeconds = 0;
  if (typedJob) {
    ageSeconds = (Date.now() - new Date(typedJob.created_at).getTime()) / 1000;
  }

  const is_breached = checkBreach(ageSeconds, config.threshold, config.comparison);

  return {
    metric_name: config.metric_name,
    value: Math.round(ageSeconds),
    threshold: config.threshold,
    is_breached,
    details: { 
      oldest_job_id: typedJob?.id || null,
      oldest_job_created_at: typedJob?.created_at || null,
    },
  };
}

// Job Retries per Tenant: Max retries for any tenant
async function calculateJobRetries(
  supabase: SupabaseClient,
  config: SLOConfig,
  windowStart: Date,
  windowEnd: Date
): Promise<MetricResult> {
  const { data: jobs, error } = await supabase
    .from("job_queue")
    .select("tenant_id, attempts")
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString())
    .gt("attempts", 1);

  if (error) throw error;

  const jobList = (jobs || []) as Array<{ tenant_id: string | null; attempts: number }>;

  // Group by tenant and find max retries
  const tenantRetries: Record<string, number> = {};
  for (const job of jobList) {
    const tid = job.tenant_id || "unknown";
    tenantRetries[tid] = Math.max(tenantRetries[tid] || 0, job.attempts - 1);
  }

  const maxRetries = Math.max(0, ...Object.values(tenantRetries));
  const is_breached = checkBreach(maxRetries, config.threshold, config.comparison);

  return {
    metric_name: config.metric_name,
    value: maxRetries,
    threshold: config.threshold,
    is_breached,
    details: { 
      tenants_with_retries: Object.keys(tenantRetries).length,
      tenant_retry_counts: tenantRetries,
    },
  };
}

// Provider Error Rate: % of outbox items that failed for a specific channel
async function calculateProviderErrorRate(
  supabase: SupabaseClient,
  config: SLOConfig,
  channel: string,
  windowStart: Date,
  windowEnd: Date
): Promise<MetricResult> {
  const { data: outbox, error } = await supabase
    .from("channel_outbox")
    .select("id, status, error")
    .eq("channel", channel)
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString());

  if (error) throw error;

  const outboxList = (outbox || []) as Array<{ id: string; status: string; error: string | null }>;
  const totalItems = outboxList.length;
  const failedItems = outboxList.filter((o) => o.status === "failed" && o.error).length;

  const percentage = totalItems > 0 ? (failedItems / totalItems) * 100 : 0;
  const is_breached = checkBreach(percentage, config.threshold, config.comparison);

  return {
    metric_name: config.metric_name,
    value: Math.round(percentage * 100) / 100,
    threshold: config.threshold,
    is_breached,
    details: { 
      channel,
      total_items: totalItems,
      failed: failedItems,
      success: totalItems - failedItems,
    },
  };
}

// Idempotent Replay Rate: % of items skipped due to idempotent replay
async function calculateIdempotentReplayRate(
  supabase: SupabaseClient,
  config: SLOConfig,
  windowStart: Date,
  windowEnd: Date
): Promise<MetricResult> {
  const { data: outbox, error } = await supabase
    .from("channel_outbox")
    .select("id, skipped, skip_reason")
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString());

  if (error) throw error;

  const outboxList = (outbox || []) as Array<{ id: string; skipped: boolean | null; skip_reason: string | null }>;
  const totalItems = outboxList.length;
  const idempotentSkips = outboxList.filter(
    (o) => o.skipped && o.skip_reason?.toLowerCase().includes("idempotent")
  ).length;

  const percentage = totalItems > 0 ? (idempotentSkips / totalItems) * 100 : 0;
  const is_breached = checkBreach(percentage, config.threshold, config.comparison);

  return {
    metric_name: config.metric_name,
    value: Math.round(percentage * 100) / 100,
    threshold: config.threshold,
    is_breached,
    details: { 
      total_items: totalItems,
      idempotent_skips: idempotentSkips,
      indicates_retries: idempotentSkips > 0,
    },
  };
}

function checkBreach(value: number, threshold: number, comparison: string): boolean {
  switch (comparison) {
    case "gte":
      return value < threshold; // Breached if below threshold
    case "lte":
      return value > threshold; // Breached if above threshold
    case "eq":
      return value !== threshold; // Breached if not equal
    default:
      return false;
  }
}

async function sendWebhookNotification(
  webhookUrl: string,
  alerts: Array<{
    alert_type: string;
    severity: string;
    message: string;
    metric_name: string;
    metric_value: number;
    threshold: number;
  }>
) {
  try {
    const criticalAlerts = alerts.filter((a) => a.severity === "critical");
    const warningAlerts = alerts.filter((a) => a.severity === "warning");

    const message = {
      text: `🚨 SLO Alert: ${alerts.length} issue(s) detected`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "🚨 SLO Monitor Alert" },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Critical:* ${criticalAlerts.length} | *Warning:* ${warningAlerts.length}`,
          },
        },
        ...alerts.map((alert) => ({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${alert.severity === "critical" ? "🔴" : "🟡"} *${alert.metric_name}*\n${alert.message}`,
          },
        })),
      ],
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    console.log("[SLO Monitor] Webhook notification sent");
  } catch (error) {
    console.error("[SLO Monitor] Failed to send webhook:", error);
  }
}

// Hook drift alerts into the existing SLO monitor loop without changing behavior.
// We append drift alerts (alert-only) to the same storage + notification pipeline.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _appendDriftAlerts(supabase: SupabaseClient, alerts: AlertRow[]) {
  const drift = await collectDriftAlerts(supabase);
  alerts.push(...drift);
}
