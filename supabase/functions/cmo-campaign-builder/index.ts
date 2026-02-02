import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignBuilderInput {
  tenant_id: string;
  tenant_id?: string;
  icp: string;
  offer: string;
  channels: string[];
  desired_result: 'leads' | 'meetings' | 'revenue' | 'engagement';
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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Service role client for creating automation triggers
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const input: CampaignBuilderInput = await req.json();
    const { icp, offer, channels, desired_result } = input;

    if (!icp || !offer || !channels?.length || !desired_result) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: icp, offer, channels, desired_result' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenantId = user.user_metadata?.tenant_id || user.app_metadata?.tenant_id;
    if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
      return new Response(JSON.stringify({ 
        error: 'tenant_id is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Campaign Builder: Building campaign for tenant ${tenantId}`);
    console.log(`Channels: ${channels.join(', ')}, Goal: ${desired_result}`);

    // Fetch brand profile for context
    const { data: brandProfile } = await supabase
      .from('cmo_brand_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    const brandContext = brandProfile ? `
Brand: ${brandProfile.brand_name}
Industry: ${brandProfile.industry || 'Not specified'}
Voice: ${brandProfile.brand_voice || 'Professional'}
Tone: ${brandProfile.brand_tone || 'Friendly'}
Value Proposition: ${brandProfile.unique_value_proposition || offer}
` : `Brand context not available. Use the offer description for tone.`;

    // Determine optimal template type based on industry, goal, and channels
    const determineTemplateType = (industry: string | null, goal: string, channels: string[]): string => {
      // Priority: goal > industry > channels
      if (goal === 'meetings' || channels.includes('voice')) return 'booking';
      if (goal === 'leads' && (industry?.toLowerCase().includes('saas') || industry?.toLowerCase().includes('software'))) return 'saas';
      if (goal === 'leads') return 'lead_magnet';
      if (channels.includes('webinar') || goal === 'engagement') return 'webinar';
      if (industry?.toLowerCase().includes('consult') || industry?.toLowerCase().includes('agency') || industry?.toLowerCase().includes('service')) return 'services';
      if (goal === 'revenue') return 'long_form';
      return 'lead_magnet'; // Default fallback
    };

    const recommendedTemplate = determineTemplateType(brandProfile?.industry || null, desired_result, channels);

    // Build the AI prompt - ALWAYS include landing_page even if not explicitly in channels
    const systemPrompt = `You are an expert AI CMO campaign builder. Your job is to create comprehensive, multi-channel marketing campaigns.

${brandContext}

Generate high-converting marketing assets that are:
- Personalized to the ICP
- Aligned with the brand voice
- Optimized for the desired outcome
- Ready to deploy across channels

CRITICAL: You MUST always generate at least one landing page for every campaign. Landing pages are essential for conversion.
CRITICAL: For landing pages, use template_type: "${recommendedTemplate}" as it is optimal for this ${brandProfile?.industry || 'business'} targeting ${desired_result}.

Template Type Guidelines:
- "saas": For software/tech products - emphasize features, integrations, pricing tiers
- "lead_magnet": For content offers - emphasize value of free resource, quick benefits
- "webinar": For event registration - emphasize speakers, agenda, date/time
- "services": For consulting/agencies - emphasize process, expertise, case studies
- "booking": For scheduling calls/demos - emphasize calendar CTA, no long forms
- "long_form": For high-ticket offers - comprehensive with testimonials, FAQs, objection handling

Output ONLY valid JSON matching the exact schema requested.`;

    const userPrompt = `Create a complete multi-channel campaign with the following parameters:

**Target ICP:**
${icp}

**Offer:**
${offer}

**Channels to use:** ${channels.join(', ')}

**Primary Goal:** ${desired_result}

**Recommended Landing Page Template:** ${recommendedTemplate}

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
    // REQUIRED: At least 1 landing page using template_type: "${recommendedTemplate}"
    { 
      "internal_name": "campaign-landing-page",
      "url_slug": "offer-slug",
      "template_type": "${recommendedTemplate}",
      "hero_headline": "compelling headline targeting the ICP pain point",
      "hero_subheadline": "supporting value proposition",
      "hero_supporting_points": ["benefit 1", "benefit 2", "benefit 3"],
      "sections": [
        { 
          "type": "problem_solution|features|social_proof|process|faq|pricing|booking|story", 
          "heading": "section heading",
          "body": "section content",
          "bullets": ["point 1", "point 2"],
          "enabled": true
        }
      ],
      "primary_cta_label": "${desired_result === 'meetings' ? 'Book a Call' : 'Get Started Free'}",
      "primary_cta_type": "${desired_result === 'meetings' ? 'calendar' : 'form'}",
      "form_fields": [
        { "name": "email", "label": "Email Address", "type": "email", "required": true },
        { "name": "first_name", "label": "First Name", "type": "text", "required": true }${desired_result === 'leads' ? ',\n        { "name": "company", "label": "Company", "type": "text", "required": false }' : ''}
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

Only include asset types for the channels specified, EXCEPT landing_pages which must ALWAYS be included. Make content compelling and conversion-focused.`;

    // Call Gemini
    console.log('[campaign-builder] Calling Gemini API');
    
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedContent) {
      throw new Error('No content generated from AI');
    }

    // Parse the JSON from AI response
    let assets: any;
    try {
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
        tenant_id: tenantId,
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
    const landingPageAssets = [];

    // Store posts
    if (assets.posts?.length) {
      for (const post of assets.posts) {
        const { data: asset } = await supabase
          .from('cmo_content_assets')
          .insert({
            tenant_id,
            tenant_id: tenantId,
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
            tenant_id: tenantId,
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
            tenant_id: tenantId,
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

    // Store SMS messages
    if (assets.sms?.length) {
      for (const sms of assets.sms) {
        const { data: asset } = await supabase
          .from('cmo_content_assets')
          .insert({
            tenant_id,
            tenant_id: tenantId,
            campaign_id: campaign.id,
            title: `SMS Step ${sms.step}`,
            content_type: 'sms',
            channel: 'sms',
            key_message: sms.message,
            status: 'draft',
          })
          .select()
          .single();
        if (asset) contentAssets.push(asset);
      }
    }

    // Store landing pages with FULL metadata and AUTO-WIRING
    if (assets.landing_pages?.length) {
      for (const page of assets.landing_pages) {
        // Generate unique URL slug with campaign reference
        const urlSlug = `${page.url_slug || page.internal_name}-${campaign.id.slice(0, 8)}`;
        const publishedUrl = `https://pages.ubigrowth.ai/${tenant_id.slice(0, 8)}/${urlSlug}`;
        
        // Store full landing page structure in cmo_content_assets
        const { data: asset } = await supabase
          .from('cmo_content_assets')
          .insert({
            tenant_id,
            tenant_id: tenantId,
            campaign_id: campaign.id,
            title: page.internal_name || page.hero_headline,
            content_type: 'landing_page',
            channel: 'web',
            key_message: page.hero_headline,
            cta: page.primary_cta_label,
            supporting_points: page.hero_supporting_points || [],
            status: 'draft',
          })
          .select()
          .single();

        if (asset) {
          // Store full landing page data in variant for richer structure
          const { data: variant } = await supabase
            .from('cmo_content_variants')
            .insert({
              asset_id: asset.id,
              variant_name: 'Primary',
              variant_type: 'A',
              headline: page.hero_headline,
              subject_line: page.hero_subheadline,
              body_content: JSON.stringify({
                template_type: page.template_type || 'lead_magnet',
                url_slug: urlSlug,
                published_url: publishedUrl,
                hero_supporting_points: page.hero_supporting_points || [],
                sections: (page.sections || []).map((s: any) => ({
                  ...s,
                  enabled: s.enabled !== false // default enabled
                })),
                primary_cta_type: page.primary_cta_type || 'form',
                form_fields: page.form_fields || [
                  { name: 'email', label: 'Email', type: 'email', required: true },
                  { name: 'first_name', label: 'First Name', type: 'text', required: true }
                ],
                // Auto-wiring metadata
                crm_form_id: `form_${asset.id}`,
                utm_source: 'campaign',
                utm_campaign: campaign.id,
              }),
              cta_text: page.primary_cta_label,
              metadata: {
                auto_wired: true,
                crm_integrated: true,
                campaign_source: campaign.id,
              }
            })
            .select()
            .single();

          // Create automation trigger for form submission
          await supabase
            .from('automation_steps')
            .insert({
              tenant_id,
              tenant_id: tenantId,
              automation_id: campaign.id,
              step_type: 'trigger_form_submit',
              step_order: 0,
              config: {
                form_id: `form_${asset.id}`,
                landing_page_id: asset.id,
                campaign_id: campaign.id,
                action: 'create_lead',
                lead_source: `Landing Page: ${page.internal_name || page.hero_headline}`,
              }
            });

          landingPageAssets.push({
            ...asset,
            variant,
            published_url: publishedUrl,
            url_slug: urlSlug,
          });
          contentAssets.push(asset);
        }
      }
    }

    // Store automation flow steps
    if (assets.automation_steps?.length) {
      for (const step of assets.automation_steps) {
        await supabase
          .from('automation_steps')
          .insert({
            tenant_id,
            tenant_id: tenantId,
            automation_id: campaign.id,
            step_type: step.type,
            step_order: step.step,
            config: {
              delay_days: step.delay_days || 0,
              ...step.config,
            }
          });
      }
    }

    // Log agent run
    await supabase
      .from('agent_runs')
      .insert({
        tenant_id,
        tenant_id: tenantId,
        agent: 'cmo_campaign_builder',
        mode: 'autopilot',
        status: 'completed',
        input: { icp, offer, channels, desired_result },
        output: {
          campaign_id: campaign.id,
          assets_created: contentAssets.length,
          landing_pages: landingPageAssets.length,
        }
      });

    console.log(`Campaign ${campaign.id} created with ${contentAssets.length} assets, ${landingPageAssets.length} landing pages, and ${assets.automation_steps?.length || 0} automation steps`);

    return new Response(JSON.stringify({
      campaign_id: campaign.id,
      campaign_name: campaign.campaign_name,
      assets: {
        posts: assets.posts || [],
        emails: assets.emails || [],
        sms: assets.sms || [],
        landing_pages: landingPageAssets,
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
