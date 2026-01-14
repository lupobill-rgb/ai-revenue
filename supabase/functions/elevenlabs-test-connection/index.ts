/**
 * ElevenLabs Test Connection
 * Verifies that an ElevenLabs API key is valid by fetching available voices
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth header for user context
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get workspace_id (preferred) or legacy tenantId from request body
    const body = await req.json().catch(() => ({}));
    const workspaceId = body.workspace_id || body.workspaceId;
    const tenantId = body.tenantId;

    if (!workspaceId && !tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "workspace_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch ElevenLabs API key from voice settings
    const query = supabase.from("ai_settings_voice").select("elevenlabs_api_key");
    const { data: voiceSettings, error: settingsError } = workspaceId
      ? await query.eq("workspace_id", workspaceId).maybeSingle()
      : await query.eq("tenant_id", tenantId).maybeSingle();

    if (settingsError) {
      console.error("Error fetching voice settings:", settingsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch voice settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = voiceSettings?.elevenlabs_api_key || Deno.env.get("ELEVENLABS_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "ElevenLabs API key not configured",
          message: "Please add your ElevenLabs API key in Settings > Integrations > Voice"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test connection by fetching voices
    const voicesResponse = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!voicesResponse.ok) {
      const errorText = await voicesResponse.text();
      console.error("ElevenLabs API error:", voicesResponse.status, errorText);
      
      if (voicesResponse.status === 401) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Invalid ElevenLabs API key",
            message: "The API key is invalid or expired. Please check your key in Settings."
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `ElevenLabs API error: ${voicesResponse.status}`,
          message: errorText
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const voicesData = await voicesResponse.json();
    const voiceCount = voicesData?.voices?.length || 0;

    console.log(`ElevenLabs connection verified: ${voiceCount} voices available`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `ElevenLabs connected - ${voiceCount} voices available`,
        voiceCount
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error testing ElevenLabs connection:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
