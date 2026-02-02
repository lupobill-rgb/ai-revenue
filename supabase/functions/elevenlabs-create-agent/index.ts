import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
    
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured')
    }

    // Get request body
    const { 
      name, 
      first_message, 
      system_prompt,
      voice_id,
      language = 'en',
      tenant_id,
      industry,
      use_case = 'sales_outreach'
    } = await req.json()

    // Get Supabase client for tenant data
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get tenant/brand info if tenant_id provided
    let brandName = 'Your Company'
    let brandVoice = 'professional and friendly'
    
    if (tenant_id) {
      const { data: tenant } = await supabaseClient
        .from('tenants')
        .select('name')
        .eq('id', tenant_id)
        .single()
      
      if (tenant) {
        brandName = tenant.name || brandName
      }

      // Try to get brand settings
      const { data: brandSettings } = await supabaseClient
        .from('ai_settings_brand')
        .select('brand_voice, brand_values')
        .eq('tenant_id', tenant_id)
        .single()
      
      if (brandSettings?.brand_voice) {
        brandVoice = brandSettings.brand_voice
      }
    }

    // Smart defaults based on use case
    const USE_CASE_TEMPLATES = {
      sales_outreach: {
        default_name: `${brandName} Sales Agent`,
        default_first_message: `Hi! I'm calling from ${brandName}. Do you have a quick moment to chat about how we can help your business?`,
        default_prompt: `You are a professional sales representative for ${brandName}. Your tone is ${brandVoice}.

Your goal is to:
- Introduce ${brandName} and our value proposition
- Qualify the lead by understanding their needs
- Book a meeting or demo if they're interested
- Be respectful of their time - if they're not interested, politely end the call

Keep responses concise (2-3 sentences max). Ask one question at a time. Listen actively and respond naturally.`,
      },
      customer_support: {
        default_name: `${brandName} Support Agent`,
        default_first_message: `Hello! Thank you for calling ${brandName} support. How can I help you today?`,
        default_prompt: `You are a helpful customer support agent for ${brandName}. Your tone is ${brandVoice}.

Your goal is to:
- Understand the customer's issue
- Provide clear, actionable solutions
- Be empathetic and patient
- Escalate to a human if needed

Keep responses clear and concise. Ask clarifying questions when needed.`,
      },
      appointment_setting: {
        default_name: `${brandName} Appointment Setter`,
        default_first_message: `Hi! I'm calling from ${brandName} to help schedule your appointment. Is now a good time?`,
        default_prompt: `You are an appointment scheduling agent for ${brandName}. Your tone is ${brandVoice}.

Your goal is to:
- Confirm the prospect's availability
- Find a suitable time slot
- Collect necessary information
- Confirm the appointment details

Be efficient but friendly. Offer specific time options.`,
      },
      lead_qualification: {
        default_name: `${brandName} Lead Qualifier`,
        default_first_message: `Hi! I'm calling from ${brandName}. I wanted to see if we might be a good fit to help with your [industry] needs. Do you have a moment?`,
        default_prompt: `You are a lead qualification agent for ${brandName}. Your tone is ${brandVoice}.

Your goal is to:
- Determine if the lead is a good fit
- Ask qualifying questions (budget, timeline, decision maker)
- Score the lead (hot/warm/cold)
- Pass qualified leads to sales

Keep it conversational. Don't sound like you're reading from a script.`,
      },
    }

    const template = USE_CASE_TEMPLATES[use_case as keyof typeof USE_CASE_TEMPLATES] || USE_CASE_TEMPLATES.sales_outreach

    // Use provided values or smart defaults
    const agentName = name || template.default_name
    const agentFirstMessage = first_message || template.default_first_message
    const agentPrompt = system_prompt || template.default_prompt

    // Default voice (use ElevenLabs' default voice if none specified)
    const agentVoiceId = voice_id || 'EXAVITQu4vr4xnSDxMaL' // Sarah - professional female voice

    // Create agent via ElevenLabs API
    const createResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: agentName,
        conversation_config: {
          agent: {
            prompt: {
              prompt: agentPrompt,
            },
            first_message: agentFirstMessage,
            language: language,
          },
          tts: {
            voice_id: agentVoiceId,
          },
        },
      }),
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error('ElevenLabs agent creation failed:', errorText)
      throw new Error(`Failed to create agent: ${errorText}`)
    }

    const agentData = await createResponse.json()

    console.log('✅ Agent created successfully:', agentData.agent_id)

    // Store agent reference in database if tenant_id provided
    if (tenant_id && agentData.agent_id) {
      try {
        await supabaseClient
          .from('voice_agents')
          .insert({
            tenant_id: tenant_id,
            provider: 'elevenlabs',
            agent_id: agentData.agent_id,
            name: agentName,
            use_case: use_case,
            config: {
              first_message: agentFirstMessage,
              system_prompt: agentPrompt,
              voice_id: agentVoiceId,
              language: language,
            },
            status: 'active',
          })
      } catch (dbError) {
        console.error('Failed to store agent in database:', dbError)
        // Don't fail the request - agent was created successfully
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        agent_id: agentData.agent_id,
        name: agentName,
        message: 'Agent created successfully',
        agent: agentData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error creating agent:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
