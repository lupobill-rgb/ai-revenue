// ElevenLabs Direct Integration - Make Call
// Bypasses VAPI, calls ElevenLabs Conversational AI directly

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')

if (!ELEVENLABS_API_KEY) {
  console.error('FATAL: ELEVENLABS_API_KEY not configured')
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      } 
    })
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Authorization required" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      })
    }

    const { agent_id, phone_number, lead_data, metadata, workspace_id, workspaceId, from_phone_number } = await req.json()
    const effectiveWorkspaceId = workspace_id || workspaceId
    
    if (!agent_id || !phone_number) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'agent_id and phone_number are required' 
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    if (!effectiveWorkspaceId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "workspace_id is required",
        }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      )
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error: missing Supabase env" }),
        { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      )
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Verify workspace access.
    const { data: ws, error: wsErr } = await supabaseClient
      .from("workspaces")
      .select("id")
      .eq("id", effectiveWorkspaceId)
      .maybeSingle()
    if (wsErr || !ws) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden (workspace access denied)" }), {
        status: 403,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      })
    }

    // Resolve ElevenLabs API key: prefer secret, then workspace setting.
    let elevenKey = (ELEVENLABS_API_KEY ?? "").trim()
    let defaultPhoneNumberId: string | null = null
    if (supabaseServiceKey) {
      const admin = createClient(supabaseUrl, supabaseServiceKey)
      const { data: voiceSettings } = await admin
        .from("ai_settings_voice")
        .select("elevenlabs_api_key, default_phone_number_id")
        .eq("workspace_id", effectiveWorkspaceId)
        .maybeSingle()
      if (!elevenKey) elevenKey = (voiceSettings?.elevenlabs_api_key ?? "").trim()
      defaultPhoneNumberId = voiceSettings?.default_phone_number_id ?? null
    }

    if (!elevenKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "ElevenLabs API key not configured (set ELEVENLABS_API_KEY secret or add it in Settings > Integrations > Voice)",
        }),
        { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      )
    }

    // ElevenLabs requires from_phone_number for phone conversations.
    let fromPhone = (from_phone_number ?? "").trim()
    if (!fromPhone && defaultPhoneNumberId) {
      const { data: pn, error: pnErr } = await supabaseClient
        .from("voice_phone_numbers")
        .select("phone_number, provider")
        .eq("id", defaultPhoneNumberId)
        .maybeSingle()
      if (!pnErr && pn?.phone_number) {
        fromPhone = pn.phone_number
      }
    }

    if (!fromPhone) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Missing from_phone_number. Set a default phone number in Settings (ai_settings_voice.default_phone_number_id) or pass from_phone_number.",
        }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      )
    }
    
    console.log(`📞 Initiating ElevenLabs call to ${phone_number} with agent ${agent_id}`)
    
    // Call ElevenLabs Conversational AI API directly
    const response = await fetch('https://api.elevenlabs.io/v1/convai/conversations/phone', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_id: agent_id,
        to_phone_number: phone_number,
        from_phone_number: fromPhone,
        metadata: {
          ...metadata,
          lead_id: lead_data?.id,
          lead_name: lead_data?.name,
          company: lead_data?.company,
          initiated_by: 'ubigrowth_platform'
        }
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error('ElevenLabs API error:', error)
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`)
    }
    
    const data = await response.json()
    
    console.log(`✅ Call initiated successfully. Conversation ID: ${data.conversation_id}`)
    
    return new Response(
      JSON.stringify({
        success: true,
        conversation_id: data.conversation_id,
        status: data.status || 'initiated',
        agent_id: agent_id,
        phone_number: phone_number,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    )
    
  } catch (error) {
    console.error('❌ Failed to make call:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate call'
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
})
