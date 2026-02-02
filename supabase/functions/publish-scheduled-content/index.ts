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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const body = await req.json();
    const { contentId, action, tenantId, internal } = body;
    const authHeader = req.headers.get('Authorization');
    const internalSecret = req.headers.get('x-internal-secret');

    // =========================================================
    // PATH 1: User-facing "publish_now" action
    // Uses anon key + JWT, RLS enforces tenant access
    // =========================================================
    if (action === 'publish_now' && contentId) {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Authorization required for publish_now' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // User request: use anon key + JWT for RLS enforcement
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[publish-scheduled-content] User ${user.id} publishing content ${contentId}`);

      // RLS ensures user can only access content in their tenant
      const { data: content, error } = await supabase
        .from('content_calendar')
        .select('*, assets(*)')
        .eq('id', contentId)
        .maybeSingle();

      if (error) throw error;
      if (!content) {
        return new Response(JSON.stringify({ error: 'Content not found or access denied' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let deployResult = null;

      // Call deploy functions - they need the user's auth context
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

      // Update via RLS-protected client
      await supabase
        .from('content_calendar')
        .update({ 
          status: 'published', 
          published_at: new Date().toISOString() 
        })
        .eq('id', contentId);

      console.log(`[publish-scheduled-content] Published content ${contentId}`);

      return new Response(JSON.stringify({ success: true, deployResult }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================
    // PATH 2: Internal batch publish (cron/orchestration only)
    // Requires x-internal-secret header + tenantId
    // =========================================================
    if (internalSecret !== INTERNAL_SECRET) {
      console.error('[publish-scheduled-content] Invalid or missing x-internal-secret for batch operation');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Batch operations require internal secret' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!internal) {
      return new Response(
        JSON.stringify({ error: 'Batch operations require internal flag' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenantId required for batch operations' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[publish-scheduled-content] Internal batch publish for tenant ${tenantId}`);

    // Internal request: use service role for batch operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check and publish all due content for this tenant
    const now = new Date();
    const { data: dueContent, error: fetchError } = await supabase
      .from('content_calendar')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString());

    if (fetchError) throw fetchError;

    const published: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const item of dueContent || []) {
      try {
        // Call deploy functions with internal context
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
          .eq('id', item.id)
          .eq('tenant_id', tenantId); // Extra safety

        published.push(item.id);
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        await supabase
          .from('content_calendar')
          .update({ status: 'failed' })
          .eq('id', item.id)
          .eq('tenant_id', tenantId);
        failed.push({ id: item.id, error: errorMsg });
      }
    }

    console.log(`[publish-scheduled-content] Tenant ${tenantId}: ${published.length} published, ${failed.length} failed`);

    return new Response(JSON.stringify({ success: true, tenantId, published, failed }), {
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
