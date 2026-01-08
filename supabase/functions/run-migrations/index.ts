import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ONE-TIME MIGRATION RUNNER
// This is a temporary edge function to run migrations when Lovable auto-migration fails
// DELETE THIS FUNCTION AFTER MIGRATIONS RUN SUCCESSFULLY

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Admin client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[run-migrations] Starting database migrations...');

    const results = [];

    // ========================================================================
    // MIGRATION 1: Critical Security Fixes
    // ========================================================================
    
    try {
      console.log('[run-migrations] Running Migration 1: Security Fixes...');
      
      // Add workspace_id to asset_approvals
      await supabase.rpc('execute_sql', {
        query: `
          -- Add workspace_id column
          ALTER TABLE public.asset_approvals 
            ADD COLUMN IF NOT EXISTS workspace_id UUID;
          
          -- Backfill workspace_id
          UPDATE public.asset_approvals aa
          SET workspace_id = a.workspace_id
          FROM public.assets a
          WHERE aa.asset_id = a.id AND aa.workspace_id IS NULL;
          
          -- Delete orphaned records
          DELETE FROM public.asset_approvals WHERE workspace_id IS NULL;
          
          -- Make NOT NULL
          ALTER TABLE public.asset_approvals 
            ALTER COLUMN workspace_id SET NOT NULL;
        `
      });

      results.push({ migration: 1, status: 'success', message: 'Security fixes applied' });
    } catch (e: unknown) {
      console.error('[run-migrations] Migration 1 failed:', e);
      results.push({ migration: 1, status: 'error', message: e instanceof Error ? e.message : String(e) });
    }

    // ========================================================================
    // MIGRATION 2: Performance Optimizations (Critical indexes only)
    // ========================================================================
    
    try {
      console.log('[run-migrations] Running Migration 2: Performance...');
      
      // Create critical indexes
      const indexes = [
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_workspace_status ON public.leads(workspace_id, status)',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_workspace_created ON public.leads(workspace_id, created_at DESC)',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channel_outbox_processing ON public.channel_outbox(workspace_id, status, scheduled_at) WHERE status IN (\'scheduled\', \'pending\')',
      ];

      for (const indexSQL of indexes) {
        await supabase.rpc('execute_sql', { query: indexSQL });
      }

      results.push({ migration: 2, status: 'success', message: 'Critical indexes created' });
    } catch (e: unknown) {
      console.error('[run-migrations] Migration 2 failed:', e);
      results.push({ migration: 2, status: 'error', message: e instanceof Error ? e.message : String(e) });
    }

    console.log('[run-migrations] Migrations complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: 'Migrations executed. Check results for any errors.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[run-migrations] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

