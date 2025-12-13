import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

// Canonical economic metric IDs
const CFO_METRIC_IDS = [
  "payback_months",
  "gross_margin_pct",
  "contribution_margin_pct", 
  "cac_blended",
  "revenue_per_fte",
  "sales_efficiency_ratio",
];

interface TenantSnapshot {
  tenant_id: string;
  tenant_name: string;
  cfo_enabled: boolean;
  payback_months: number | null;
  gross_margin_pct: number | null;
  contribution_margin_pct: number | null;
  cac_blended: number | null;
  revenue_per_fte: number | null;
  sales_efficiency_ratio: number | null;
  actions_improved_economics: number;
  actions_hurt_economics: number;
  actions_neutral: number;
  total_actions: number;
  cfo_gates_triggered: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request - can specify recipient email
    const body = await req.json().catch(() => ({}));
    const recipientEmail = body.email || "team@ubigrowth.ai"; // Default recipient
    const weekStart = new Date(Date.now() - 7 * 86400000).toISOString();

    console.log(`[CFO Snapshot] Generating weekly report for ${recipientEmail}`);

    // 1. Get all tenants with CFO expansion status
    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .select("id, name, config")
      .eq("status", "active");

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    const snapshots: TenantSnapshot[] = [];

    for (const tenant of tenants || []) {
      const tenantId = tenant.id;
      const cfoEnabled = tenant.config?.cfo_expansion_enabled === true;

      // 2. Get latest CFO metrics (all canonical economic metrics)
      const { data: metrics } = await supabase
        .from("metric_snapshots_daily")
        .select("metric_id, value")
        .eq("tenant_id", tenantId)
        .in("metric_id", CFO_METRIC_IDS)
        .order("date", { ascending: false })
        .limit(CFO_METRIC_IDS.length * 2); // Get enough rows to cover all metrics

      const metricsMap = new Map<string, number>();
      for (const m of metrics || []) {
        if (!metricsMap.has(m.metric_id)) {
          metricsMap.set(m.metric_id, m.value);
        }
      }

      // 3. Count optimization actions by economic outcome (last 7 days)
      // Join to optimization_actions via action_id to get full context
      const { data: actionResults } = await supabase
        .from("optimization_action_results")
        .select("delta_direction, economic_deltas, optimization_action_id")
        .eq("tenant_id", tenantId)
        .gte("created_at", weekStart);

      let improvedEconomics = 0;
      let hurtEconomics = 0;
      let neutralEconomics = 0;

      for (const result of actionResults || []) {
        const deltas = result.economic_deltas as Record<string, number> | null;
        
        // Evaluate using delta_direction (canonical: increase | decrease | neutral)
        if (result.delta_direction === "decrease") {
          // For economics, "decrease" in payback/CAC = improved
          // Need to check what metric was targeted
          improvedEconomics++;
        } else if (result.delta_direction === "increase") {
          // For economics, "increase" in margin = improved, but increase in payback = hurt
          // Use economic_deltas for more nuance if available
          if (deltas) {
            const paybackDelta = deltas.delta_payback_months ?? 0;
            const marginDelta = deltas.delta_margin_pct ?? 0;
            const cacDelta = deltas.delta_cac ?? 0;
            const revenuePerFteDelta = deltas.delta_revenue_per_fte ?? 0;
            
            // Score: positive = improved economics, negative = hurt
            const economicScore = 
              (marginDelta > 0 ? 1 : marginDelta < 0 ? -1 : 0) +
              (paybackDelta < 0 ? 1 : paybackDelta > 0 ? -1 : 0) +
              (cacDelta < 0 ? 1 : cacDelta > 0 ? -1 : 0) +
              (revenuePerFteDelta > 0 ? 1 : revenuePerFteDelta < 0 ? -1 : 0);
            
            if (economicScore > 0) improvedEconomics++;
            else if (economicScore < 0) hurtEconomics++;
            else neutralEconomics++;
          } else {
            hurtEconomics++;
          }
        } else if (result.delta_direction === "neutral") {
          neutralEconomics++;
        }
      }

      // 4. Count cycles with CFO gates triggered
      const { data: cycles } = await supabase
        .from("optimization_cycles")
        .select("cfo_gates_active")
        .eq("tenant_id", tenantId)
        .gte("invoked_at", weekStart);

      const cfoGatesTriggered = (cycles || []).filter(
        (c) => c.cfo_gates_active && c.cfo_gates_active.length > 0
      ).length;

      snapshots.push({
        tenant_id: tenantId,
        tenant_name: tenant.name || tenantId,
        cfo_enabled: cfoEnabled,
        payback_months: metricsMap.get("payback_months") ?? null,
        gross_margin_pct: metricsMap.get("gross_margin_pct") ?? null,
        contribution_margin_pct: metricsMap.get("contribution_margin_pct") ?? null,
        cac_blended: metricsMap.get("cac_blended") ?? null,
        revenue_per_fte: metricsMap.get("revenue_per_fte") ?? null,
        sales_efficiency_ratio: metricsMap.get("sales_efficiency_ratio") ?? null,
        actions_improved_economics: improvedEconomics,
        actions_hurt_economics: hurtEconomics,
        actions_neutral: neutralEconomics,
        total_actions: (actionResults || []).length,
        cfo_gates_triggered: cfoGatesTriggered,
      });
    }

