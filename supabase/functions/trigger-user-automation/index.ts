import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function is called from the FRONTEND by authenticated users.
// It uses the user's JWT so RLS is FULLY ENFORCED.
// No service-role key is used here.

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with USER's JWT - RLS is enforced
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenantId = user.user_metadata?.tenant_id || user.app_metadata?.tenant_id;
    if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'tenant_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user has access to this tenant (RLS enforces this)
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.error(`[Trigger Automation] No access to tenant ${tenantId}`);
      return new Response(JSON.stringify({ error: 'No access to this tenant' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    const results = {
      contentPublished: 0,
      campaignsOptimized: 0,
      leadsNurtured: 0,
      errors: [] as string[],
    };

    console.log(`[Trigger Automation] User triggered for tenant ${tenant.name} at ${now.toISOString()}`);

    // 1. Publish scheduled content (RLS enforced - only user's tenant content)
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
          // Update status (RLS enforced)
          const { error: updateError } = await supabase
            .from('content_calendar')
            .update({ status: 'published', published_at: now.toISOString() })
            .eq('id', item.id);

          if (updateError) throw updateError;
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

    // 2. Count active campaigns (RLS enforced)
    const { data: activeCampaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'scheduled']);

    if (activeCampaigns) {
      results.campaignsOptimized = activeCampaigns.length;
    }

    // 3. Count active enrollments (RLS enforced)
    const { data: activeEnrollments } = await supabase
      .from('sequence_enrollments')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .lte('next_email_at', now.toISOString());

    if (activeEnrollments) {
      results.leadsNurtured = activeEnrollments.length;
    }

    // 4. Log automation job (RLS enforced - user must have tenant access)
    const { error: insertError } = await supabase.from('automation_jobs').insert({
      tenant_id: tenantId,
      job_type: 'manual_trigger',
      status: results.errors.length === 0 ? 'completed' : 'completed_with_errors',
      scheduled_at: now.toISOString(),
      started_at: now.toISOString(),
      completed_at: new Date().toISOString(),
      result: results,
    });

    if (insertError) {
      console.error(`[Trigger Automation] Failed to log job: ${insertError.message}`);
    }

    console.log(`[Trigger Automation] Completed for tenant ${tenant.name}:`, results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Trigger Automation] Error:', error);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
