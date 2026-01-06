import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OptimizationRequest {
  campaignIds?: string[];
  optimizeAll?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignIds, optimizeAll }: OptimizationRequest = await req.json();

    const { user, error: authError, supabaseClient } = await verifyAuth(req);
    if (authError || !user || !supabaseClient) {
      return unauthorizedResponse(corsHeaders, authError || "Not authenticated");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Campaign optimizer starting...");

    // Fetch active campaigns with their metrics
    let campaignsQuery = supabaseClient
      .from("campaigns")
      .select(`
        id,
        channel,
        status,
        budget_allocated,
        target_audience,
        asset_id,
        assets (
          id,
          name,
          type,
          content,
          goal
        ),
        campaign_metrics (
          impressions,
          clicks,
          conversions,
          open_count,
          engagement_rate,
          revenue,
          cost,
          bounce_count,
          delivered_count
        )
      `)
      .in("status", ["active", "pending"]);

    if (campaignIds && campaignIds.length > 0) {
      campaignsQuery = campaignsQuery.in("id", campaignIds);
    }

    const { data: campaigns, error: campaignsError } = await campaignsQuery;

    if (campaignsError) throw campaignsError;
    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No campaigns to optimize", optimizations: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${campaigns.length} campaigns to analyze`);

    // Calculate performance metrics for each campaign
    const campaignAnalytics = campaigns.map(campaign => {
      const metrics = campaign.campaign_metrics?.[0] || {} as any;
      const asset = Array.isArray(campaign.assets) ? campaign.assets[0] : campaign.assets;
      const impressions = metrics.impressions || 0;
      const clicks = metrics.clicks || 0;
      const conversions = metrics.conversions || 0;
      const cost = metrics.cost || campaign.budget_allocated || 0;
      const revenue = metrics.revenue || 0;

      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
      const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
      const cpc = clicks > 0 ? cost / clicks : 0;
      const cpa = conversions > 0 ? cost / conversions : 0;

      return {
        id: campaign.id,
        channel: campaign.channel,
        name: asset?.name || "Unknown",
        goal: asset?.goal || "",
        budget: campaign.budget_allocated,
        metrics: {
          impressions,
          clicks,
          conversions,
          revenue,
          cost,
          ctr: ctr.toFixed(2),
          conversionRate: conversionRate.toFixed(2),
          roi: roi.toFixed(2),
          cpc: cpc.toFixed(2),
          cpa: cpa.toFixed(2),
          engagementRate: metrics.engagement_rate?.toFixed(2) || "0",
          openRate: metrics.delivered_count > 0 
            ? ((metrics.open_count || 0) / metrics.delivered_count * 100).toFixed(2)
            : "0",
          bounceRate: metrics.delivered_count > 0
            ? ((metrics.bounce_count || 0) / metrics.delivered_count * 100).toFixed(2)
            : "0"
        },
        content: asset?.content
      };
    });

    // Use AI to generate optimization recommendations
    const systemPrompt = `You are an expert marketing optimization AI. Analyze campaign performance data and provide specific, actionable recommendations to improve ROI.

You must respond with a valid JSON array (no markdown, no code blocks).`;

    const userPrompt = `Analyze these campaign performance metrics and provide optimization recommendations:

${JSON.stringify(campaignAnalytics, null, 2)}

For each campaign, generate optimization recommendations including:
1. Performance assessment (poor/average/good/excellent)
2. Specific issues identified
3. Actionable recommendations
4. Budget reallocation suggestions
5. Content/timing optimizations
6. A/B test suggestions

Respond with this exact JSON array structure:
[
  {
    "campaignId": "campaign id",
    "campaignName": "name",
    "channel": "channel",
    "performanceScore": 0-100,
    "performanceLevel": "poor|average|good|excellent",
    "issues": [
      {
        "issue": "what's wrong",
        "severity": "low|medium|high|critical",
        "impact": "how it affects performance"
      }
    ],
    "recommendations": [
      {
        "type": "budget|content|timing|targeting|creative",
        "action": "specific action to take",
        "expectedImpact": "expected improvement",
        "priority": 1-5,
        "autoApplicable": true/false
      }
    ],
    "budgetRecommendation": {
      "currentBudget": number,
      "recommendedBudget": number,
      "reason": "why change budget"
    },
    "abTestSuggestions": [
      {
        "element": "what to test",
        "variants": ["variant A", "variant B"],
        "hypothesis": "expected outcome"
      }
    ],
    "predictedImprovement": {
      "ctr": "expected CTR improvement",
      "conversions": "expected conversion improvement",
      "roi": "expected ROI improvement"
    }
  }
]`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse recommendations
    let optimizations;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      optimizations = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse optimization recommendations");
    }

    // Apply auto-applicable optimizations
    const appliedOptimizations: any[] = [];
    for (const opt of optimizations) {
      const autoActions = opt.recommendations?.filter((r: any) => r.autoApplicable && r.priority <= 2) || [];
      
      for (const action of autoActions) {
        if (action.type === "budget" && opt.budgetRecommendation) {
          // Auto-adjust budget if recommendation is significant
          const budgetChange = Math.abs(opt.budgetRecommendation.recommendedBudget - opt.budgetRecommendation.currentBudget);
          const changePercent = (budgetChange / opt.budgetRecommendation.currentBudget) * 100;
          
          if (changePercent <= 25) { // Only auto-apply small budget adjustments
            const { error } = await supabaseClient
              .from("campaigns")
              .update({ budget_allocated: opt.budgetRecommendation.recommendedBudget })
              .eq("id", opt.campaignId);
            
            if (!error) {
              appliedOptimizations.push({
                campaignId: opt.campaignId,
                action: "budget_adjusted",
                from: opt.budgetRecommendation.currentBudget,
                to: opt.budgetRecommendation.recommendedBudget
              });
            }
          }
        }
      }
    }

    console.log(`Generated ${optimizations.length} optimization reports, auto-applied ${appliedOptimizations.length} changes`);

    return new Response(
      JSON.stringify({
        success: true,
        campaignsAnalyzed: campaigns.length,
        optimizations,
        appliedOptimizations,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in campaign-optimizer:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
