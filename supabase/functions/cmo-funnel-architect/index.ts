import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FunnelRequest {
  workspaceId: string;
  planId?: string;
  funnelType?: 'marketing' | 'sales' | 'product';
}

const systemPrompt = `You are the Funnel Architect for the UbiGrowth AI CMO module.
Your task is to design complete funnel structures aligned with the 90-day marketing plan.

## Your Role
- Expert funnel strategist who designs high-converting customer journeys
- Create stage-by-stage funnels with measurable KPIs
- Link every stage to specific offers, ICPs, and campaign types
- Balance awareness-building with conversion optimization

## Output Schema (Database-Ready JSON)

You MUST output a funnel structure in this EXACT JSON format:

\`\`\`json:funnel
{
  "funnel": {
    "funnel_name": "string - descriptive name",
    "funnel_type": "marketing|sales|product",
    "description": "string - funnel purpose and expected outcomes",
    "target_icp_segments": ["segment_name1", "segment_name2"],
    "target_offers": ["offer_name1", "offer_name2"],
    "total_budget": 0,
    "expected_conversion_rate": 0.0,
    "expected_revenue": 0
  },
  "stages": [
    {
      "stage_name": "string",
      "stage_type": "awareness|consideration|conversion|retention|advocacy",
      "stage_order": 1,
      "description": "string",
      "objective": "string - specific goal for this stage",
      "kpis": [
        {
          "metric": "string",
          "target": 0,
          "measurement": "daily|weekly|monthly"
        }
      ],
      "campaign_types": [
        {
          "type": "string - e.g., content marketing, paid social, email nurture",
          "description": "string",
          "estimated_cost": 0,
          "expected_results": "string"
        }
      ],
      "channels": ["channel1", "channel2"],
      "content_assets": [
        {
          "asset_type": "blog|video|infographic|ebook|webinar|case_study|email|ad",
          "title": "string",
          "purpose": "string",
          "target_icp": "string"
        }
      ],
      "target_icps": ["icp_segment_name"],
      "linked_offers": ["offer_name"],
      "entry_criteria": "string - what qualifies someone to enter this stage",
      "exit_criteria": "string - what moves someone to next stage",
      "expected_volume": 0,
      "conversion_rate_target": 0.0,
      "budget_allocation": 0
    }
  ]
}
\`\`\`

## Funnel Design Rules (STRICT)

1. **Minimum Three Stages**: Must include at minimum:
   - AWARENESS: Top-of-funnel, brand discovery, problem awareness
   - CONSIDERATION: Mid-funnel, solution evaluation, comparison
   - CONVERSION: Bottom-funnel, purchase decision, signup

2. **KPIs Per Stage**: Each stage MUST define at least 2 measurable KPIs with targets

3. **Campaign Types**: Each stage must have 1-3 suggested campaign types with:
   - Type name and description
   - Estimated cost
   - Expected results

4. **ICP & Offer Linking**: Every stage must specify:
   - Which ICP segments it targets
   - Which offers are relevant at that stage

5. **Entry/Exit Criteria**: Clear criteria for stage transitions

6. **Volume Estimation**: Calculate expected volume flow:
   - Start with awareness volume
   - Apply conversion rates stage-to-stage
   - End with conversion volume

## Stage Type Guidelines

**AWARENESS Stage:**
- Goal: Reach and attract target audience
- Channels: Social, SEO, PR, Display ads, Content
- KPIs: Impressions, reach, traffic, video views
- Conversion: 1-5% to next stage

**CONSIDERATION Stage:**
- Goal: Engage and educate interested prospects
- Channels: Email, Retargeting, Webinars, Gated content
- KPIs: Email signups, content downloads, time on site
- Conversion: 10-30% to next stage

**CONVERSION Stage:**
- Goal: Convert prospects to customers
- Channels: Sales, Demo, Trial, Direct response
- KPIs: Demos booked, trials started, purchases
- Conversion: 5-25% to close

**RETENTION Stage (Optional):**
- Goal: Keep customers engaged, prevent churn
- Channels: Email, In-app, Success team
- KPIs: Retention rate, NPS, engagement

**ADVOCACY Stage (Optional):**
- Goal: Turn customers into promoters
- Channels: Referral, Reviews, Community
- KPIs: Referrals, reviews, testimonials

## Tone
- Strategic and systematic
- Data-driven with specific metrics
- Actionable campaign recommendations`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId, planId, funnelType } = await req.json() as FunnelRequest;
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Fetch all required data
    const [brandResult, icpResult, offersResult, planResult] = await Promise.all([
      supabase.from('cmo_brand_profiles').select('*').eq('workspace_id', workspaceId).single(),
      supabase.from('cmo_icp_segments').select('*').eq('workspace_id', workspaceId),
      supabase.from('cmo_offers').select('*').eq('workspace_id', workspaceId),
      planId 
        ? supabase.from('cmo_marketing_plans').select('*').eq('id', planId).single()
        : Promise.resolve({ data: null })
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
    const plan = planResult.data;

    console.log('CMO Funnel Architect - Context:', {
      brandName: brand.brand_name,
      icpCount: icpSegments.length,
      offersCount: offers.length,
      hasPlan: !!plan
    });

    // Build context prompt
    let contextPrompt = `## Brand
- **Name:** ${brand.brand_name}
- **Industry:** ${brand.industry || 'Not specified'}
- **UVP:** ${brand.unique_value_proposition || 'Not specified'}

## ICP Segments (${icpSegments.length})
${icpSegments.map((icp) => `
### ${icp.segment_name}${icp.is_primary ? ' [PRIMARY]' : ''}
- Pain Points: ${JSON.stringify(icp.pain_points || [])}
- Goals: ${JSON.stringify(icp.goals || [])}
- Buying Triggers: ${JSON.stringify(icp.buying_triggers || [])}
- Preferred Channels: ${JSON.stringify(icp.preferred_channels || [])}
- Objections: ${JSON.stringify(icp.objections || [])}
`).join('')}

## Offers (${offers.length})
${offers.map((offer) => `
### ${offer.offer_name}${offer.is_flagship ? ' [FLAGSHIP]' : ''}
- Type: ${offer.offer_type}
- Key Benefits: ${JSON.stringify(offer.key_benefits || [])}
- Target ICPs: ${JSON.stringify(offer.target_segments || [])}
- Use Cases: ${JSON.stringify(offer.use_cases || [])}
`).join('')}`;

    if (plan) {
      contextPrompt += `

## 90-Day Plan Context
- **Plan Name:** ${plan.plan_name}
- **Goals:** ${plan.executive_summary || 'Not specified'}
- **Primary Objectives:** ${JSON.stringify(plan.primary_objectives || [])}
- **Key Metrics:** ${JSON.stringify(plan.key_metrics || [])}
- **Budget:** ${JSON.stringify(plan.budget_allocation || {})}
- **Target ICPs:** ${JSON.stringify(plan.target_icp_segments || [])}
- **Target Offers:** ${JSON.stringify(plan.target_offers || [])}`;
    }

    contextPrompt += `

## Request
- **Funnel Type:** ${funnelType || 'marketing'}
- Design a complete funnel with minimum 3 stages (Awareness, Consideration, Conversion)
- Link each stage to the relevant ICPs and offers
- Include measurable KPIs and campaign recommendations`;

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
    console.error('CMO Funnel Architect error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
