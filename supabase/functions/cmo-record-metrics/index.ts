import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetricsInput {
  tenant_id: string;
  snapshots: SnapshotInput[];
}

interface SnapshotInput {
  campaign_id?: string;
  channel_id?: string;
  snapshot_date: string;
  metric_type: string;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  engagement_rate?: number;
  conversion_rate?: number;
  cost?: number;
  revenue?: number;
  roi?: number;
  custom_metrics?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const input: MetricsInput = await req.json();
    
    if (!input.tenant_id || !input.snapshots || input.snapshots.length === 0) {
      return new Response(JSON.stringify({ error: 'tenant_id and snapshots array are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare snapshot inserts
    const snapshotInserts = input.snapshots.map(snapshot => ({
      workspace_id: input.tenant_id,
      tenant_id: input.tenant_id,
      campaign_id: snapshot.campaign_id,
      channel_id: snapshot.channel_id,
      snapshot_date: snapshot.snapshot_date,
      metric_type: snapshot.metric_type,
      impressions: snapshot.impressions || 0,
      clicks: snapshot.clicks || 0,
      conversions: snapshot.conversions || 0,
      engagement_rate: snapshot.engagement_rate || 0,
      conversion_rate: snapshot.conversion_rate || 0,
      cost: snapshot.cost || 0,
      revenue: snapshot.revenue || 0,
      roi: snapshot.roi || 0,
      custom_metrics: snapshot.custom_metrics || {}
    }));

    const { data: snapshots, error: snapshotsError } = await supabase
      .from('cmo_metrics_snapshots')
      .insert(snapshotInserts)
      .select();

    if (snapshotsError) {
      console.error('Error recording metrics:', snapshotsError);
      return new Response(JSON.stringify({ error: snapshotsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log agent run
    await supabase.from('agent_runs').insert({
      workspace_id: input.tenant_id,
      tenant_id: input.tenant_id,
      agent: 'cmo-record-metrics',
      mode: 'record',
      input: input,
      output: { snapshots },
      status: 'completed'
    });

    console.log('Metrics recorded:', snapshots?.length || 0, 'snapshots');

    return new Response(JSON.stringify({ success: true, snapshots }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('cmo-record-metrics error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
