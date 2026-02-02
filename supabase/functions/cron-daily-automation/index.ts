import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

// Internal secret for cron/orchestration calls
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || 'ubigrowth-internal-2024';

// This function is called by pg_cron and runs daily-automation for ALL active tenants
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request - require either x-internal-secret header OR cron flag (for pg_cron)
    const internalSecret = req.headers.get('x-internal-secret');
    const body = await req.json().catch(() => ({}));
    
    // Accept if either: valid secret header OR cron flag (pg_cron doesn't support custom headers easily)
    const isValidSecret = internalSecret === INTERNAL_SECRET;
    const isCronCall = body.cron === true;
    
    if (!isValidSecret && !isCronCall) {
      console.error('[cron-daily-automation] Unauthorized: missing valid secret or cron flag');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[cron-daily-automation] Starting at ${new Date().toISOString()}`);

    // Fetch all active tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name');

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    if (!tenants || tenants.length === 0) {
      console.log('[cron-daily-automation] No tenants found, skipping');
      return new Response(JSON.stringify({ success: true, message: 'No tenants to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[cron-daily-automation] Processing ${tenants.length} tenants`);

    const results: { tenantId: string; tenantName: string; success: boolean; error?: string }[] = [];

    // Run daily-automation for each tenant with internal secret
    for (const tenant of tenants) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/daily-automation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          body: JSON.stringify({ tenantId: tenant.id, internal: true })
        });

        if (!response.ok) {
          const errorText = await response.text();
          results.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            success: false,
            error: errorText
          });
          console.error(`[cron] Failed for tenant ${tenant.name}: ${errorText}`);
        } else {
          results.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            success: true
          });
          console.log(`[cron] Completed for tenant ${tenant.name}`);
        }
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          success: false,
          error: errorMsg
        });
        console.error(`[cron] Error for tenant ${tenant.name}: ${errorMsg}`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[cron-daily-automation] Completed: ${successCount} success, ${failCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      processed: tenants.length,
      successCount,
      failCount,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[cron-daily-automation] Fatal error:', error);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
