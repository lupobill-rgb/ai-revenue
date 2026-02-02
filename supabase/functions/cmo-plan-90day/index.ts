import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlanRequest {
  tenantId: string;
  primaryGoal?: string;
  budget?: number;
  targetMetrics?: {
    revenue?: number;
    mqls?: number;
    reach?: number;
  };
  constraints?: {
    channels?: string[];
    timeframe?: string;
  };
  startDate?: string;
}

const systemPrompt = `You are the AI Marketing Strategist for the AI CMO module.
Your goal is to generate a focused, data-driven 90-day marketing plan.

## Your Role
- Strategic marketing planner with a tactical, metrics-focused approach
- Create actionable plans with clear KPIs and timeline checkpoints
- Every milestone links to specific funnel or campaign actions
- Keep output concise and data-driven

## Output Schema (Database-Ready JSON)

You MUST output a 90-day plan in this EXACT JSON format:

\`\`\`json:plan
{
  "plan": {
    "name": "string - descriptive plan name",
    "goal_summary": "string - 1-2 sentence strategic goal summary",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "budget_note": "string - budget allocation summary",
    "milestones": [
      {
        "label": "string - phase or campaign name",
        "target_date": "YYYY-MM-DD",
        "metric": "leads|mqls|revenue|reach|conversions|signups|engagement|traffic",
        "target_value": 0,
        "funnel_action": "string - specific campaign or funnel action",
        "channels": ["channel1", "channel2"],
        "dependencies": ["string - what must be ready"]
      }
    ],
    "kpis": [
      {
        "metric": "string",
        "baseline": 0,
        "target": 0,
        "measurement": "daily|weekly|monthly"
      }
    ],
    "weekly_checkpoints": [
      {
        "week": 1,
        "focus": "string - primary focus",
        "deliverables": ["string"],
        "success_criteria": "string"
      }
    ],
    "channel_allocation": [
      {
        "channel": "string",
        "budget_percentage": 0,
        "primary_metric": "string",
        "target_icp": "string"
      }
    ],
    "risk_flags": [
      {
        "risk": "string",
        "mitigation": "string",
        "trigger": "string - when to activate mitigation"
      }
    ]
  }
}
\`\`\`

## Planning Rules (STRICT)

1. **Measurable KPIs**: Every milestone MUST have a quantifiable target_value and specific metric
2. **Timeline Checkpoints**: Include weekly checkpoints for first month, bi-weekly for months 2-3
3. **Funnel-Linked Actions**: Each milestone must specify the funnel_action it drives
4. **90-Day Scope**: Plan must fit within one quarter (approximately 90 days)
5. **ICP-Driven**: Target specific ICP segments with each channel/campaign
6. **Data-Driven Targets**: Base targets on industry benchmarks when baseline unknown:
   - Email: 20-25% open rate, 2-3% CTR
   - Social: 1-3% engagement rate
   - Paid: $20-50 CAC for B2B SaaS
   - Content: 2-5% conversion on gated content
7. **Budget Realism**: Allocate budget based on channel effectiveness for target ICPs

## Milestone Structure Guidelines

Create 8-12 milestones across the 90 days:
- **Days 1-14**: Foundation (analytics setup, asset creation, audience building)
- **Days 15-30**: Launch (initial campaigns live, baseline data collection)
- **Days 31-60**: Optimization (A/B tests, scaling winners, cutting losers)
- **Days 61-90**: Scale (compound gains, prepare Q2 handoff)

## Tone
- Concise and tactical
- Data-driven with specific numbers
- Action-oriented language
- No fluff or generic marketing speak`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId, primaryGoal, budget, targetMetrics, constraints, startDate } = await req.json() as PlanRequest;
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch brand, ICP, and offers data
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const [brandResult, icpResult, offersResult] = await Promise.all([
      supabase.from('cmo_brand_profiles').select('*').eq('tenant_id', tenantId).single(),
      supabase.from('cmo_icp_segments').select('*').eq('tenant_id', tenantId),
      supabase.from('cmo_offers').select('*').eq('tenant_id', tenantId)
    ]);

    if (!brandResult.data) {
      return new Response(JSON.stringify({ 
        error: 'Brand profile not found. Complete brand intake first.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const brand = brandResult.data;
    const icpSegments = icpResult.data || [];
    const offers = offersResult.data || [];

    console.log('CMO 90-Day Plan - Context:', {
      brandName: brand.brand_name,
      icpCount: icpSegments.length,
      offersCount: offers.length,
      goal: primaryGoal,
      budget
    });

    // Calculate dates
    const start = startDate ? new Date(startDate) : new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 90);

    // Build context prompt
    const contextPrompt = `## Brand Profile
- **Name:** ${brand.brand_name}
- **Industry:** ${brand.industry || 'Not specified'}
- **UVP:** ${brand.unique_value_proposition || 'Not specified'}
- **Voice:** ${brand.brand_voice || 'Professional'}
- **Differentiators:** ${JSON.stringify(brand.key_differentiators || [])}

## ICP Segments (${icpSegments.length})
${icpSegments.map((icp, i) => `
### ${icp.segment_name}${icp.is_primary ? ' [PRIMARY]' : ''}
- Pain Points: ${JSON.stringify(icp.pain_points || [])}
- Goals: ${JSON.stringify(icp.goals || [])}
- Buying Triggers: ${JSON.stringify(icp.buying_triggers || [])}
- Channels: ${JSON.stringify(icp.preferred_channels || [])}
- Budget: ${JSON.stringify(icp.budget_range || {})}
`).join('')}

## Offers (${offers.length})
${offers.map((offer, i) => `
### ${offer.offer_name}${offer.is_flagship ? ' [FLAGSHIP]' : ''}
- Type: ${offer.offer_type}
- Benefits: ${JSON.stringify(offer.key_benefits || [])}
- Target ICPs: ${JSON.stringify(offer.target_segments || [])}
- Pricing: ${offer.pricing_model || 'Not specified'}
`).join('')}

## Marketing Goals
- **Primary Goal:** ${primaryGoal || 'Growth and lead generation'}
- **Target Metrics:**
  - Revenue: ${targetMetrics?.revenue ? `$${targetMetrics.revenue.toLocaleString()}` : 'Not specified'}
  - MQLs: ${targetMetrics?.mqls || 'Not specified'}
  - Reach: ${targetMetrics?.reach || 'Not specified'}

## Constraints
- **Budget:** ${budget ? `$${budget.toLocaleString()}` : 'Flexible'}
- **Channels:** ${constraints?.channels?.length ? constraints.channels.join(', ') : 'All available'}
- **Timeframe:** ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]} (90 days)

Generate a tactical, data-driven 90-day marketing plan with measurable milestones.`;

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
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Add credits.' }), {
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
    console.error('CMO 90-Day Plan error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
