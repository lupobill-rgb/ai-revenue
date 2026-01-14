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
    const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Supabase configuration' }),
        { status: 500, headers: jsonHeaders }
      )
    }

    // Auth: use user (anon) client to validate JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: jsonHeaders }
      )
    }
    const token = authHeader.replace('Bearer ', '')

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: jsonHeaders }
      )
    }

    // Service role client: read secrets + write DB records
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Get request body
    const body = await req.json().catch(() => null)
    if (!body) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400, headers: jsonHeaders }
      )
    }

    const {
      name,
      agent_name,
      first_message,
      system_prompt,
      voice_id,
      language = 'en',
      workspace_id,
      industry,
      use_case = 'sales_outreach',
      from_phone_number,
    } = body

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'workspace_id is required' }),
        { status: 400, headers: jsonHeaders }
      )
    }

    if (!from_phone_number) {
      return new Response(
        JSON.stringify({ success: false, error: 'from_phone_number is required' }),
        { status: 400, headers: jsonHeaders }
      )
    }

    // Fetch ElevenLabs API key from ai_settings_voice (workspace-scoped)
    let voiceSettings: { elevenlabs_api_key?: string | null; default_elevenlabs_voice_id?: string | null } | null = null
    try {
      const { data, error } = await supabaseAdmin
        .from('ai_settings_voice')
        .select('elevenlabs_api_key, default_elevenlabs_voice_id')
        .eq('workspace_id', workspace_id)
        .maybeSingle()

      if (error) throw error
      voiceSettings = data
    } catch (e) {
      // Back-compat if tenant_id still exists (older schema)
      const { data } = await supabaseAdmin
        .from('ai_settings_voice')
        .select('elevenlabs_api_key, default_elevenlabs_voice_id')
        .eq('tenant_id', workspace_id)
        .maybeSingle()
      voiceSettings = data
    }

    const ELEVENLABS_API_KEY =
      voiceSettings?.elevenlabs_api_key ||
      Deno.env.get('ELEVENLABS_API_KEY') ||
      null

    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'ElevenLabs API key is missing (configure in ai_settings_voice or ELEVENLABS_API_KEY)' }),
        { status: 400, headers: jsonHeaders }
      )
    }

    // Get workspace/brand info if workspace_id provided
    let brandName = 'Your Company'
    let brandVoice = 'professional and friendly'
    
    const { data: workspace } = await supabaseUser
      .from('workspaces')
      .select('name')
      .eq('id', workspace_id)
      .single()
    
    if (workspace) {
      brandName = workspace.name || brandName
    }

    // Try to get brand settings (user-scoped/RLS enforced)
    const { data: brandSettings } = await supabaseUser
      .from('ai_settings_brand')
      .select('brand_voice, brand_values')
      .eq('workspace_id', workspace_id)
      .single()
    
    if (brandSettings?.brand_voice) {
      brandVoice = brandSettings.brand_voice
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
    const agentName = name || agent_name || template.default_name
    const agentFirstMessage = first_message || template.default_first_message
    const agentPrompt = system_prompt || template.default_prompt

    // Default voice (use ElevenLabs' default voice if none specified)
    const agentVoiceId =
      voice_id ||
      voiceSettings?.default_elevenlabs_voice_id ||
      'EXAVITQu4vr4xnSDxMaL' // Sarah - professional female voice

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

    // Store agent reference in database (service role client to avoid RLS issues)
    if (agentData.agent_id) {
      const { error: insertError } = await supabaseAdmin
        .from('voice_agents')
        .insert({
          workspace_id: workspace_id,
          provider: 'elevenlabs',
          agent_id: agentData.agent_id,
          name: agentName,
          use_case: use_case,
          config: {
            first_message: agentFirstMessage,
            system_prompt: agentPrompt,
            voice_id: agentVoiceId,
            language: language,
            industry: industry,
            from_phone_number: from_phone_number,
          },
          status: 'active',
          created_by: user.id,
        })

      if (insertError) {
        console.error('Failed to store agent in database:', insertError)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Agent created on ElevenLabs but failed to store in database',
            agent_id: agentData.agent_id,
            details: insertError.message,
          }),
          { status: 500, headers: jsonHeaders }
        )
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
        headers: jsonHeaders,
      }
    )

  } catch (error) {
    console.error('Error creating agent:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
