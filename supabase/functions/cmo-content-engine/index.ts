import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContentEngineRequest {
  workspaceId: string;
  campaignId?: string;
  funnelStage?: 'awareness' | 'consideration' | 'conversion' | 'retention' | 'advocacy';
  channels?: string[];
  ctaIntent?: 'educate' | 'engage' | 'convert' | 'retain' | 'refer';
  contentTypes?: string[];
}

const systemPrompt = `You are the Content Engine for the AI CMO module.
Your task is to produce brand-consistent, performance-oriented assets for each campaign.

## Your Role
- Expert content strategist who creates high-converting marketing assets
- Produce ready-to-edit content across all channels
- Maintain brand voice and tone consistency
- Create A/B variants for testing

## Output Schema (Database-Ready JSON)

You MUST output content assets in this EXACT JSON format:

\`\`\`json:content
{
  "assets": [
    {
      "asset_id": "string - unique identifier",
      "channel": "email|linkedin|facebook|instagram|twitter|google_ads|blog|landing_page|video_script",
      "asset_type": "string - e.g., nurture_email_1, linkedin_carousel, search_ad",
      "funnel_stage": "awareness|consideration|conversion|retention|advocacy",
      "title": "string - headline or subject line",
      "body": "string - main content in Markdown",
      "variant": "A|B",
      "metadata": {
        "cta": "string - primary call to action",
        "cta_url_placeholder": "string - {{LANDING_PAGE_URL}}",
        "target_icp": "string",
        "target_offer": "string",
        "tone": "string",
        "word_count": 0,
        "reading_time": "string",
        "keywords": ["string"],
        "hashtags": ["string"],
        "emoji_usage": "none|minimal|moderate"
      },
      "design_notes": {
        "visual_style": "string - image/video recommendations",
        "color_emphasis": "string - brand colors to highlight",
        "layout_suggestion": "string - content structure notes"
      },
      "performance_predictions": {
        "expected_ctr": 0.0,
        "expected_engagement": 0.0,
        "confidence": "low|medium|high"
      }
    }
  ],
  "content_summary": {
    "total_assets": 0,
    "channels_covered": ["string"],
    "funnel_stages_covered": ["string"],
    "estimated_production_time": "string"
  }
}
\`\`\`

## Content Rules (STRICT)

1. **Funnel Stage Alignment**: Each asset must align to its stage:
   - AWARENESS: Educational, value-driven, non-salesy
   - CONSIDERATION: Solution-focused, comparative, trust-building
   - CONVERSION: Urgency, social proof, clear value proposition
   - RETENTION: Helpful, relationship-building, exclusive value
   - ADVOCACY: Celebratory, community-focused, shareable

2. **High-Conversion Language**:
   - Lead with benefits, not features
   - Use active voice and strong verbs
   - Eliminate filler words and jargon
   - Keep sentences under 20 words on average

3. **CTA Alignment**:
   - EDUCATE: "Learn more", "Discover how", "Read the guide"
   - ENGAGE: "Join the conversation", "Share your thoughts"
   - CONVERT: "Start free trial", "Get started", "Book a demo"
   - RETAIN: "Explore new features", "Access exclusive"
   - REFER: "Invite a friend", "Share with your network"

4. **A/B Variants**: Include one variant per channel:
   - Variant A: Primary approach (proven messaging)
   - Variant B: Test approach (alternative angle, tone, or structure)
   - Both must be production-ready

## Channel-Specific Guidelines

**EMAIL**:
- Subject line: 40-60 characters, curiosity or benefit-driven
- Preview text: 40-90 characters
- Body: 150-300 words for nurture, 100-200 for promotional
- Personalization: {{first_name}}, {{company}}, {{offer_name}}

**LINKEDIN**:
- Post: 150-300 characters for engagement
- 3-5 relevant hashtags
- Professional but human tone
- Thought leadership angle

**FACEBOOK/INSTAGRAM**:
- Feed post: 125-150 characters optimal
- Use emojis strategically (2-4 per post)
- Hashtags: 5-10 for Instagram, 1-3 for Facebook

**GOOGLE ADS**:
- Headlines: 30 characters max each (3 headlines)
- Descriptions: 90 characters max each (2 descriptions)
- Include keywords naturally
- Strong CTA with urgency

**BLOG**:
- Title: 60-70 characters, SEO-optimized
- Meta description: 150-160 characters
- Structure: H1, H2s, H3s, bullet points
- Word count: 1,000-2,000 for standard

## Personalization Tokens

Use these tokens in content:
- {{first_name}} - Recipient's first name
- {{company}} - Company name
- {{industry}} - Industry
- {{job_title}} - Job title
- {{offer_name}} - Current offer/product
- {{pain_point}} - ICP's primary pain point
- {{benefit}} - Key benefit
- {{cta_url}} - Dynamic CTA URL

## Tone
- Brand-consistent
- Engaging and action-oriented
- Production-ready content`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId, campaignId, funnelStage, channels, ctaIntent, contentTypes } = await req.json() as ContentEngineRequest;
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Fetch all required data
    const [brandResult, icpResult, offersResult] = await Promise.all([
      supabase.from('cmo_brand_profiles').select('*').eq('workspace_id', workspaceId).single(),
      supabase.from('cmo_icp_segments').select('*').eq('workspace_id', workspaceId),
      supabase.from('cmo_offers').select('*').eq('workspace_id', workspaceId),
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
    const primaryIcp = icpSegments.find((icp: any) => icp.is_primary) || icpSegments[0];
    const flagshipOffer = offers.find((offer: any) => offer.is_flagship) || offers[0];

    console.log('CMO Content Engine - Context:', {
      brandName: brand.brand_name,
      icpCount: icpSegments.length,
      offersCount: offers.length,
      funnelStage,
      channels
    });

    // Build context prompt
    let contextPrompt = `## Brand Profile
- **Name:** ${brand.brand_name}
- **Industry:** ${brand.industry || 'Not specified'}
- **Voice:** ${brand.brand_voice || 'Professional'}
- **Tone:** ${brand.brand_tone || 'Confident'}
- **UVP:** ${brand.unique_value_proposition || 'Not specified'}
- **Messaging Pillars:** ${JSON.stringify(brand.messaging_pillars || [])}
- **Colors:** ${JSON.stringify(brand.brand_colors || {})}

## Primary ICP
${primaryIcp ? `
- **Name:** ${primaryIcp.segment_name}
- **Pain Points:** ${JSON.stringify(primaryIcp.pain_points || [])}
- **Goals:** ${JSON.stringify(primaryIcp.goals || [])}
- **Objections:** ${JSON.stringify(primaryIcp.objections || [])}
- **Preferred Channels:** ${JSON.stringify(primaryIcp.preferred_channels || [])}
- **Content Preferences:** ${JSON.stringify(primaryIcp.content_preferences || {})}
` : 'No ICP defined'}

## Primary Offer
${flagshipOffer ? `
- **Name:** ${flagshipOffer.offer_name}
- **Type:** ${flagshipOffer.offer_type}
- **Key Benefits:** ${JSON.stringify(flagshipOffer.key_benefits || [])}
- **Use Cases:** ${JSON.stringify(flagshipOffer.use_cases || [])}
` : 'No offer defined'}

## Content Request
- **Funnel Stage:** ${funnelStage || 'awareness'}
- **Channels:** ${channels?.join(', ') || 'email, linkedin, blog'}
- **CTA Intent:** ${ctaIntent || 'engage'}
- **Content Types:** ${contentTypes?.join(', ') || 'All applicable types'}

Generate brand-consistent, performance-oriented content assets with A/B variants for each channel.
Include personalization tokens where appropriate.
Make all content production-ready with specific copy.`;

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
    console.error('CMO Content Engine error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
