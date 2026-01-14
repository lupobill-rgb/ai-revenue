import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { openaiChatCompletionsRaw } from "../_shared/providers/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PredictiveRequest {
  action: "score_lead" | "forecast_conversions" | "analyze_pipeline";
  leadId?: string;
  timeframe?: "week" | "month" | "quarter";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, leadId, timeframe = "month" } = await req.json() as PredictiveRequest;

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

    if (action === "score_lead" && leadId) {
      // Fetch lead with activities
      const { data: lead, error: leadError } = await supabaseClient
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();

      if (leadError || !lead) throw new Error("Lead not found");

      const { data: activities } = await supabaseClient
        .from("lead_activities")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      // Calculate engagement metrics
      const metrics = calculateLeadMetrics(lead, activities || []);

      const prompt = `Analyze this lead and predict conversion probability.

LEAD PROFILE:
- Name: ${lead.first_name} ${lead.last_name}
- Company: ${lead.company || "Unknown"} (${lead.company_size || "Unknown size"})
- Title: ${lead.job_title || "Unknown"}
- Industry: ${lead.vertical || lead.industry || "Unknown"}
- Source: ${lead.source}
- Current Status: ${lead.status}
- Current Score: ${lead.score}/100

ENGAGEMENT METRICS:
${JSON.stringify(metrics, null, 2)}

ACTIVITY HISTORY:
${(activities || []).slice(0, 15).map(a => `- ${a.activity_type}: ${a.description}`).join('\n')}

Provide a JSON response with:
1. predicted_score: calculated score 0-100
2. conversion_probability: percentage 0-100
3. expected_deal_size: estimated $ value
4. days_to_close: estimated days until conversion
5. confidence_level: "low" | "medium" | "high"
6. scoring_factors: array of {factor, weight, impact} explaining score
7. risk_factors: potential obstacles to conversion
8. recommended_actions: specific next steps to improve conversion
9. ideal_customer_fit: percentage match to ideal customer profile`;

      const response = await openaiChatCompletionsRaw(
        {
          model,
          messages: [
            { role: "system", content: "You are an expert sales analytics AI. Analyze leads and provide accurate conversion predictions based on engagement patterns. Always respond with valid JSON." },
            { role: "user", content: prompt },
          ],
        },
        OPENAI_API_KEY,
      );

      if (!response.ok) throw new Error("AI analysis failed");

      const aiData = await response.json();
      const analysisText = aiData.choices[0].message.content;
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      const prediction = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      // Update lead score in database
      if (prediction.predicted_score) {
        await supabaseClient
          .from("leads")
          .update({ score: Math.round(prediction.predicted_score) })
          .eq("id", leadId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          lead_id: leadId,
          prediction: {
            ...prediction,
            raw_metrics: metrics,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "forecast_conversions") {
      // Fetch all active leads
      const { data: leads, error: leadsError } = await supabaseClient
        .from("leads")
        .select("*")
        .in("status", ["new", "contacted", "qualified"]);

      if (leadsError) throw leadsError;

      // Fetch recent conversion data for modeling
      const { data: convertedLeads } = await supabaseClient
        .from("leads")
        .select("*")
        .eq("status", "converted")
        .order("updated_at", { ascending: false })
        .limit(50);

      const pipelineStats = analyzePipeline(leads || [], convertedLeads || []);

      const prompt = `Forecast conversions for this sales pipeline.

PIPELINE OVERVIEW:
- Total Active Leads: ${leads?.length || 0}
- By Status: ${JSON.stringify(pipelineStats.byStatus)}
- By Source: ${JSON.stringify(pipelineStats.bySource)}
- Avg Score: ${pipelineStats.avgScore}
- High Intent (score > 70): ${pipelineStats.highIntent}

HISTORICAL DATA:
- Recent Conversions: ${convertedLeads?.length || 0}
- Avg Days to Convert: ${pipelineStats.avgDaysToConvert}
- Top Converting Sources: ${pipelineStats.topSources.join(", ")}

TIMEFRAME: ${timeframe}

Provide a JSON response with:
1. predicted_conversions: number of expected conversions
2. predicted_revenue: estimated revenue
3. conversion_rate: expected pipeline conversion %
4. confidence_interval: {low, mid, high} predictions
5. by_stage: predictions broken down by current status
6. top_opportunities: array of lead characteristics most likely to convert
7. at_risk_deals: characteristics of leads likely to be lost
8. recommendations: actions to improve forecast
9. trends: observed patterns and insights`;

      const response = await openaiChatCompletionsRaw(
        {
          model,
          messages: [
            { role: "system", content: "You are an expert sales forecasting AI. Analyze pipeline data and provide accurate conversion forecasts. Always respond with valid JSON." },
            { role: "user", content: prompt },
          ],
        },
        OPENAI_API_KEY,
      );

      if (!response.ok) throw new Error("AI forecasting failed");

      const aiData = await response.json();
      const forecastText = aiData.choices[0].message.content;
      const jsonMatch = forecastText.match(/\{[\s\S]*\}/);
      const forecast = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      return new Response(
        JSON.stringify({
          success: true,
          timeframe,
          forecast: {
            ...forecast,
            pipeline_stats: pipelineStats,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "analyze_pipeline") {
      const { data: leads } = await supabaseClient
        .from("leads")
        .select("*")
        .in("status", ["new", "contacted", "qualified"]);

      const { data: activities } = await supabaseClient
        .from("lead_activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      const pipelineHealth = calculatePipelineHealth(leads || [], activities || []);

      const prompt = `Analyze pipeline health and provide optimization recommendations.

PIPELINE DATA:
${JSON.stringify(pipelineHealth, null, 2)}

Provide a JSON response with:
1. health_score: overall pipeline health 0-100
2. velocity: deals moving speed assessment
3. coverage: pipeline coverage ratio
4. quality_score: lead quality assessment
5. bottlenecks: identified process bottlenecks
6. stage_analysis: analysis of each pipeline stage
7. engagement_trends: patterns in lead engagement
8. optimization_opportunities: specific improvements
9. predicted_issues: potential future problems
10. action_plan: prioritized list of recommendations`;

      const response = await openaiChatCompletionsRaw(
        {
          model,
          messages: [
            { role: "system", content: "You are an expert sales operations analyst. Analyze pipeline health and provide actionable optimization recommendations. Always respond with valid JSON." },
            { role: "user", content: prompt },
          ],
        },
        OPENAI_API_KEY,
      );

      if (!response.ok) throw new Error("AI analysis failed");

      const aiData = await response.json();
      const analysisText = aiData.choices[0].message.content;
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      return new Response(
        JSON.stringify({
          success: true,
          analysis: {
            ...analysis,
            raw_data: pipelineHealth,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (error) {
    console.error("Error in predictive-analytics:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateLeadMetrics(lead: any, activities: any[]) {
  const now = new Date();
  const createdAt = new Date(lead.created_at);
  const ageInDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  const emailsSent = activities.filter(a => a.activity_type.includes("email_sent")).length;
  const emailsOpened = activities.filter(a => a.activity_type === "email_opened").length;
  const emailsClicked = activities.filter(a => a.activity_type === "email_clicked").length;
  const calls = activities.filter(a => a.activity_type === "call").length;
  const meetings = activities.filter(a => a.activity_type === "meeting").length;

  return {
    leadAge: ageInDays,
    totalActivities: activities.length,
    emailsSent,
    emailsOpened,
    emailsClicked,
    openRate: emailsSent > 0 ? Math.round((emailsOpened / emailsSent) * 100) : 0,
    clickRate: emailsSent > 0 ? Math.round((emailsClicked / emailsSent) * 100) : 0,
    calls,
    meetings,
    hasPhone: !!lead.phone,
    hasCompany: !!lead.company,
    daysSinceLastActivity: activities[0] 
      ? Math.floor((now.getTime() - new Date(activities[0].created_at).getTime()) / (1000 * 60 * 60 * 24))
      : ageInDays,
  };
}

function analyzePipeline(leads: any[], convertedLeads: any[]) {
  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalScore = 0;
  let highIntent = 0;

  leads.forEach(lead => {
    byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
    bySource[lead.source] = (bySource[lead.source] || 0) + 1;
    totalScore += lead.score || 0;
    if ((lead.score || 0) > 70) highIntent++;
  });

  const sourceCounts: Record<string, number> = {};
  convertedLeads.forEach(lead => {
    sourceCounts[lead.source] = (sourceCounts[lead.source] || 0) + 1;
  });

  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([source]) => source);

  return {
    byStatus,
    bySource,
    avgScore: leads.length > 0 ? Math.round(totalScore / leads.length) : 0,
    highIntent,
    avgDaysToConvert: 14, // Simplified
    topSources,
  };
}

function calculatePipelineHealth(leads: any[], activities: any[]) {
  const now = new Date();
  const staleLeads = leads.filter(lead => {
    const lastActivity = activities.find(a => a.lead_id === lead.id);
    if (!lastActivity) return true;
    const daysSince = Math.floor((now.getTime() - new Date(lastActivity.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return daysSince > 7;
  }).length;

  return {
    totalLeads: leads.length,
    staleLeads,
    activeLeads: leads.length - staleLeads,
    avgScore: leads.length > 0 ? Math.round(leads.reduce((sum, l) => sum + (l.score || 0), 0) / leads.length) : 0,
    byStatus: leads.reduce((acc, l) => ({ ...acc, [l.status]: (acc[l.status] || 0) + 1 }), {} as Record<string, number>),
    recentActivities: activities.slice(0, 20).length,
    engagementRate: leads.length > 0 ? Math.round(((leads.length - staleLeads) / leads.length) * 100) : 0,
  };
}
