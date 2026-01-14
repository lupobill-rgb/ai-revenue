import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { openaiChatCompletionsRaw } from "../_shared/providers/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CampaignPlanRequest {
  goal: string;
  vertical: string;
  budget?: number;
  targetAudience?: string;
  businessProfile?: any;
  historicalPerformance?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { goal, vertical, budget, targetAudience, businessProfile, historicalPerformance }: CampaignPlanRequest = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

    console.log("AI Campaign Planner starting:", { goal, vertical, budget });

    // Build context from historical performance
    let performanceContext = "";
    if (historicalPerformance) {
      performanceContext = `
Historical Campaign Performance:
- Average engagement rate: ${historicalPerformance.avg_engagement_rate || 'N/A'}%
- Total conversions: ${historicalPerformance.total_conversions || 0}
- Best performing channel: ${historicalPerformance.best_channel || 'Unknown'}
- Best performing time: ${historicalPerformance.best_time || 'Unknown'}
`;
    }

    // Build business context
    let businessContext = "";
    if (businessProfile) {
      businessContext = `
Business Profile:
- Name: ${businessProfile.business_name || 'Unknown'}
- Industry: ${businessProfile.industry || vertical}
- Brand Voice: ${businessProfile.brand_voice || 'Professional'}
- Target Audiences: ${JSON.stringify(businessProfile.target_audiences || [])}
- Unique Selling Points: ${(businessProfile.unique_selling_points || []).join(', ')}
`;
    }

    const systemPrompt = `You are an expert AI marketing strategist. Your job is to create comprehensive, data-driven multi-channel marketing campaign plans that maximize ROI.

You must respond with a valid JSON object (no markdown, no code blocks) containing the campaign strategy.`;

    const userPrompt = `Create an autonomous multi-channel campaign strategy for:

Goal: ${goal}
Industry Vertical: ${vertical}
Budget: $${budget || 'Flexible'}
Target Audience: ${targetAudience || 'Not specified'}

${businessContext}
${performanceContext}

Generate a comprehensive campaign plan with:
1. Channel selection and prioritization (email, social, video, voice)
2. Budget allocation percentages per channel
3. Optimal timing/scheduling strategy
4. Content themes and messaging angles
5. Target audience segments
6. KPIs and success metrics
7. A/B testing recommendations

Respond with this exact JSON structure:
{
  "campaignName": "suggested campaign name",
  "strategy": "brief strategy summary",
  "channels": [
    {
      "channel": "email|social|video|voice",
      "priority": 1-4,
      "budgetPercent": 0-100,
      "rationale": "why this channel",
      "contentTheme": "main theme for this channel",
      "messagingAngle": "specific angle",
      "frequency": "posting/sending frequency",
      "bestTiming": "optimal day/time"
    }
  ],
  "targetSegments": [
    {
      "name": "segment name",
      "description": "who they are",
      "priority": 1-3,
      "channels": ["preferred channels"]
    }
  ],
  "schedule": {
    "launchDate": "recommended launch timing",
    "duration": "campaign duration",
    "phases": [
      {
        "name": "phase name",
        "duration": "how long",
        "focus": "main focus",
        "channels": ["active channels"]
      }
    ]
  },
  "kpis": [
    {
      "metric": "metric name",
      "target": "target value",
      "channel": "which channel"
    }
  ],
  "abTests": [
    {
      "name": "test name",
      "channel": "which channel",
      "variants": ["variant A description", "variant B description"],
      "metric": "success metric"
    }
  ],
  "estimatedResults": {
    "impressions": "estimated impressions",
    "clicks": "estimated clicks",
    "conversions": "estimated conversions",
    "roi": "expected ROI percentage"
  }
}`;

    const response = await openaiChatCompletionsRaw(
      {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
      OPENAI_API_KEY,
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON response
    let campaignPlan;
    try {
      // Clean the response - remove markdown code blocks if present
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
      campaignPlan = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse campaign plan");
    }

    console.log("Campaign plan generated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        plan: campaignPlan,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in ai-campaign-planner:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
