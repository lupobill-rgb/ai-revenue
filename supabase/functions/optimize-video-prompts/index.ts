import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

// Internal secret for cron/orchestration calls
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || 'ubigrowth-internal-2024';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify internal secret header - blocks direct frontend calls
    const internalSecret = req.headers.get('x-internal-secret');
    if (internalSecret !== INTERNAL_SECRET) {
      console.error('[optimize-video-prompts] Invalid or missing x-internal-secret header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Internal functions require secret header' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenantId, internal } = await req.json();

    // Double-check this is an internal call
    if (!internal) {
      return new Response(
        JSON.stringify({ error: 'This function is for internal use only' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Require tenantId for tenant isolation
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'tenantId is required for tenant isolation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[optimize-video-prompts] Starting optimization for tenant ${tenantId}...`);

    // Fetch tenant info for business context
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, owner_id')
      .eq('id', tenantId)
      .single();

    // Fetch business profile for this tenant's owner
    let businessContext = 'your company';
    let industryContext = 'your industry';
    let targetAudience = 'your target customers';
    
    if (tenant?.owner_id) {
      const { data: profile } = await supabase
        .from('business_profiles')
        .select('business_name, industry, business_description, target_audiences')
        .eq('user_id', tenant.owner_id)
        .maybeSingle();
      
      if (profile) {
        businessContext = profile.business_name || tenant.name || 'your company';
        industryContext = profile.industry || 'your industry';
        targetAudience = Array.isArray(profile.target_audiences) 
          ? profile.target_audiences.join(', ') 
          : 'your target customers';
      }
    }

    // Fetch video campaigns with metrics - SCOPED BY TENANT
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        id,
        channel,
        status,
        asset_id,
        tenant_id,
        assets!inner (
          id,
          name,
          type,
          description,
          goal,
          content
        ),
        campaign_metrics (
          impressions,
          clicks,
          conversions,
          engagement_rate,
          video_views
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('channel', 'video')
      .in('status', ['active', 'completed']);

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError);
      throw campaignsError;
    }

    console.log(`Found ${campaigns?.length || 0} video campaigns to analyze`);

    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        tenantId,
        message: 'No video campaigns to analyze yet',
        optimized: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate performance metrics for each campaign
    const performanceData = campaigns.map((campaign: any) => {
      const metrics = campaign.campaign_metrics?.[0] || {};
      const asset = campaign.assets;
      
      const impressions = metrics.impressions || 0;
      const conversions = metrics.conversions || 0;
      const clicks = metrics.clicks || 0;
      const videoViews = metrics.video_views || 0;
      
      const conversionRate = impressions > 0 ? (conversions / impressions) * 100 : 0;
      const clickRate = impressions > 0 ? (clicks / impressions) * 100 : 0;
      
      return {
        campaignId: campaign.id,
        assetId: asset?.id,
        assetName: asset?.name,
        description: asset?.description,
        goal: asset?.goal,
        content: asset?.content,
        impressions,
        conversions,
        clicks,
        videoViews,
        conversionRate,
        clickRate,
        performanceScore: (conversionRate * 0.5) + (clickRate * 0.3) + (videoViews > 100 ? 20 : videoViews / 5)
      };
    });

    // Sort by performance
    const sortedByPerformance = [...performanceData].sort((a, b) => b.performanceScore - a.performanceScore);
    
    const topPerformers = sortedByPerformance.slice(0, Math.ceil(sortedByPerformance.length / 3));
    const lowPerformers = sortedByPerformance.slice(-Math.ceil(sortedByPerformance.length / 3));

    console.log(`Top performers: ${topPerformers.length}, Low performers: ${lowPerformers.length}`);

    // Fetch existing video templates - SCOPED BY TENANT
    const { data: existingTemplates, error: templatesError } = await supabase
      .from('content_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('template_type', 'video');

    if (templatesError) {
      console.error('Error fetching templates:', templatesError);
    }

    // Use AI to analyze and generate optimized prompts - DYNAMIC BUSINESS CONTEXT
    const analysisPrompt = `You are a marketing optimization AI analyzing video campaign performance for ${businessContext}, a company in the ${industryContext} industry.

PERFORMANCE DATA:
Top Performing Videos:
${topPerformers.map(p => `- "${p.assetName}" (Goal: ${p.goal || 'N/A'})
  Description: ${p.description || 'N/A'}
  Conversion Rate: ${p.conversionRate.toFixed(2)}%
  Click Rate: ${p.clickRate.toFixed(2)}%
  Video Views: ${p.videoViews}`).join('\n')}

Low Performing Videos:
${lowPerformers.map(p => `- "${p.assetName}" (Goal: ${p.goal || 'N/A'})
  Description: ${p.description || 'N/A'}
  Conversion Rate: ${p.conversionRate.toFixed(2)}%
  Click Rate: ${p.clickRate.toFixed(2)}%
  Video Views: ${p.videoViews}`).join('\n')}

EXISTING TEMPLATES:
${existingTemplates?.map(t => `- ${t.template_name}: ${t.content.substring(0, 200)}...`).join('\n') || 'No existing templates'}

Based on this analysis, generate optimized video prompt templates that will improve conversion rates. Focus on:
1. What themes/messaging worked in top performers
2. What should be avoided based on low performers
3. ${businessContext} branding must be prominent

Return a JSON array with exactly 3 optimized templates:
[
  {
    "template_name": "High-Converting Video Template - [Theme]",
    "content": "The full optimized video prompt/description template",
    "vertical": "${industryContext}",
    "tone": "energetic",
    "target_audience": "${targetAudience}",
    "optimization_notes": "Why this template should perform better"
  }
]

Return ONLY the JSON array, no other text.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a marketing optimization AI. Return only valid JSON arrays.' },
          { role: 'user', content: analysisPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI optimization error:', aiResponse.status, errorText);
      throw new Error(`AI optimization failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '';
    
    console.log('AI response received, parsing templates...');

    // Parse AI response
    let optimizedTemplates = [];
    try {
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        optimizedTemplates = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.log('Raw AI content:', aiContent);
    }

    // Upsert optimized templates - INCLUDING tenant_id
    let upsertedCount = 0;
    for (const template of optimizedTemplates) {
      // Check if template with same name exists in this tenant
      const { data: existing } = await supabase
        .from('content_templates')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('template_name', template.template_name)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('content_templates')
          .update({
            content: template.content,
            vertical: template.vertical || industryContext,
            tone: template.tone || 'energetic',
            target_audience: template.target_audience,
            optimization_notes: template.optimization_notes,
            last_optimized_at: new Date().toISOString(),
            optimization_version: 1,
            conversion_rate: topPerformers[0]?.conversionRate || 0,
            impressions: performanceData.reduce((sum, p) => sum + p.impressions, 0),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (!updateError) upsertedCount++;
      } else {
        // Insert new - INCLUDING tenant_id
        const { error: insertError } = await supabase
          .from('content_templates')
          .insert({
            tenant_id: tenantId, // CRITICAL: Include tenant_id
            template_name: template.template_name,
            template_type: 'video',
            content: template.content,
            vertical: template.vertical || industryContext,
            tone: template.tone || 'energetic',
            target_audience: template.target_audience,
            optimization_notes: template.optimization_notes,
            last_optimized_at: new Date().toISOString(),
            optimization_version: 1,
            conversion_rate: topPerformers[0]?.conversionRate || 0,
            impressions: performanceData.reduce((sum, p) => sum + p.impressions, 0)
          });

        if (!insertError) {
          upsertedCount++;
          console.log(`Inserted template: ${template.template_name}`);
        } else {
          console.error('Error inserting template:', insertError);
        }
      }
    }

    // Update metrics on existing templates based on performance data
    const avgConversionRate = performanceData.length > 0 
      ? performanceData.reduce((sum, p) => sum + p.conversionRate, 0) / performanceData.length 
      : 0;
    const totalImpressions = performanceData.reduce((sum, p) => sum + p.impressions, 0);

    if (existingTemplates && existingTemplates.length > 0) {
      for (const template of existingTemplates) {
        await supabase
          .from('content_templates')
          .update({
            conversion_rate: avgConversionRate,
            impressions: totalImpressions,
            updated_at: new Date().toISOString()
          })
          .eq('id', template.id)
          .eq('tenant_id', tenantId); // Extra safety
      }
    }

    console.log(`[optimize-video-prompts] Tenant ${tenantId}: Created/updated ${upsertedCount} templates.`);

    return new Response(JSON.stringify({ 
      success: true,
      tenantId,
      message: 'Video prompts optimized based on conversion data',
      optimized: upsertedCount,
      analyzed: performanceData.length,
      avgConversionRate: avgConversionRate.toFixed(2),
      topPerformerThemes: topPerformers.map(p => p.goal).filter(Boolean)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in optimize-video-prompts:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
