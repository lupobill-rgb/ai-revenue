import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptimizationRequest {
  workspaceId: string;
  planId?: string;
  funnelId?: string;
  period?: 'last_7_days' | 'last_30_days' | 'last_90_days';
}

const systemPrompt = `You are the Optimization Analyst for the AI CMO module.
Your role is to identify underperforming areas and generate actionable recommendations.

## Your Role
- Expert marketing analyst who identifies performance gaps
- Generate prioritized, actionable recommendations
- Focus on ROI-maximizing fixes
- Provide data-driven insights

## Output Schema (Database-Ready JSON)

You MUST output recommendations in this EXACT JSON format:

\`\`\`json:recommendations
{
  "analysis_summary": {
    "analysis_date": "YYYY-MM-DD",
    "period_analyzed": "string - e.g., Last 7 days, Last 30 days",
    "overall_health": "healthy|needs_attention|critical",
    "top_performer": {
      "type": "campaign|funnel|channel",
      "name": "string",
      "key_metric": "string",
      "value": 0
    },
    "biggest_opportunity": {
      "type": "campaign|funnel|channel",
      "name": "string",
      "potential_lift": "string - e.g., +25% conversions"
    }
  },
  "recommendations": [
    {
      "recommendation_id": "string",
      "source_type": "campaign|funnel|channel|content|audience",
      "source_id": "uuid or null",
      "source_name": "string",
      "category": "performance|budget|targeting|content|timing|technical",
      "title": "string - concise action title",
      "description": "string - detailed explanation",
      "severity": "info|warning|critical",
      "impact": "low|medium|high",
      "effort": "low|medium|high",
      "priority_score": 0,
      "metrics_affected": [
        {
          "metric": "string",
          "current_value": 0,
          "target_value": 0,
          "gap": 0,
          "gap_percentage": 0.0
        }
      ],
      "suggested_actions": [
        {
          "action": "string - specific step",
          "timeline": "string - e.g., immediate, this week",
          "owner": "string - suggested role",
          "expected_outcome": "string"
        }
      ],
      "supporting_data": {
        "trend": "improving|declining|stable",
        "comparison_period": "string",
        "benchmark_comparison": "above|at|below"
      }
    }
  ],
  "quick_wins": [
    {
      "action": "string",
      "expected_impact": "string",
      "time_to_implement": "string"
    }
  ],
  "next_steps": [
    {
      "step": "string - specific action",
      "priority": 1,
      "timeline": "string",
      "resources_needed": "string"
    }
  ]
}
\`\`\`

## Analysis Rules (STRICT)

1. **Actionable Insight, Not Explanation**:
   - Lead with the action, then provide context
   - Be specific to the data provided
   - Every recommendation must have clear "do this" steps

2. **Campaign/Funnel Linkage**:
   - Include source_id for direct reference
   - Specify which metrics are affected
   - Show gap between current and target

3. **Next Steps Required**:
   - 1-3 prioritized next steps
   - Include timeline and owner suggestions
   - Make steps immediately executable

4. **ROI Prioritization**:
   - Calculate priority_score based on impact/effort ratio
   - Flag quick wins prominently
   - Consider resource constraints

## Severity Classification

**CRITICAL** (Immediate Action):
- Performance dropped >50% from baseline
- Spend efficiency below 50% of target
- Key conversion funnel broken
- Budget depletion rate unsustainable

**WARNING** (This Week):
- Performance dropped 25-50%
- Metrics trending down 3+ periods
- Missing milestones by >20%
- Audience fatigue detected

**INFO** (Monitor):
- Minor variations (<25%)
- Optimization opportunities
- Best practice improvements
- Testing recommendations

## Category Definitions

**PERFORMANCE**: CTR, conversion, engagement, ROAS issues
**BUDGET**: Overspending, underspending, misallocation
**TARGETING**: Audience overlap, saturation, mismatch
**CONTENT**: Creative fatigue, low engagement, message issues
**TIMING**: Suboptimal posting, frequency, pacing
**TECHNICAL**: Tracking, landing page, integration issues

## Priority Score Formula

Priority Score = (Impact × 3) + (Urgency × 2) - Effort

Where each factor is 1-10 scale.

## Benchmarks Reference

Email: Open 20-25% (avg), CTR 2.5-3% (avg)
LinkedIn: Engagement 2% (avg), 4%+ (excellent)
Facebook: Engagement 0.5-1% (avg)
Google Ads: CTR 3-5% (avg), 7%+ (excellent)
Landing Page: Conversion 2-5% (avg), 10%+ (excellent)

## Tone
- Strategic and urgent for critical issues
- Data-driven with specific numbers
- Actionable with clear next steps`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId, planId, funnelId, period } = await req.json() as OptimizationRequest;
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Fetch all required data
    const [brandResult, campaignsResult, metricsResult, planResult, funnelResult, stagesResult] = await Promise.all([
      supabase.from('cmo_brand_profiles').select('*').eq('workspace_id', workspaceId).single(),
      supabase.from('campaigns').select('*').eq('workspace_id', workspaceId),
      supabase.from('campaign_metrics').select('*').eq('workspace_id', workspaceId),
      planId 
        ? supabase.from('cmo_marketing_plans').select('*').eq('id', planId).single()
        : Promise.resolve({ data: null }),
      funnelId
        ? supabase.from('cmo_funnels').select('*').eq('id', funnelId).single()
        : Promise.resolve({ data: null }),
      funnelId
        ? supabase.from('cmo_funnel_stages').select('*').eq('funnel_id', funnelId).order('stage_order')
        : Promise.resolve({ data: [] })
    ]);

    const brand = brandResult.data;
    const campaigns = campaignsResult.data || [];
    const metrics = metricsResult.data || [];
    const plan = planResult.data;
    const funnel = funnelResult.data;
    const stages = stagesResult.data || [];

    console.log('CMO Optimization Analyst - Context:', {
      brandName: brand?.brand_name,
      campaignsCount: campaigns.length,
      metricsCount: metrics.length,
      hasPlan: !!plan,
      hasFunnel: !!funnel
    });

    // Build context prompt
    let contextPrompt = `## Workspace Overview
- **Brand:** ${brand?.brand_name || 'Not configured'}
- **Industry:** ${brand?.industry || 'Not specified'}
- **Analysis Period:** ${period || 'last_30_days'}

## Campaign Performance Data (${campaigns.length} campaigns)
${campaigns.length > 0 ? campaigns.map((c: any) => {
  const campaignMetrics = metrics.find((m: any) => m.campaign_id === c.id);
  return `
