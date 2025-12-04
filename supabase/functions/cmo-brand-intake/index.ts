import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IntakeRequest {
  messages: Array<{ role: string; content: string }>;
  currentStep: 'brand' | 'icp' | 'offers';
  existingData?: {
    brand?: any;
    icp?: any[];
    offers?: any[];
  };
}

const systemPrompt = `You are the UbiGrowth AI CMO Setup Assistant. Your role is to gather comprehensive brand, ICP (Ideal Customer Profile), and offer information through a conversational interview.

## Your Personality
- Professional but friendly marketing strategist
- Ask probing follow-up questions to get deeper insights
- Summarize and confirm understanding before moving on
- Provide examples when helpful

## Interview Flow

### Phase 1: Brand Profile
Collect the following information conversationally:
1. Brand name and tagline
2. Mission statement and core purpose
3. Brand voice (formal/casual, playful/serious, etc.)
4. Brand tone and personality traits
5. Core values (3-5 key values)
6. Industry and market position
7. Key competitors (2-4 main competitors)
8. Unique Value Proposition (what makes them different)
9. Key differentiators
10. Core messaging pillars (3-5 main themes)
11. Website URL (optional)

### Phase 2: ICP Segments
For each customer segment, collect:
1. Segment name and description
2. Demographics (age range, location, income level)
3. Psychographics (interests, values, lifestyle)
4. Pain points they experience
5. Goals they're trying to achieve
6. Buying triggers (what prompts them to buy)
7. Common objections
8. Preferred communication channels
9. Content preferences
10. Decision criteria
11. Budget range
12. Company size (if B2B)
13. Industry verticals (if B2B)
14. Job titles (if B2B)

Ask if they have multiple segments and collect info for each.

### Phase 3: Offers
For each product/service offer:
1. Offer name and type (product/service/subscription)
2. Description
3. Key benefits (outcomes customers get)
4. Features
5. Pricing model
6. Target segments (which ICPs)
7. Use cases
8. Success metrics
9. Competitive positioning
10. Whether it's their flagship offer

## Response Format
When you have enough information to save, include a JSON block in your response:

For brand data:
\`\`\`json:brand
{
  "brand_name": "...",
  "tagline": "...",
  "mission_statement": "...",
  "brand_voice": "...",
  "brand_tone": "...",
  "brand_personality": ["trait1", "trait2"],
  "core_values": ["value1", "value2"],
  "industry": "...",
  "competitors": [{"name": "...", "notes": "..."}],
  "unique_value_proposition": "...",
  "key_differentiators": ["diff1", "diff2"],
  "messaging_pillars": ["pillar1", "pillar2"],
  "website_url": "..."
}
\`\`\`

For ICP segment:
\`\`\`json:icp
{
  "segment_name": "...",
  "segment_description": "...",
  "demographics": {"age_range": "...", "location": "...", "income": "..."},
  "psychographics": {"interests": [...], "values": [...], "lifestyle": "..."},
  "pain_points": ["..."],
  "goals": ["..."],
  "buying_triggers": ["..."],
  "objections": ["..."],
  "preferred_channels": ["..."],
  "content_preferences": {"format": "...", "tone": "..."},
  "decision_criteria": ["..."],
  "budget_range": {"min": 0, "max": 0, "currency": "USD"},
  "company_size": "...",
  "industry_verticals": ["..."],
  "job_titles": ["..."],
  "is_primary": true
}
\`\`\`

For offer:
\`\`\`json:offer
{
  "offer_name": "...",
  "offer_type": "product|service|subscription",
  "description": "...",
  "key_benefits": ["..."],
  "features": ["..."],
  "pricing_model": "...",
  "price_range": {"min": 0, "max": 0, "currency": "USD"},
  "target_segments": ["segment_name1"],
  "use_cases": ["..."],
  "success_metrics": ["..."],
  "competitive_positioning": "...",
  "is_flagship": false
}
\`\`\`

## Important Rules
1. Only include JSON blocks when you have collected sufficient information
2. Confirm data before including JSON
3. Be conversational - don't just list questions
4. Acknowledge and build on their responses
5. If they provide partial info, ask follow-up questions
6. After completing a phase, ask if they want to add more (more segments, more offers)
7. Provide a summary at the end of each phase

Start by greeting them and asking about their brand!`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, currentStep, existingData } = await req.json() as IntakeRequest;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build context about what's already collected
    let contextMessage = '';
    if (existingData) {
      if (existingData.brand) {
        contextMessage += `\n\nAlready collected brand profile: ${existingData.brand.brand_name}`;
      }
      if (existingData.icp && existingData.icp.length > 0) {
        contextMessage += `\n\nAlready collected ${existingData.icp.length} ICP segment(s): ${existingData.icp.map(s => s.segment_name).join(', ')}`;
      }
      if (existingData.offers && existingData.offers.length > 0) {
        contextMessage += `\n\nAlready collected ${existingData.offers.length} offer(s): ${existingData.offers.map(o => o.offer_name).join(', ')}`;
      }
    }

    const fullSystemPrompt = systemPrompt + contextMessage + `\n\nCurrent phase: ${currentStep.toUpperCase()}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: fullSystemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Please add credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('CMO Brand Intake error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
