import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignBuilderInput {
  tenant_id: string;
  workspace_id?: string;
  icp: string;
  offer: string;
  channels: string[];
  desired_result: 'leads' | 'meetings' | 'revenue' | 'engagement';
}

interface GeneratedAssets {
  posts: Array<{
    channel: string;
    content: string;
    hook: string;
    cta: string;
  }>;
  emails: Array<{
    step: number;
    subject: string;
    body: string;
    delay_days: number;
  }>;
  sms: Array<{
    step: number;
    message: string;
    delay_days: number;
  }>;
  landing_pages: Array<{
    title: string;
    headline: string;
    subheadline: string;
    sections: any[];
  }>;
  voice_scripts: Array<{
    scenario: string;
    opening: string;
    pitch: string;
    objection_handling: string;
    close: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const input: CampaignBuilderInput = await req.json();
    const { tenant_id, workspace_id, icp, offer, channels, desired_result } = input;

    if (!tenant_id || !icp || !offer || !channels?.length || !desired_result) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: tenant_id, icp, offer, channels, desired_result' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const workspaceId = workspace_id || tenant_id;

    console.log(`Campaign Builder: Building campaign for tenant ${tenant_id}`);
    console.log(`Channels: ${channels.join(', ')}, Goal: ${desired_result}`);

    // Fetch brand profile for context
    const { data: brandProfile } = await supabase
      .from('cmo_brand_profiles')
      .select('*')
      .eq('tenant_id', tenant_id)
      .single();

    const brandContext = brandProfile ? `
Brand: ${brandProfile.brand_name}
Industry: ${brandProfile.industry || 'Not specified'}
Voice: ${brandProfile.brand_voice || 'Professional'}
Tone: ${brandProfile.brand_tone || 'Friendly'}
Value Proposition: ${brandProfile.unique_value_proposition || offer}
` : `Brand context not available. Use the offer description for tone.`;

    // Build the AI prompt
    const systemPrompt = `You are an expert AI CMO campaign builder. Your job is to create comprehensive, multi-channel marketing campaigns.

${brandContext}

Generate high-converting marketing assets that are:
- Personalized to the ICP
- Aligned with the brand voice
- Optimized for the desired outcome
- Ready to deploy across channels

Output ONLY valid JSON matching the exact schema requested.`;

    const userPrompt = `Create a complete multi-channel campaign with the following parameters:

**Target ICP:**
${icp}

**Offer:**
${offer}

**Channels to use:** ${channels.join(', ')}

**Primary Goal:** ${desired_result}

Generate the following assets in JSON format:

{
  "campaign_name": "descriptive campaign name",
  "campaign_summary": "brief summary of the campaign strategy",
  "posts": [
    // For each social channel (if included): 3 posts per channel
    { "channel": "linkedin|twitter|instagram", "content": "full post text", "hook": "attention grabber", "cta": "call to action" }
  ],
  "emails": [
    // 5-step email sequence
    { "step": 1, "subject": "subject line", "body": "email body with personalization tokens like {{first_name}}", "delay_days": 0 }
  ],
  "sms": [
    // 3 SMS messages (if sms channel included)
    { "step": 1, "message": "SMS text under 160 chars", "delay_days": 0 }
  ],
  "landing_pages": [
    // 1 landing page structure
    { 
      "title": "page title", 
      "headline": "main headline", 
      "subheadline": "supporting text",
      "sections": [
        { "type": "hero|features|testimonials|cta", "content": {} }
      ]
    }
  ],
  "voice_scripts": [
    // 2 voice call scripts (if voice channel included)
    { 
      "scenario": "cold_call|follow_up|demo_booking",
      "opening": "opening line",
      "pitch": "main pitch",
      "objection_handling": "common objection responses",
      "close": "closing and CTA"
    }
  ],
  "automation_steps": [
    // Suggested automation flow
    { "step": 1, "type": "email|sms|wait|voice|condition", "delay_days": 0, "config": {} }
  ]
}

Only include asset types for the channels specified. Make content compelling and conversion-focused.`;

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices?.[0]?.message?.content;

    if (!generatedContent) {
      throw new Error('No content generated from AI');
    }

    // Parse the JSON from AI response
    let assets: any;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = generatedContent.match(/```json\n?([\s\S]*?)\n?```/) || 
                        generatedContent.match(/```\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : generatedContent;
      assets = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', generatedContent);
      throw new Error('Failed to parse generated campaign content');
    }

    // Create the campaign in the database
    const { data: campaign, error: campaignError } = await supabase
      .from('cmo_campaigns')
      .insert({
        tenant_id,
        workspace_id: workspaceId,
        campaign_name: assets.campaign_name || `AI Campaign - ${desired_result}`,
        campaign_type: 'autopilot',
        description: assets.campaign_summary || `Multi-channel ${desired_result} campaign`,
        objective: desired_result,
        status: 'draft',
        target_icp: icp,
        target_offer: offer,
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Failed to create campaign:', campaignError);
      throw new Error('Failed to create campaign record');
    }

    // Store content assets
    const contentAssets = [];

    // Store posts
    if (assets.posts?.length) {
      for (const post of assets.posts) {
        const { data: asset } = await supabase
          .from('cmo_content_assets')
          .insert({
            tenant_id,
            workspace_id: workspaceId,
            campaign_id: campaign.id,
            title: `${post.channel} Post`,
            content_type: 'social_post',
            channel: post.channel,
            key_message: post.content,
            cta: post.cta,
            status: 'draft',
          })
          .select()
          .single();
        if (asset) contentAssets.push(asset);
      }
    }

    // Store emails
    if (assets.emails?.length) {
      for (const email of assets.emails) {
        const { data: asset } = await supabase
          .from('cmo_content_assets')
          .insert({
            tenant_id,
            workspace_id: workspaceId,
            campaign_id: campaign.id,
            title: email.subject,
            content_type: 'email',
            channel: 'email',
            key_message: email.body,
            status: 'draft',
          })
          .select()
          .single();
        if (asset) contentAssets.push(asset);
      }
    }

    // Store voice scripts
    if (assets.voice_scripts?.length) {
      for (const script of assets.voice_scripts) {
        const { data: asset } = await supabase
          .from('cmo_content_assets')
          .insert({
            tenant_id,
            workspace_id: workspaceId,
            campaign_id: campaign.id,
            title: `Voice Script - ${script.scenario}`,
            content_type: 'voice_script',
            channel: 'voice',
            key_message: script.pitch,
            supporting_points: [script.opening, script.objection_handling, script.close],
            status: 'draft',
          })
          .select()
          .single();
        if (asset) contentAssets.push(asset);
      }
    }

    // Log success
    console.log(`Campaign ${campaign.id} created with ${contentAssets.length} assets`);

    return new Response(JSON.stringify({
      campaign_id: campaign.id,
      campaign_name: campaign.campaign_name,
      assets: {
        posts: assets.posts || [],
        emails: assets.emails || [],
        sms: assets.sms || [],
        landing_pages: assets.landing_pages || [],
        voice_scripts: assets.voice_scripts || [],
      },
      automations: {
        steps: assets.automation_steps || [],
      },
      stored_assets: contentAssets.length,
      summary: assets.campaign_summary || `Created ${desired_result} campaign targeting ${icp.substring(0, 50)}...`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Campaign Builder error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
