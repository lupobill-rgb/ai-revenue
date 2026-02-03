// ElevenLabs Direct Integration - Make Call
// Calls ElevenLabs Conversational AI directly

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error: ELEVENLABS_API_KEY not configured' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    const { agent_id, phone_number, lead_data, metadata } = await req.json()
    
    if (!agent_id || !phone_number) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'agent_id and phone_number are required' 
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }
    
    console.log(`📞 Initiating ElevenLabs call to ${phone_number} with agent ${agent_id}`)
    
    // Call ElevenLabs Conversational AI API directly
    const response = await fetch('https://api.elevenlabs.io/v1/convai/conversations/phone', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_id: agent_id,
        to_phone_number: phone_number,
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
