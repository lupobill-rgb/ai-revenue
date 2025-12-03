import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function is called by pg_cron and runs daily-automation for ALL active workspaces
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[Cron Daily Automation] Starting at ${new Date().toISOString()}`);

    // Fetch all active workspaces
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('id, name');

    if (workspacesError) {
      throw new Error(`Failed to fetch workspaces: ${workspacesError.message}`);
    }

    if (!workspaces || workspaces.length === 0) {
      console.log('[Cron Daily Automation] No workspaces found, skipping');
      return new Response(JSON.stringify({ success: true, message: 'No workspaces to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Cron Daily Automation] Processing ${workspaces.length} workspaces`);

    const results: { workspaceId: string; workspaceName: string; success: boolean; error?: string }[] = [];

    // Run daily-automation for each workspace
    for (const workspace of workspaces) {
      try {
        const { error } = await supabase.functions.invoke('daily-automation', {
          body: { workspaceId: workspace.id }
        });

        if (error) {
          results.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            success: false,
            error: error.message
          });
          console.error(`[Cron] Failed for workspace ${workspace.name}: ${error.message}`);
        } else {
          results.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            success: true
          });
          console.log(`[Cron] Completed for workspace ${workspace.name}`);
        }
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        results.push({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          success: false,
          error: errorMsg
        });
        console.error(`[Cron] Error for workspace ${workspace.name}: ${errorMsg}`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[Cron Daily Automation] Completed: ${successCount} success, ${failCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      processed: workspaces.length,
      successCount,
      failCount,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Cron Daily Automation] Fatal error:', error);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