### Campaign: ${c.channel}
- Status: ${c.status}
- Budget: $${c.budget_allocated || 0}
- Metrics: ${campaignMetrics ? `
  - Impressions: ${campaignMetrics.impressions || 0}
  - Clicks: ${campaignMetrics.clicks || 0}
  - Conversions: ${campaignMetrics.conversions || 0}
  - CTR: ${campaignMetrics.impressions > 0 ? ((campaignMetrics.clicks / campaignMetrics.impressions) * 100).toFixed(2) : 0}%
  - Cost: $${campaignMetrics.cost || 0}
  - Revenue: $${campaignMetrics.revenue || 0}
  - ROAS: ${campaignMetrics.cost > 0 ? (campaignMetrics.revenue / campaignMetrics.cost).toFixed(2) : 0}
` : 'No metrics available'}`;
}).join('') : 'No campaigns found - recommend starting with campaign creation.'}

## Aggregated Metrics
${metrics.length > 0 ? `
- Total Impressions: ${metrics.reduce((sum: number, m: any) => sum + (m.impressions || 0), 0)}
- Total Clicks: ${metrics.reduce((sum: number, m: any) => sum + (m.clicks || 0), 0)}
- Total Conversions: ${metrics.reduce((sum: number, m: any) => sum + (m.conversions || 0), 0)}
- Total Cost: $${metrics.reduce((sum: number, m: any) => sum + (m.cost || 0), 0)}
- Total Revenue: $${metrics.reduce((sum: number, m: any) => sum + (m.revenue || 0), 0)}
- Overall CTR: ${(() => {
  const totalImpressions = metrics.reduce((sum: number, m: any) => sum + (m.impressions || 0), 0);
  const totalClicks = metrics.reduce((sum: number, m: any) => sum + (m.clicks || 0), 0);
  return totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;
})()}%
- Overall ROAS: ${(() => {
  const totalCost = metrics.reduce((sum: number, m: any) => sum + (m.cost || 0), 0);
  const totalRevenue = metrics.reduce((sum: number, m: any) => sum + (m.revenue || 0), 0);
  return totalCost > 0 ? (totalRevenue / totalCost).toFixed(2) : 0;
})()}
` : 'No metrics data available'}`;

    if (plan) {
      contextPrompt += `

## 90-Day Plan Goals
- **Plan:** ${plan.plan_name}
- **Primary Objectives:** ${JSON.stringify(plan.primary_objectives || [])}
- **Key Metrics:** ${JSON.stringify(plan.key_metrics || [])}
- **Target ICPs:** ${JSON.stringify(plan.target_icp_segments || [])}`;
    }

    if (funnel) {
      contextPrompt += `

## Funnel Performance
- **Funnel:** ${funnel.funnel_name}
- **Expected Conversion:** ${funnel.expected_conversion_rate}%
- **Expected Revenue:** $${funnel.expected_revenue || 0}

### Stages
${stages.map((s: any) => `
- ${s.stage_name} (${s.stage_type}): Target ${s.conversion_rate_target}% conversion, Volume ${s.expected_volume}
`).join('')}`;
    }

    contextPrompt += `

## Analysis Request
Analyze the performance data and generate:
1. Overall health assessment
2. Prioritized recommendations with severity levels
3. Quick wins that can be implemented immediately
4. Specific next steps with timelines

Focus on actionable insights with highest ROI impact.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('AI gateway error');
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('CMO Optimization Analyst error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
