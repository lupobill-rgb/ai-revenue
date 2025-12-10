import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant-specific VAPI key from ai_settings_voice
    const { data: voiceSettings, error: settingsError } = await supabase
      .from('ai_settings_voice')
      .select('vapi_private_key')
      .eq('tenant_id', user.id)
      .maybeSingle();

    let vapiPrivateKey = voiceSettings?.vapi_private_key;

    // Fallback to global key if tenant doesn't have one configured
    if (!vapiPrivateKey) {
      vapiPrivateKey = Deno.env.get('VAPI_PRIVATE_KEY');
    }
    
    if (!vapiPrivateKey) {
      console.error('No VAPI private key configured for tenant or globally');
      return new Response(
        JSON.stringify({ error: 'VAPI private key not configured. Please add your VAPI credentials in Settings → Integrations → Voice.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching assistants from Vapi API for tenant ${user.id}...`);

    // Fetch assistants from Vapi API using tenant's key
    const response = await fetch('https://api.vapi.ai/assistant', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${vapiPrivateKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vapi API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Vapi API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const assistants = await response.json();
    console.log(`Successfully fetched ${assistants.length} assistants for tenant ${user.id}`);

    // Return simplified assistant data
    const simplifiedAssistants = assistants.map((assistant: any) => ({
      id: assistant.id,
      name: assistant.name || 'Unnamed Assistant',
      firstMessage: assistant.firstMessage,
      model: assistant.model?.model || 'Unknown',
      voice: assistant.voice?.voiceId || assistant.voice?.voice || 'Default',
      createdAt: assistant.createdAt,
    }));

    return new Response(
      JSON.stringify({ assistants: simplifiedAssistants }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in vapi-list-assistants:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
