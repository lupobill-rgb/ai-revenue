import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate internal secret for cron calls
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    
    if (internalSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const targetDate = body.date || new Date().toISOString().split("T")[0];

    console.log(`[metrics-paid-channels] Calculating metrics for date: ${targetDate}`);

    // Get all tenants with spend data for the target date
    const { data: spendData, error: spendError } = await supabase
      .from("channel_spend_daily")
      .select("tenant_id, spend, impressions, clicks, leads, opportunities, revenue_booked")
      .eq("date", targetDate);

    if (spendError) {
      throw new Error(`Failed to fetch spend data: ${spendError.message}`);
    }

    if (!spendData || spendData.length === 0) {
      console.log("[metrics-paid-channels] No spend data for target date");
      return new Response(JSON.stringify({ ok: true, message: "No spend data for date", metrics_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aggregate by tenant
    const tenantAggregates: Record<string, {
      spend: number;
      impressions: number;
      clicks: number;
      leads: number;
      opportunities: number;
      revenue_booked: number;
    }> = {};

    for (const row of spendData) {
      if (!tenantAggregates[row.tenant_id]) {
        tenantAggregates[row.tenant_id] = {
          spend: 0,
          impressions: 0,
          clicks: 0,
          leads: 0,
          opportunities: 0,
          revenue_booked: 0,
        };
      }
      tenantAggregates[row.tenant_id].spend += Number(row.spend) || 0;
      tenantAggregates[row.tenant_id].impressions += Number(row.impressions) || 0;
      tenantAggregates[row.tenant_id].clicks += Number(row.clicks) || 0;
      tenantAggregates[row.tenant_id].leads += Number(row.leads) || 0;
      tenantAggregates[row.tenant_id].opportunities += Number(row.opportunities) || 0;
      tenantAggregates[row.tenant_id].revenue_booked += Number(row.revenue_booked) || 0;
    }

    // Build metric snapshots to upsert
    const metricsToInsert: Array<{
      tenant_id: string;
      metric_id: string;
      date: string;
      value: number | null;
    }> = [];

    for (const [tenantId, agg] of Object.entries(tenantAggregates)) {
      // CAC Paid (spend / leads)
      const cacPaid = agg.leads > 0 ? agg.spend / agg.leads : null;
      metricsToInsert.push({
        tenant_id: tenantId,
        metric_id: "cac_paid",
        date: targetDate,
        value: cacPaid,
      });

      // Spend Total Paid
      metricsToInsert.push({
        tenant_id: tenantId,
        metric_id: "spend_paid_total",
        date: targetDate,
        value: agg.spend,
      });

      // Pipeline from Paid (opportunities)
      metricsToInsert.push({
        tenant_id: tenantId,
        metric_id: "pipeline_from_paid",
        date: targetDate,
        value: agg.opportunities,
      });

      // Revenue from Paid
      metricsToInsert.push({
        tenant_id: tenantId,
        metric_id: "revenue_from_paid",
        date: targetDate,
        value: agg.revenue_booked,
      });

      // Leads from Paid
      metricsToInsert.push({
        tenant_id: tenantId,
        metric_id: "leads_from_paid",
        date: targetDate,
        value: agg.leads,
      });

      // Impressions Paid
      metricsToInsert.push({
        tenant_id: tenantId,
        metric_id: "impressions_paid",
        date: targetDate,
        value: agg.impressions,
      });

      // Clicks Paid
      metricsToInsert.push({
        tenant_id: tenantId,
        metric_id: "clicks_paid",
        date: targetDate,
        value: agg.clicks,
      });

      // CTR Paid (clicks / impressions)
      const ctrPaid = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : null;
      metricsToInsert.push({
        tenant_id: tenantId,
        metric_id: "ctr_paid",
        date: targetDate,
        value: ctrPaid,
      });

      // Cost per Click (spend / clicks)
      const cpc = agg.clicks > 0 ? agg.spend / agg.clicks : null;
      metricsToInsert.push({
        tenant_id: tenantId,
        metric_id: "cpc_paid",
        date: targetDate,
        value: cpc,
      });

      // Cost per Opportunity (spend / opportunities)
      const cpOpp = agg.opportunities > 0 ? agg.spend / agg.opportunities : null;
      metricsToInsert.push({
        tenant_id: tenantId,
        metric_id: "cost_per_opportunity_paid",
        date: targetDate,
        value: cpOpp,
      });

      // ROAS (revenue / spend)
      const roas = agg.spend > 0 ? agg.revenue_booked / agg.spend : null;
      metricsToInsert.push({
        tenant_id: tenantId,
        metric_id: "roas_paid",
        date: targetDate,
        value: roas,
      });
    }

    // Upsert metrics (on conflict update value)
    const { error: upsertError } = await supabase
      .from("metric_snapshots_daily")
      .upsert(metricsToInsert, {
        onConflict: "tenant_id,metric_id,date",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      throw new Error(`Failed to upsert metrics: ${upsertError.message}`);
    }

    console.log(`[metrics-paid-channels] Upserted ${metricsToInsert.length} metrics for ${Object.keys(tenantAggregates).length} tenants`);

    return new Response(
      JSON.stringify({
        ok: true,
        date: targetDate,
        tenants_processed: Object.keys(tenantAggregates).length,
        metrics_created: metricsToInsert.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[metrics-paid-channels] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
