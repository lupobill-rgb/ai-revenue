import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { contentId, action, workspaceId } = await req.json();

    // Publish a specific content item immediately (doesn't require workspaceId)
    if (action === 'publish_now' && contentId) {
      const { data: content, error } = await supabase
        .from('content_calendar')
        .select('*, assets(*)')
        .eq('id', contentId)
        .maybeSingle();

      if (error) throw error;
      if (!content) {
        return new Response(JSON.stringify({ error: 'Content not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let deployResult = null;

      if (content.content_type === 'email' && content.asset_id) {
        const { data } = await supabase.functions.invoke('email-deploy', {
          body: { assetId: content.asset_id }
        });
        deployResult = data;
      } else if (content.content_type === 'social' && content.asset_id) {
        const { data } = await supabase.functions.invoke('social-deploy', {
          body: { assetId: content.asset_id }
        });
        deployResult = data;
      }

      await supabase
        .from('content_calendar')
        .update({ 
          status: 'published', 
          published_at: new Date().toISOString() 
        })
        .eq('id', contentId);

      return new Response(JSON.stringify({ success: true, deployResult }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Batch publish requires workspaceId for multi-tenant scoping
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'workspaceId required for batch operations' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check and publish all due content for this workspace
    const now = new Date();
    const { data: dueContent, error: fetchError } = await supabase
      .from('content_calendar')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString());

    if (fetchError) throw fetchError;

    const published: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const item of dueContent || []) {
      try {
        if (item.content_type === 'email' && item.asset_id) {
          await supabase.functions.invoke('email-deploy', {
            body: { assetId: item.asset_id }
          });
        } else if (item.content_type === 'social' && item.asset_id) {
          await supabase.functions.invoke('social-deploy', {
            body: { assetId: item.asset_id }
          });
        }

        await supabase
          .from('content_calendar')
          .update({ status: 'published', published_at: now.toISOString() })
          .eq('id', item.id);

        published.push(item.id);
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        await supabase
          .from('content_calendar')
          .update({ status: 'failed' })
          .eq('id', item.id);
        failed.push({ id: item.id, error: errorMsg });
      }
    }

    console.log(`[Publish Content] Workspace ${workspaceId}: ${published.length} published, ${failed.length} failed`);

    return new Response(JSON.stringify({ published, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Publish error:', error);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
