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
      console.error('[batch-optimize-videos] Invalid or missing x-internal-secret header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Internal functions require secret header' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { workspaceId, internal } = await req.json();

    // Double-check this is an internal call
    if (!internal) {
      return new Response(
        JSON.stringify({ error: 'This function is for internal use only' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Require workspaceId for tenant isolation
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'workspaceId is required for tenant isolation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[batch-optimize-videos] Starting optimization for workspace ${workspaceId}...`);

    // Fetch all video assets in review status - SCOPED BY WORKSPACE
    const { data: pendingAssets, error: fetchError } = await supabase
      .from('assets')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('type', 'video')
      .in('status', ['review', 'draft'])
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching pending assets:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingAssets?.length || 0} video assets to optimize`);

    if (!pendingAssets || pendingAssets.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        workspaceId,
        message: 'No video assets pending optimization',
        optimized: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the best optimized template - SCOPED BY WORKSPACE
    const { data: templates } = await supabase
      .from('content_templates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('template_type', 'video')
      .order('conversion_rate', { ascending: false })
      .order('last_optimized_at', { ascending: false })
      .limit(3);

    const optimizedTemplates = templates || [];
    console.log(`Using ${optimizedTemplates.length} AI-optimized templates`);

    // Process each asset
    const results = [];
    for (const asset of pendingAssets) {
      try {
        console.log(`Optimizing asset: ${asset.name} (${asset.id})`);

        // Select the most appropriate template based on content
        const content = asset.content as Record<string, any> || {};
        const vertical = content.vertical || 'Pickleball Clubs & Country Clubs';
        const currentGoal = asset.goal || '';

        // Find matching template or use best performer
        let selectedTemplate = optimizedTemplates[0];
        for (const template of optimizedTemplates) {
          if (template.vertical?.toLowerCase().includes(vertical.toLowerCase()) ||
              vertical.toLowerCase().includes(template.vertical?.toLowerCase() || '')) {
            selectedTemplate = template;
            break;
          }
        }

        // Generate new AI-optimized description and script
        const optimizationPrompt = `You are an expert marketing copywriter for PlayKout, a pickleball facility company.

OPTIMIZED TEMPLATE TO USE:
${selectedTemplate?.content || 'Focus on PlayKout pickleball facilities, community, and competitive advantages.'}

TEMPLATE OPTIMIZATION NOTES:
${selectedTemplate?.optimization_notes || 'Emphasize clear value proposition, strong call to action, and PlayKout branding.'}

CURRENT ASSET DETAILS:
- Name: ${asset.name}
- Vertical: ${vertical}
- Goal: ${currentGoal}
- Current Description: ${asset.description || 'None'}

Generate an optimized video script and description that:
1. Incorporates the high-converting elements from the template
2. Maintains PlayKout pickleball branding throughout
3. Has a clear, compelling call to action
4. Speaks directly to ${vertical} audience needs

Return a JSON object:
{
  "script": "The optimized video script (60-90 seconds worth)",
  "description": "A concise marketing description (2-3 sentences)",
  "goal": "The optimized marketing goal"
}

Return ONLY the JSON object, no other text.`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a marketing optimization AI. Return only valid JSON.' },
              { role: 'user', content: optimizationPrompt }
            ],
          }),
        });

        if (!aiResponse.ok) {
          console.error(`AI error for asset ${asset.id}:`, aiResponse.status);
          results.push({ id: asset.id, name: asset.name, success: false, error: 'AI generation failed' });
          continue;
        }

        const aiData = await aiResponse.json();
        const aiContent = aiData.choices?.[0]?.message?.content || '';

        // Parse AI response
        let optimizedContent = { script: '', description: '', goal: '' };
        try {
          const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            optimizedContent = JSON.parse(jsonMatch[0]);
          }
        } catch (parseError) {
          console.error('Parse error for asset', asset.id, parseError);
          results.push({ id: asset.id, name: asset.name, success: false, error: 'Parse error' });
          continue;
        }

        // Update the asset with optimized content
        const updatedAssetContent = {
          ...content,
          script: optimizedContent.script || content.script,
          optimization_applied: true,
          optimization_template: selectedTemplate?.template_name,
          optimized_at: new Date().toISOString()
        };

        const { error: updateError } = await supabase
          .from('assets')
          .update({
            content: updatedAssetContent,
            description: optimizedContent.description || asset.description,
            goal: optimizedContent.goal || asset.goal,
            updated_at: new Date().toISOString()
          })
          .eq('id', asset.id)
          .eq('workspace_id', workspaceId); // Extra safety: ensure we only update within workspace

        if (updateError) {
          console.error(`Update error for asset ${asset.id}:`, updateError);
          results.push({ id: asset.id, name: asset.name, success: false, error: 'Update failed' });
        } else {
          console.log(`Successfully optimized asset: ${asset.name}`);
          results.push({ 
            id: asset.id, 
            name: asset.name, 
            success: true, 
            template: selectedTemplate?.template_name,
            newGoal: optimizedContent.goal
          });
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (assetError) {
        console.error(`Error processing asset ${asset.id}:`, assetError);
        results.push({ 
          id: asset.id, 
          name: asset.name, 
          success: false, 
          error: assetError instanceof Error ? assetError.message : 'Unknown error' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[batch-optimize-videos] Workspace ${workspaceId}: Success: ${successCount}, Failed: ${failCount}`);

    return new Response(JSON.stringify({ 
      success: true,
      workspaceId,
      message: `Optimized ${successCount} video assets`,
      total: pendingAssets.length,
      optimized: successCount,
      failed: failCount,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in batch-optimize-videos:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
