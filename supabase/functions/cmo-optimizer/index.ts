import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptimizationChange {
  type: 'update_email' | 'update_sms' | 'update_post' | 'update_landing_section' | 'update_voice_script' | 'adjust_wait' | 'kill_variant';
  target_id: string;
  reason: string;
  new_subject?: string;
  new_body?: string;
  new_heading?: string;
  new_script?: string;
  new_delay_hours?: number;
}

interface OptimizerInput {
  tenant_id: string;
  workspace_id?: string;
  campaign_id: string;
  goal: 'leads' | 'meetings' | 'revenue' | 'engagement';
  metrics: {
    sends?: number;
    deliveries?: number;
    opens?: number;
    clicks?: number;
    replies?: number;
    bounces?: number;
    booked_meetings?: number;
    no_shows?: number;
    conversions?: number;
    voice_calls?: {
      total: number;
      reached: number;
      booked: number;
      no_answer: number;
    };
  };
  assets?: {
    emails?: { id: string; subject: string; body: string; performance?: any }[];
    sms?: { id: string; body: string; performance?: any }[];
    posts?: { id: string; body: string; performance?: any }[];
    landing_sections?: { id: string; type: string; heading: string; body: string; performance?: any }[];
    voice_scripts?: { id: string; scenario: string; script: string; performance?: any }[];
  };
  constraints?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support both authenticated and internal cron calls
    const authHeader = req.headers.get('Authorization');
    const internalSecret = req.headers.get('x-internal-secret');
    const isInternalCall = internalSecret === Deno.env.get('INTERNAL_FUNCTION_SECRET');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // Use service role for cron calls, user auth for direct calls
    const supabase = isInternalCall 
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader || '' } }
        });

    if (!isInternalCall) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const input: OptimizerInput = await req.json();
    const { tenant_id, workspace_id, campaign_id, goal, metrics, assets, constraints = [] } = input;

    if (!tenant_id || !campaign_id || !goal || !metrics) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: tenant_id, campaign_id, goal, metrics' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const workspaceId = workspace_id || tenant_id;

    console.log(`Optimizer: Analyzing campaign ${campaign_id} for tenant ${tenant_id}`);

    // Fetch campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('cmo_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
    }

    // Fetch current content assets for the campaign
    const { data: contentAssets } = await supabase
      .from('cmo_content_assets')
      .select('*')
      .eq('campaign_id', campaign_id);

    // Build comprehensive asset context
    const emailAssets = contentAssets?.filter(a => a.content_type === 'email') || assets?.emails || [];
    const smsAssets = contentAssets?.filter(a => a.content_type === 'sms') || assets?.sms || [];
    const voiceAssets = contentAssets?.filter(a => a.content_type === 'voice_script') || assets?.voice_scripts || [];
    const postAssets = contentAssets?.filter(a => a.content_type === 'social_post') || assets?.posts || [];

    // Calculate performance indicators
    const sends = metrics.sends || 0;
    const deliveries = metrics.deliveries || sends; // Default deliveries to sends if not tracked
    const openRate = deliveries > 0 ? (metrics.opens || 0) / deliveries * 100 : 0;
    const clickRate = (metrics.opens || 0) > 0 ? (metrics.clicks || 0) / (metrics.opens || 1) * 100 : 0;
    const replyRate = sends > 0 ? (metrics.replies || 0) / sends * 100 : 0;
    const meetingRate = (metrics.replies || 0) > 0 ? (metrics.booked_meetings || 0) / (metrics.replies || 1) * 100 : 0;
    const bounceRate = sends > 0 ? (metrics.bounces || 0) / sends * 100 : 0;
    const voiceConnectRate = metrics.voice_calls ? (metrics.voice_calls.reached / metrics.voice_calls.total * 100) : 0;
    const voiceBookingRate = metrics.voice_calls && metrics.voice_calls.reached > 0 ? (metrics.voice_calls.booked / metrics.voice_calls.reached * 100) : 0;

    // Build the AI prompt with goal-weighted guidance
    const goalWeighting = goal === 'meetings' || goal === 'revenue' 
      ? `PRIORITY WEIGHTING: For "${goal}" goal, replies and booked meetings are the PRIMARY success metrics. 
         Opens and clicks are leading indicators but replies/meetings are what matter most.
         Optimize messaging for conversation starters and clear CTAs that drive responses.`
      : goal === 'leads'
      ? `PRIORITY WEIGHTING: For "leads" goal, focus on maximizing qualified responses (replies) and form submissions.
         Click-through and reply rates are primary metrics.`
      : `PRIORITY WEIGHTING: For "engagement" goal, optimize for opens, clicks, and social interactions.
         Volume metrics matter alongside quality signals.`;

    const systemPrompt = `You are an expert marketing optimization AI. Your job is to analyze campaign performance metrics and current assets, then recommend specific, actionable changes to improve results.

You must output ONLY valid JSON matching the exact schema requested. Be specific about what to change and why.

METRIC HIERARCHY (most to least important for conversion):
1. Booked Meetings - highest quality signal, indicates sales-ready interest
2. Replies - strong engagement signal, indicates real conversation
3. Clicks - moderate signal, shows interest in learning more
4. Opens - weak signal, only indicates subject line effectiveness

${goalWeighting}

Guidelines:
- Focus on the stated goal (${goal})
- Respect all constraints provided
- Prioritize high-impact, low-effort changes
- Be specific - provide actual new copy, not just "improve this"
- Consider the full funnel from awareness to conversion
- If reply rate is low but open rate is high, focus on improving body copy and CTAs
- If meeting rate is low but reply rate is high, improve the qualification and booking flow`;

    const userPrompt = `Analyze this campaign and recommend optimizations:

**Campaign Goal:** ${goal}
**Campaign Name:** ${campaign.campaign_name}
**Current Status:** ${campaign.status}

**Performance Metrics:**
- Sends: ${sends}
- Deliveries: ${deliveries} (${sends > 0 ? ((deliveries / sends) * 100).toFixed(1) : 0}% delivery rate)
- Opens: ${metrics.opens || 0} (${openRate.toFixed(1)}% open rate)
- Clicks: ${metrics.clicks || 0} (${clickRate.toFixed(1)}% click rate)
- Replies: ${metrics.replies || 0} (${replyRate.toFixed(1)}% reply rate) ← KEY ENGAGEMENT SIGNAL
- Booked Meetings: ${metrics.booked_meetings || 0} (${meetingRate.toFixed(1)}% meeting rate from replies) ← HIGHEST VALUE
- Bounces: ${metrics.bounces || 0} (${bounceRate.toFixed(1)}% bounce rate)
- No-shows: ${metrics.no_shows || 0}
${metrics.voice_calls ? `- Voice Calls: ${metrics.voice_calls.total} total, ${metrics.voice_calls.reached} reached (${voiceConnectRate.toFixed(1)}%), ${metrics.voice_calls.booked} booked (${voiceBookingRate.toFixed(1)}%)` : ''}

**Current Email Assets (${emailAssets.length}):**
${emailAssets.map((e: any, i: number) => `${i + 1}. "${e.title}" - ${e.key_message?.substring(0, 100)}...`).join('\n') || 'None'}

**Current SMS Assets (${smsAssets.length}):**
${smsAssets.map((s: any, i: number) => `${i + 1}. ${s.key_message?.substring(0, 80)}...`).join('\n') || 'None'}

**Current Voice Scripts (${voiceAssets.length}):**
${voiceAssets.map((v: any, i: number) => `${i + 1}. "${v.title}" - ${v.key_message?.substring(0, 100)}...`).join('\n') || 'None'}

**Current Social Posts (${postAssets.length}):**
${postAssets.map((p: any, i: number) => `${i + 1}. [${p.channel}] ${p.key_message?.substring(0, 80)}...`).join('\n') || 'None'}

**Constraints:**
${constraints.length > 0 ? constraints.map((c, i) => `${i + 1}. ${c}`).join('\n') : 'None specified'}

Generate optimization recommendations in this JSON format:

{
  "changes": [
    {
      "type": "update_email|update_sms|update_post|update_voice_script|adjust_wait|kill_variant|add_step|remove_step",
      "target_id": "ID of the asset to modify (use the asset title if ID unknown)",
      "reason": "Specific reason based on metrics",
      "new_subject": "For emails: new subject line",
      "new_body": "For emails: new body copy",
      "new_message": "For SMS: new message text",
      "new_script": "For voice: new script text",
      "new_delay_hours": 48
    }
  ],
  "summary": "Brief summary of all optimizations and expected impact",
  "priority_actions": ["Top 3 most impactful changes to implement first"],
  "metrics_targets": {
    "expected_open_rate_improvement": "+X%",
    "expected_reply_rate_improvement": "+X%",
    "expected_meeting_rate_improvement": "+X%"
  }
}

Recommend 2-5 specific changes based on the metrics. Focus on the weakest performing areas.`;

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
        temperature: 0.5,
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
    let optimizations: any;
    try {
      const jsonMatch = generatedContent.match(/```json\n?([\s\S]*?)\n?```/) || 
                        generatedContent.match(/```\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : generatedContent;
      optimizations = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', generatedContent);
      throw new Error('Failed to parse optimization recommendations');
    }

    // Apply changes to database
    const appliedChanges: string[] = [];

    for (const change of optimizations.changes || []) {
      try {
        // Update email assets
        if (change.type === 'update_email' && change.target_id) {
          const { data: emailAsset } = await supabase
            .from('cmo_content_assets')
            .select('id')
            .eq('campaign_id', campaign_id)
            .eq('content_type', 'email')
            .or(`id.eq.${change.target_id},title.ilike.%${change.target_id}%`)
            .single();

          if (emailAsset) {
            await supabase
              .from('cmo_content_assets')
              .update({
                title: change.new_subject || undefined,
                key_message: change.new_body || undefined,
                updated_at: new Date().toISOString(),
              })
              .eq('id', emailAsset.id);
            appliedChanges.push(`Updated email: ${change.target_id}`);
          }
        }

        // Update SMS assets
        if (change.type === 'update_sms' && change.target_id) {
          const { data: smsAsset } = await supabase
            .from('cmo_content_assets')
            .select('id')
            .eq('campaign_id', campaign_id)
            .eq('content_type', 'sms')
            .or(`id.eq.${change.target_id},title.ilike.%${change.target_id}%`)
            .single();

          if (smsAsset) {
            await supabase
              .from('cmo_content_assets')
              .update({
                key_message: change.new_body || undefined,
                updated_at: new Date().toISOString(),
              })
              .eq('id', smsAsset.id);
            appliedChanges.push(`Updated SMS: ${change.target_id}`);
          }
        }

        // Update social posts
        if (change.type === 'update_post' && change.target_id) {
          const { data: postAsset } = await supabase
            .from('cmo_content_assets')
            .select('id')
            .eq('campaign_id', campaign_id)
            .eq('content_type', 'social_post')
            .or(`id.eq.${change.target_id},title.ilike.%${change.target_id}%`)
            .single();

          if (postAsset) {
            await supabase
              .from('cmo_content_assets')
              .update({
                key_message: change.new_body || undefined,
                updated_at: new Date().toISOString(),
              })
              .eq('id', postAsset.id);
            appliedChanges.push(`Updated post: ${change.target_id}`);
          }
        }

        // Update landing page sections
        if (change.type === 'update_landing_section' && change.target_id) {
          const { data: landingAsset } = await supabase
            .from('cmo_content_assets')
            .select('id')
            .eq('campaign_id', campaign_id)
            .eq('content_type', 'landing_page')
            .or(`id.eq.${change.target_id},title.ilike.%${change.target_id}%`)
            .single();

          if (landingAsset) {
            await supabase
              .from('cmo_content_assets')
              .update({
                title: change.new_heading || undefined,
                key_message: change.new_body || undefined,
                updated_at: new Date().toISOString(),
              })
              .eq('id', landingAsset.id);
            appliedChanges.push(`Updated landing section: ${change.target_id}`);
          }
        }

        // Update voice scripts
        if (change.type === 'update_voice_script' && change.target_id) {
          const { data: voiceAsset } = await supabase
            .from('cmo_content_assets')
            .select('id')
            .eq('campaign_id', campaign_id)
            .eq('content_type', 'voice_script')
            .or(`id.eq.${change.target_id},title.ilike.%${change.target_id}%`)
            .single();

          if (voiceAsset) {
            await supabase
              .from('cmo_content_assets')
              .update({
                key_message: change.new_script || undefined,
                updated_at: new Date().toISOString(),
              })
              .eq('id', voiceAsset.id);
            appliedChanges.push(`Updated voice script: ${change.target_id}`);
          }
        }

        // Adjust wait/delay times in automation steps
        if (change.type === 'adjust_wait' && change.target_id && change.new_delay_hours !== undefined) {
          const { error: waitError } = await supabase
            .from('automation_steps')
            .update({
              config: { delay_hours: change.new_delay_hours },
              updated_at: new Date().toISOString(),
            })
            .eq('id', change.target_id);

          if (!waitError) {
            appliedChanges.push(`Adjusted wait time: ${change.new_delay_hours}h`);
          }
        }

        // Kill (archive) underperforming variants
        if (change.type === 'kill_variant' && change.target_id) {
          await supabase
            .from('cmo_content_assets')
            .update({ status: 'archived', updated_at: new Date().toISOString() })
            .eq('campaign_id', campaign_id)
            .or(`id.eq.${change.target_id},title.ilike.%${change.target_id}%`);
          appliedChanges.push(`Archived variant: ${change.target_id}`);
        }
      } catch (applyError) {
        console.error(`Failed to apply change: ${change.type}`, applyError);
      }
    }

    // Insert optimization record
    const { error: insertError } = await supabase
      .from('campaign_optimizations')
      .insert({
        tenant_id,
        workspace_id: workspaceId,
        campaign_id,
        optimization_type: 'ai_optimization',
        changes: optimizations.changes || [],
        summary: optimizations.summary,
        metrics_snapshot: metrics,
      });

    if (insertError) {
      console.error('Failed to insert optimization record:', insertError);
    }

    // Update campaign with optimization info
    await supabase
      .from('cmo_campaigns')
      .update({
        last_optimization_at: new Date().toISOString(),
        last_optimization_note: optimizations.summary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaign_id);

    // Also insert as a recommendation for the UI
    await supabase
      .from('cmo_recommendations')
      .insert({
        tenant_id,
        workspace_id: workspaceId,
        campaign_id,
        title: `AI Optimization: ${optimizations.priority_actions?.[0] || 'Performance improvements'}`,
        description: optimizations.summary,
        recommendation_type: 'optimization',
        priority: 'high',
        status: 'implemented',
        action_items: optimizations.changes,
        implemented_at: new Date().toISOString(),
      });

    console.log(`Optimizer completed for campaign ${campaign_id}: ${appliedChanges.length} changes applied`);

    return new Response(JSON.stringify({
      changes: optimizations.changes || [],
      summary: optimizations.summary,
      priority_actions: optimizations.priority_actions,
      metrics_targets: optimizations.metrics_targets,
      applied_changes: appliedChanges,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Optimizer error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
