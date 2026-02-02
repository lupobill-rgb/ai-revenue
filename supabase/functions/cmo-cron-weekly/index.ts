import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

// This function is called by cron to run weekly summaries for all active tenants
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify internal secret for cron calls
    const internalSecret = req.headers.get('x-internal-secret');
    const expectedSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
    
    // Allow either internal secret or valid JWT
    const authHeader = req.headers.get('Authorization');
    
    if (internalSecret !== expectedSecret && !authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role for cron operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all active tenants with CMO data
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name')
      .order('created_at', { ascending: false });

    if (tenantsError) {
      console.error('Error fetching tenants:', tenantsError);
      return new Response(JSON.stringify({ error: tenantsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];

    for (const tenant of tenants || []) {
      // Check if tenant has any CMO campaigns
      const { count: campaignCount } = await supabase
        .from('cmo_campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);

      if (!campaignCount || campaignCount === 0) {
        continue; // Skip tenants without CMO data
      }

      try {
        // Call summarize-weekly for this tenant
        const functionUrl = `${SUPABASE_URL}/functions/v1/cmo-summarize-weekly`;
        
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tenant_id: tenant.id }),
        });

        const result = await response.json();
        
        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          success: response.ok,
          result: response.ok ? result : null,
          error: !response.ok ? result.error : null
        });

        console.log(`Weekly summary for ${tenant.name}: ${response.ok ? 'success' : 'failed'}`);
      } catch (error) {
        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Log the cron run
    await supabase.from('agent_runs').insert({
      tenant_id: tenants?.[0]?.id || '00000000-0000-0000-0000-000000000000',
      agent: 'cmo-cron-weekly',
      mode: 'batch',
      input: { tenants_processed: results.length },
      output: { results },
      status: 'completed'
    });

    return new Response(JSON.stringify({ 
      success: true, 
      processed: results.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('CMO Cron Weekly error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
