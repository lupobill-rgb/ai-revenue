// Smart Send - Ultra-Simple API
// UI just calls: { leads: [...], message: "...", goal: "appointment" }
// System handles EVERYTHING else

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
  try {
    const { leads, message, goal = 'nurture' } = await req.json()
    
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No leads provided' }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }
    
    console.log(`🚀 Smart Send: ${leads.length} leads`)
    
    // Call orchestrator with auto-generated campaign name
    const campaignName = `Campaign ${new Date().toISOString().split('T')[0]}`
    
    const orchestratorResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/orchestrate-campaign`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          campaign_name: campaignName,
          campaign_goal: goal,
          leads: leads,
          message: message
        })
      }
    )
    
    const result = await orchestratorResponse.json()
    
    // Simplify response for UI
    const simplifiedResult = {
      success: true,
      sent_to: leads.length,
      channels_used: {
        voice_calls: result.strategies?.elevenlabs_calls || 0,
        sms: result.strategies?.sms_messages || 0,
        email: result.strategies?.email_messages || 0
      },
      estimated_cost: result.estimated_cost,
      message: `Campaign launched successfully! Messages being sent through ${
        Object.entries(result.strategies || {})
          .filter(([_, count]) => count > 0)
          .length
      } channels.`
    }
    
    return new Response(
      JSON.stringify(simplifiedResult, null, 2),
      { 
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    )
    
  } catch (error) {
    console.error("❌ Smart Send error:", error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 500
      }
    )
  }
})
