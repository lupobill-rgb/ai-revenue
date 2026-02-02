import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

// Internal secret for cron/orchestration calls
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || 'ubigrowth-internal-2024';

// ⚠️ INTERNAL ONLY - Called by cron-daily-automation, NOT from frontend
// This function uses service-role and bypasses RLS.
// Frontend should use trigger-user-automation instead.

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify internal secret header - blocks direct frontend calls
    const internalSecret = req.headers.get('x-internal-secret');
    if (internalSecret !== INTERNAL_SECRET) {
      console.error('[daily-automation] Invalid or missing x-internal-secret header');
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
    
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenantId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const results = {
      contentPublished: 0,
      campaignsOptimized: 0,
      leadsNurtured: 0,
      metricsSync: 0,
      errors: [] as string[],
    };

    console.log(`[daily-automation] Starting for tenant ${tenantId} at ${now.toISOString()}`);

    // 1. Publish scheduled content for this tenant
    const { data: scheduledContent, error: contentError } = await supabase
      .from('content_calendar')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString());

    if (contentError) {
      results.errors.push(`Content fetch error: ${contentError.message}`);
    } else if (scheduledContent && scheduledContent.length > 0) {
      for (const item of scheduledContent) {
        try {
          // Call publish-scheduled-content with internal secret
          await fetch(`${supabaseUrl}/functions/v1/publish-scheduled-content`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': INTERNAL_SECRET,
            },
            body: JSON.stringify({ 
              tenantId, 
              internal: true 
            })
          });

          results.contentPublished++;
        } catch (e: unknown) {
          const errorMsg = e instanceof Error ? e.message : 'Unknown error';
          results.errors.push(`Publish error for ${item.id}: ${errorMsg}`);
        }
      }
    }

    // 2. Run campaign optimization for this tenant
    const { data: activeCampaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('tenant_id', tenantId)
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

    // 3. Process lead nurturing sequences for this tenant - use internal call
    const { data: activeEnrollments } = await supabase
      .from('sequence_enrollments')
      .select('*, leads(*), email_sequences(*)')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .lte('next_email_at', now.toISOString());

    if (activeEnrollments && activeEnrollments.length > 0) {
      // Call email-sequence with internal secret for batch processing
      try {
        await fetch(`${supabaseUrl}/functions/v1/email-sequence`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          body: JSON.stringify({ 
            tenantId, 
            internal: true 
          })
        });
        results.leadsNurtured = activeEnrollments.length;
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        results.errors.push(`Nurture error: ${errorMsg}`);
      }
    }

    // 4. Sync campaign metrics
    try {
      await supabase.functions.invoke('sync-campaign-metrics', {
        body: { syncAll: true, tenantId }
      });
      results.metricsSync = 1;
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Metrics sync error: ${errorMsg}`);
    }

    // 5. Log automation job for this tenant
    await supabase.from('automation_jobs').insert({
      tenant_id: tenantId,
      job_type: 'daily_automation',
      status: results.errors.length === 0 ? 'completed' : 'completed_with_errors',
      scheduled_at: now.toISOString(),
      started_at: now.toISOString(),
      completed_at: new Date().toISOString(),
      result: results,
    });

    console.log(`[daily-automation] Completed for tenant ${tenantId}:`, results);

    return new Response(JSON.stringify({ success: true, tenantId, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[daily-automation] Fatal error:', error);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
