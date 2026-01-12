import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const normalizeAssistantData = (input: any): any => {
    if (!input || typeof input !== "object") return input;
    const out = { ...input };

    // Default model provider server-side so the UI never has to.
    if (out.model && typeof out.model === "object") {
      out.model = { ...out.model };
      if (!out.model.provider) {
        out.model.provider = Deno.env.get("VAPI_DEFAULT_MODEL_PROVIDER") || "openai";
      }
    }

    // Default voice provider server-side when voice is an object.
    if (out.voice && typeof out.voice === "object") {
      out.voice = { ...out.voice };
      if (!out.voice.provider) {
        out.voice.provider = Deno.env.get("VAPI_DEFAULT_VOICE_PROVIDER") || "openai";
      }
    }

    return out;
  };

  try {
    const vapiPrivateKey = Deno.env.get('VAPI_PRIVATE_KEY');
    
    if (!vapiPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'VAPI_PRIVATE_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, assistantId, assistantData } = await req.json();

    let url = 'https://api.vapi.ai/assistant';
    let method = 'POST';
    let body: string | undefined;

    switch (action) {
      case 'create':
        method = 'POST';
        body = JSON.stringify(normalizeAssistantData(assistantData));
        break;
      case 'update':
        if (!assistantId) {
          return new Response(
            JSON.stringify({ error: 'assistantId required for update' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `https://api.vapi.ai/assistant/${assistantId}`;
        method = 'PATCH';
        body = JSON.stringify(normalizeAssistantData(assistantData));
        break;
      case 'delete':
        if (!assistantId) {
          return new Response(
            JSON.stringify({ error: 'assistantId required for delete' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `https://api.vapi.ai/assistant/${assistantId}`;
        method = 'DELETE';
        break;
      case 'get':
        if (!assistantId) {
          return new Response(
            JSON.stringify({ error: 'assistantId required for get' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `https://api.vapi.ai/assistant/${assistantId}`;
        method = 'GET';
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: create, update, delete, get' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`Vapi ${action} assistant:`, { url, method });

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${vapiPrivateKey}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    const responseText = await response.text();
    console.log('Vapi response:', response.status, responseText);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: responseText || 'Vapi API error', status: response.status }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = responseText ? JSON.parse(responseText) : { success: true };

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in vapi-manage-assistant:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
