import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const CFO_DIGEST_TO = Deno.env.get("CFO_DIGEST_TO") || "bill@ubigrowth.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[weekly-cfo-digest] Starting digest generation...");

    // 1) Pull weekly per-tenant snapshot
    const { data: perTenant, error: ptError } = await supabase.rpc("get_weekly_cfo_snapshot");

    if (ptError) {
      console.error("get_weekly_cfo_snapshot error:", ptError);
      return new Response(JSON.stringify({ error: "Error fetching snapshot" }), { 
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 2) Portfolio-level aggregate
    const { data: portfolio, error: pfError } = await supabase.rpc("get_weekly_cfo_portfolio_summary");

    if (pfError) {
      console.error("get_weekly_cfo_portfolio_summary error:", pfError);
      return new Response(JSON.stringify({ error: "Error fetching portfolio snapshot" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const portfolioRow = Array.isArray(portfolio) ? portfolio[0] : portfolio;

    console.log(`[weekly-cfo-digest] Found ${(perTenant || []).length} tenants, building HTML...`);

    const html = buildHtmlDigest(perTenant || [], portfolioRow || null);

    const emailResult = await resend.emails.send({
      from: "UbiGrowth Revenue OS <noreply@updates.ubigrowth.ai>",
      to: CFO_DIGEST_TO,
      subject: `Weekly Revenue OS CFO Digest - ${new Date().toLocaleDateString()}`,
      html,
    });

    console.log("[weekly-cfo-digest] Email sent:", emailResult);

    return new Response(JSON.stringify({ success: true, email: emailResult }), { 
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    console.error("weekly-cfo-digest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }), { 
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});

function buildHtmlDigest(perTenant: any[], portfolio: any | null): string {
  const weekOf = new Date().toISOString().split("T")[0];

  const portfolioHtml = portfolio
    ? `
      <h2>Portfolio Summary (Week of ${weekOf})</h2>
      <ul>
        <li>Active tenants: <strong>${portfolio.tenants_active ?? 0}</strong></li>
        <li>Avg payback (months): <strong>${round(portfolio.avg_payback_months)}</strong></li>
        <li>Avg CAC (blended): <strong>${round(portfolio.avg_cac_blended)}</strong></li>
        <li>Avg gross margin %: <strong>${round(portfolio.avg_gross_margin_pct)}</strong></li>
        <li>Avg revenue per FTE: <strong>${round(portfolio.avg_revenue_per_fte)}</strong></li>
        <li>Economics actions (improved / hurt):
          <strong>${portfolio.total_econ_actions_improved ?? 0}</strong> /
          <strong>${portfolio.total_econ_actions_hurt ?? 0}</strong>
        </li>
      </ul>
    `
    : "<p>No portfolio data available.</p>";

  const rows = perTenant
    .map((t) => {
      return `
        <tr>
          <td>${t.tenant_name}</td>
          <td>${round(t.payback_months)}</td>
          <td>${round(t.cac_blended)}</td>
          <td>${round(t.gross_margin_pct)}</td>
          <td>${round(t.contribution_margin_pct)}</td>
          <td>${round(t.revenue_per_fte)}</td>
          <td>${t.econ_actions_total ?? 0}</td>
          <td>${t.econ_actions_improved ?? 0}</td>
          <td>${t.econ_actions_hurt ?? 0}</td>
        </tr>
      `;
    })
    .join("");

  const tableHtml = `
    <h2>Per-Tenant Economics Snapshot</h2>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
      <thead>
        <tr>
          <th>Tenant</th>
          <th>Payback (mo)</th>
          <th>CAC</th>
          <th>GM %</th>
          <th>CM %</th>
          <th>Revenue/FTE</th>
          <th># Econ Actions</th>
          <th>Improved</th>
          <th>Hurt</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="9">No active tenants</td></tr>`}
      </tbody>
    </table>
  `;

  return `
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #02040A;">UbiGrowth Revenue OS – Weekly CFO Digest</h1>
      ${portfolioHtml}
      ${tableHtml}
      <p style="margin-top:16px;font-size:11px;color:#888;">
        Generated automatically by Revenue OS CFO loop.
      </p>
    </body>
    </html>
  `;
}

function round(v: any): string {
  if (v === null || v === undefined) return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return "-";
  return n.toFixed(2);
}
