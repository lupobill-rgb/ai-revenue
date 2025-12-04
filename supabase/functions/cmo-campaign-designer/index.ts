import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignDesignerRequest {
  workspaceId: string;
  funnelId?: string;
  planId?: string;
  stageId?: string;
  goal?: 'lead_gen' | 'nurture' | 'reactivation' | 'retention' | 'awareness' | 'conversion';
  preferredChannels?: string[];
  budgetNotes?: string;
}

const systemPrompt = `You are the Campaign Designer for the UbiGrowth AI CMO module.
Your job is to transform a funnel stage into a complete marketing campaign.

## Your Role
- Expert campaign strategist who creates high-impact marketing campaigns
- Design campaigns with clear objectives, KPIs, and channel strategies
- Create content outlines and timeline recommendations
- Ensure brand consistency and ICP alignment

## Output Schema (Database-Ready JSON)

You MUST output a campaign structure in this EXACT JSON format:

\`\`\`json:campaign
{
  "campaign": {
    "campaign_name": "string - descriptive name",
    "campaign_type": "awareness|lead_gen|nurture|conversion|retention|reactivation",
    "objective": "string - specific measurable objective (SMART)",
    "description": "string - campaign overview",
    "target_icp": "string - ICP segment name",
    "target_offer": "string - offer name",
    "funnel_stage": "awareness|consideration|conversion|retention|advocacy",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "budget_allocation": 0,
    "primary_kpi": {
      "metric": "string",
      "target": 0,
      "measurement": "daily|weekly|monthly"
    },
    "secondary_kpis": [
      {"metric": "string", "target": 0}
    ],
    "success_criteria": "string - what defines campaign success"
  },
  "channels": [
    {
      "channel_name": "string - e.g., LinkedIn, Email, Google Ads",
      "channel_type": "paid|organic|owned|earned",
      "priority": "primary|secondary|supporting",
      "budget_percentage": 0,
      "content_types": [
        {
          "type": "string - e.g., carousel, video, blog post",
          "quantity": 0,
          "description": "string",
          "cta": "string"
        }
      ],
      "posting_frequency": "string",
      "targeting_notes": "string",
      "expected_metrics": {
        "reach": 0,
        "engagement_rate": 0.0,
        "conversion_rate": 0.0
      }
    }
  ],
  "content_outline": [
    {
      "content_id": "string",
      "title": "string",
      "content_type": "blog|video|infographic|email|ad|social_post|landing_page|webinar|case_study|ebook",
      "channel": "string",
      "funnel_stage": "awareness|consideration|conversion",
      "target_icp": "string",
      "key_message": "string",
      "supporting_points": ["string"],
      "cta": "string",
      "tone": "string",
      "estimated_production_time": "string",
      "dependencies": ["string"],
      "publish_date": "YYYY-MM-DD"
    }
  ],
  "timeline": [
    {
      "week": 1,
      "phase": "string - e.g., Setup, Launch, Optimization",
      "activities": ["string"],
      "deliverables": ["string"],
      "milestones": ["string"]
    }
  ],
  "complementary_suggestions": [
    {
      "campaign_type": "string",
      "rationale": "string",
      "synergy_score": 0
    }
  ]
}
\`\`\`

## Campaign Design Rules (STRICT)

1. **Clear Objective & KPIs**: Every campaign must have:
   - SMART objective (Specific, Measurable, Achievable, Relevant, Time-bound)
   - Primary KPI that directly measures success
   - 2-3 secondary KPIs for holistic tracking

2. **Channel-Content Mapping**: Map each channel to 2-3 content types:
   - Content types must fit the channel
   - Include production requirements and timeline
   - CTAs aligned with campaign objective

3. **Complementary Suggestions**: If active campaigns exist, suggest:
   - Campaigns that fill gaps
   - Synergy opportunities
   - Avoid audience fatigue

4. **Brand Consistency**: Preserve:
   - Brand voice and tone from profile
   - Messaging pillar alignment
   - Visual identity guidelines

## Campaign Type Guidelines

**AWARENESS**: Build brand recognition
- Channels: Social, display, PR, content
- KPIs: Impressions, reach, brand mentions
- Duration: 4-8 weeks

**LEAD_GEN**: Capture contact information
- Channels: Paid search, social ads, webinars
- KPIs: Leads, CPL, lead quality score
- Duration: Ongoing with 2-4 week cycles

**NURTURE**: Move leads toward conversion
- Channels: Email, retargeting, personalized content
- KPIs: Email engagement, MQL conversion
- Duration: 4-12 weeks per sequence

**CONVERSION**: Drive purchase decisions
- Channels: Sales enablement, demos, direct response
- KPIs: Conversion rate, revenue, deal velocity
- Duration: Aligned with sales cycle

**RETENTION**: Keep customers engaged
- Channels: Email, in-app, customer success
- KPIs: Retention rate, NPS, engagement
- Duration: Ongoing lifecycle

**REACTIVATION**: Re-engage dormant contacts
- Channels: Email, retargeting, direct outreach
- KPIs: Reactivation rate, recovered revenue
- Duration: 2-4 week bursts

## Tone
- Strategic and actionable
- Data-driven with specific metrics
- Production-ready recommendations`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId, funnelId, planId, stageId, goal, preferredChannels, budgetNotes } = await req.json() as CampaignDesignerRequest;
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Fetch all required data
    const [brandResult, icpResult, offersResult, funnelResult, stagesResult, planResult, campaignsResult] = await Promise.all([
      supabase.from('cmo_brand_profiles').select('*').eq('workspace_id', workspaceId).single(),
      supabase.from('cmo_icp_segments').select('*').eq('workspace_id', workspaceId),
      supabase.from('cmo_offers').select('*').eq('workspace_id', workspaceId),
      funnelId 
        ? supabase.from('cmo_funnels').select('*').eq('id', funnelId).single()
        : Promise.resolve({ data: null }),
      funnelId
        ? supabase.from('cmo_funnel_stages').select('*').eq('funnel_id', funnelId).order('stage_order')
        : Promise.resolve({ data: [] }),
      planId 
        ? supabase.from('cmo_marketing_plans').select('*').eq('id', planId).single()
        : Promise.resolve({ data: null }),
      supabase.from('campaigns').select('*').eq('workspace_id', workspaceId).eq('status', 'active')
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
    const funnel = funnelResult.data;
    const stages = stagesResult.data || [];
    const plan = planResult.data;
    const activeCampaigns = campaignsResult.data || [];

    console.log('CMO Campaign Designer - Context:', {
      brandName: brand.brand_name,
      icpCount: icpSegments.length,
      offersCount: offers.length,
      hasFunnel: !!funnel,
      stagesCount: stages.length,
      activeCampaigns: activeCampaigns.length
    });

    // Build context prompt
    let contextPrompt = `## Brand
- **Name:** ${brand.brand_name}
- **Industry:** ${brand.industry || 'Not specified'}
- **Voice:** ${brand.brand_voice || 'Not specified'}
- **Tone:** ${brand.brand_tone || 'Not specified'}
- **UVP:** ${brand.unique_value_proposition || 'Not specified'}
- **Messaging Pillars:** ${JSON.stringify(brand.messaging_pillars || [])}

## ICP Segments (${icpSegments.length})
${icpSegments.map((icp: any) => `
### ${icp.segment_name}${icp.is_primary ? ' [PRIMARY]' : ''}
- Pain Points: ${JSON.stringify(icp.pain_points || [])}
- Goals: ${JSON.stringify(icp.goals || [])}
- Preferred Channels: ${JSON.stringify(icp.preferred_channels || [])}
`).join('')}

## Offers (${offers.length})
${offers.map((offer: any) => `
### ${offer.offer_name}${offer.is_flagship ? ' [FLAGSHIP]' : ''}
- Type: ${offer.offer_type}
- Key Benefits: ${JSON.stringify(offer.key_benefits || [])}
`).join('')}`;

    if (funnel) {
      contextPrompt += `

## Funnel Context
- **Name:** ${funnel.funnel_name}
- **Type:** ${funnel.funnel_type}
- **Description:** ${funnel.description || 'Not specified'}

### Stages
${stages.map((stage: any) => `
#### ${stage.stage_name} (${stage.stage_type})
- Objective: ${stage.objective || 'Not specified'}
- KPIs: ${JSON.stringify(stage.kpis || [])}
- Campaign Types: ${JSON.stringify(stage.campaign_types || [])}
- Channels: ${JSON.stringify(stage.channels || [])}
`).join('')}`;
    }

    if (plan) {
      contextPrompt += `

## 90-Day Plan Context
- **Plan Name:** ${plan.plan_name}
- **Objectives:** ${JSON.stringify(plan.primary_objectives || [])}
- **Key Metrics:** ${JSON.stringify(plan.key_metrics || [])}`;
    }

    if (activeCampaigns.length > 0) {
      contextPrompt += `

## Active Campaigns (${activeCampaigns.length})
${activeCampaigns.map((c: any) => `- ${c.channel}: Status ${c.status}`).join('\n')}
Consider complementary campaigns that don't overlap.`;
    }

    contextPrompt += `

## Campaign Request
- **Goal:** ${goal || 'lead_gen'}
- **Preferred Channels:** ${preferredChannels?.join(', ') || 'Any'}
- **Budget Notes:** ${budgetNotes || 'Not specified'}

Design a complete marketing campaign with channels, content outline, and timeline.`;

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
    console.error('CMO Campaign Designer error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
