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

    const { workspaceId } = await req.json();
    
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'workspaceId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    const results = {
      contentPublished: 0,
      campaignsOptimized: 0,
      leadsNurtured: 0,
      metricsSync: 0,
      errors: [] as string[],
    };

    console.log(`[Daily Automation] Starting for workspace ${workspaceId} at ${now.toISOString()}`);

    // 1. Publish scheduled content for this workspace
    const { data: scheduledContent, error: contentError } = await supabase
      .from('content_calendar')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString());

    if (contentError) {
      results.errors.push(`Content fetch error: ${contentError.message}`);
    } else if (scheduledContent && scheduledContent.length > 0) {
      for (const item of scheduledContent) {
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

          results.contentPublished++;
        } catch (e: unknown) {
          const errorMsg = e instanceof Error ? e.message : 'Unknown error';
          results.errors.push(`Publish error for ${item.id}: ${errorMsg}`);
          await supabase
            .from('content_calendar')
            .update({ status: 'failed' })
            .eq('id', item.id);
        }
      }
    }

    // 2. Run campaign optimization for this workspace
    const { data: activeCampaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('workspace_id', workspaceId)
      .in('status', ['active', 'scheduled']);

    if (activeCampaigns && activeCampaigns.length > 0) {
      try {
        const campaignIds = activeCampaigns.map(c => c.id);
        await supabase.functions.invoke('campaign-optimizer', {
          body: { campaignIds }
        });
        results.campaignsOptimized = campaignIds.length;
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        results.errors.push(`Optimization error: ${errorMsg}`);
      }
    }

    // 3. Process lead nurturing sequences for this workspace
    const { data: activeEnrollments } = await supabase
      .from('sequence_enrollments')
      .select('*, leads(*), email_sequences(*)')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .lte('next_email_at', now.toISOString());

    if (activeEnrollments && activeEnrollments.length > 0) {
      for (const enrollment of activeEnrollments) {
        try {
          await supabase.functions.invoke('email-sequence', {
            body: { enrollmentId: enrollment.id, action: 'send_next' }
          });
          results.leadsNurtured++;
        } catch (e: unknown) {
          const errorMsg = e instanceof Error ? e.message : 'Unknown error';
          results.errors.push(`Nurture error for ${enrollment.id}: ${errorMsg}`);
        }
      }
    }

    // 4. Sync campaign metrics
    try {
      await supabase.functions.invoke('sync-campaign-metrics', {
        body: { syncAll: true, workspaceId }
      });
      results.metricsSync = 1;
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Metrics sync error: ${errorMsg}`);
    }

    // 5. Log automation job for this workspace
    await supabase.from('automation_jobs').insert({
      workspace_id: workspaceId,
      job_type: 'daily_automation',
      status: results.errors.length === 0 ? 'completed' : 'completed_with_errors',
      scheduled_at: now.toISOString(),
      started_at: now.toISOString(),
      completed_at: new Date().toISOString(),
      result: results,
    });

    console.log(`[Daily Automation] Completed for workspace ${workspaceId}:`, results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Daily Automation] Fatal error:', error);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