    // 5. Build email HTML
    const emailHtml = buildEmailHtml(snapshots);

    // 6. Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "Revenue OS <noreply@updates.ubigrowth.ai>",
      to: [recipientEmail],
      subject: `[Revenue OS] Weekly CFO Snapshot - ${new Date().toLocaleDateString()}`,
      html: emailHtml,
    });

    console.log(`[CFO Snapshot] Email sent:`, emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        tenants_reported: snapshots.length,
        email_response: emailResponse,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("[CFO Snapshot] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

function buildEmailHtml(snapshots: TenantSnapshot[]): string {
  const cfoEnabledTenants = snapshots.filter((s) => s.cfo_enabled);
  const cfoDisabledTenants = snapshots.filter((s) => !s.cfo_enabled);

  const formatMetric = (value: number | null, suffix = ""): string => {
    if (value === null) return '<span style="color: #999;">—</span>';
    return `${value.toFixed(2)}${suffix}`;
  };

  const buildTenantRow = (s: TenantSnapshot): string => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 12px 8px; font-weight: 500;">${s.tenant_name}</td>
      <td style="padding: 12px 8px; text-align: center;">${formatMetric(s.payback_months, " mo")}</td>
      <td style="padding: 12px 8px; text-align: center;">${formatMetric(s.gross_margin_pct ? s.gross_margin_pct * 100 : null, "%")}</td>
      <td style="padding: 12px 8px; text-align: center;">${formatMetric(s.cac_blended, "")}</td>
      <td style="padding: 12px 8px; text-align: center;">
        <span style="color: #22c55e;">▲ ${s.actions_improved_economics}</span> / 
        <span style="color: #ef4444;">▼ ${s.actions_hurt_economics}</span>
      </td>
      <td style="padding: 12px 8px; text-align: center;">${s.cfo_gates_triggered}</td>
    </tr>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: #02040A; color: white; padding: 24px; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 8px 0 0; opacity: 0.8; }
        .content { padding: 24px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { text-align: left; padding: 12px 8px; background: #f9fafb; font-weight: 600; color: #374151; }
        .section-title { font-size: 16px; font-weight: 600; margin: 24px 0 12px; color: #111827; display: flex; align-items: center; gap: 8px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; }
        .badge-enabled { background: #dcfce7; color: #166534; }
        .badge-disabled { background: #f3f4f6; color: #6b7280; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
        .summary-card { background: #f9fafb; border-radius: 8px; padding: 16px; text-align: center; }
        .summary-value { font-size: 28px; font-weight: 700; color: #111827; }
        .summary-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
        .footer { background: #f9fafb; padding: 16px 24px; text-align: center; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Weekly CFO Snapshot</h1>
          <p>Revenue OS Economics Report • ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        
        <div class="content">
          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-value">${cfoEnabledTenants.length}</div>
              <div class="summary-label">CFO Expansion Enabled</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${snapshots.reduce((sum, s) => sum + s.actions_improved_economics, 0)}</div>
              <div class="summary-label">Actions Improved Economics</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${snapshots.reduce((sum, s) => sum + s.cfo_gates_triggered, 0)}</div>
              <div class="summary-label">CFO Gates Triggered</div>
            </div>
          </div>

          ${cfoEnabledTenants.length > 0 ? `
            <div class="section-title">
              <span class="badge badge-enabled">CFO ENABLED</span>
              Tenants with CFO Expansion
            </div>
            <table>
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th style="text-align: center;">Payback</th>
                  <th style="text-align: center;">Margin</th>
                  <th style="text-align: center;">CAC</th>
                  <th style="text-align: center;">Actions ▲/▼</th>
                  <th style="text-align: center;">Gates</th>
                </tr>
              </thead>
              <tbody>
                ${cfoEnabledTenants.map(buildTenantRow).join("")}
              </tbody>
            </table>
          ` : ""}

          ${cfoDisabledTenants.length > 0 ? `
            <div class="section-title">
              <span class="badge badge-disabled">STANDARD</span>
              Tenants without CFO Expansion
            </div>
            <table>
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th style="text-align: center;">Payback</th>
                  <th style="text-align: center;">Margin</th>
                  <th style="text-align: center;">CAC</th>
                  <th style="text-align: center;">Actions ▲/▼</th>
                  <th style="text-align: center;">Gates</th>
                </tr>
              </thead>
              <tbody>
                ${cfoDisabledTenants.map(buildTenantRow).join("")}
              </tbody>
            </table>
          ` : ""}
        </div>
        
        <div class="footer">
          Revenue OS • CFO Expansion v1.1 • Generated automatically
        </div>
      </div>
    </body>
    </html>
  `;
}
