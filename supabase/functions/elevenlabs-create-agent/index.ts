import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing or invalid Authorization header (sign in required)',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get request body
    const {
      name, 
      first_message, 
      system_prompt,
      voice_id,
      language = 'en',
      workspace_id,
      industry,
      use_case = 'sales_outreach',
      // Advanced config (optional, per ElevenLabs Agents Platform docs)
      llm,
      temperature,
      max_tokens,
      tool_ids,
      built_in_tools,
      tags,
      tts_model_id,
      optimize_streaming_latency,
    } = await req.json().catch(() => ({}))

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'workspace_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Supabase client for workspace data
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Resolve ElevenLabs API key:
    // - prefer project secret (Edge Functions secret) for reliability
    // - if not set, fall back to workspace-configured key stored in ai_settings_voice
    let ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY') ?? ''
    let defaultVoiceId: string | null = null
    let defaultLlm: string | null = null

    if (!ELEVENLABS_API_KEY && workspace_id) {
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      const { data: voiceSettings } = await serviceClient
        .from('ai_settings_voice')
        .select('elevenlabs_api_key, default_elevenlabs_voice_id, elevenlabs_model')
        .eq('workspace_id', workspace_id)
        .maybeSingle()

      ELEVENLABS_API_KEY = voiceSettings?.elevenlabs_api_key ?? ''
      defaultVoiceId = voiceSettings?.default_elevenlabs_voice_id ?? null
      defaultLlm = voiceSettings?.elevenlabs_model ?? null
    }

    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured (set ELEVENLABS_API_KEY secret or add it in Settings > Integrations > Voice)')
    }

    // Get workspace/brand info if workspace_id provided
    let brandName = 'Your Company'
    let brandVoice = 'professional and friendly'
    
    if (workspace_id) {
      const { data: workspace } = await supabaseClient
        .from('workspaces')
        .select('name')
        .eq('id', workspace_id)
        .single()
      
      if (workspace) {
        brandName = workspace.name || brandName
      }

      // Try to get brand settings
      const { data: brandSettings } = await supabaseClient
        .from('ai_settings_brand')
        .select('brand_voice, brand_values')
        .eq('workspace_id', workspace_id)
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
    const agentVoiceId = voice_id || defaultVoiceId || 'EXAVITQu4vr4xnSDxMaL' // Sarah fallback

    // Model (LLM) selection: allow explicit override, else workspace default.
    const agentLlm = (typeof llm === 'string' && llm.trim().length > 0) ? llm.trim() : (defaultLlm || undefined)

    // Create agent via ElevenLabs API
    const createResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: agentName,
        ...(Array.isArray(tags) ? { tags } : {}),
        conversation_config: {
          agent: {
            prompt: {
              prompt: agentPrompt,
              ...(agentLlm ? { llm: agentLlm } : {}),
              ...(typeof temperature === 'number' ? { temperature } : {}),
              ...(typeof max_tokens === 'number' ? { max_tokens } : {}),
              ...(Array.isArray(tool_ids) ? { tool_ids } : {}),
              ...(Array.isArray(built_in_tools) ? { built_in_tools } : {}),
            },
            first_message: agentFirstMessage,
            language: language,
          },
          tts: {
            voice_id: agentVoiceId,
            ...(typeof tts_model_id === 'string' && tts_model_id.trim().length > 0 ? { model_id: tts_model_id.trim() } : {}),
            ...(typeof optimize_streaming_latency === 'number' ? { optimize_streaming_latency } : {}),
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

    // Store agent reference in database if workspace_id provided
    if (workspace_id && agentData.agent_id) {
      try {
        await supabaseClient
          .from('voice_agents')
          .insert({
            // Many existing schemas still enforce tenant_id NOT NULL on voice_agents.
            // Use workspace_id as tenant_id for backward compatibility (matches historical patterns in this repo).
            tenant_id: workspace_id,
            workspace_id: workspace_id,
            provider: 'elevenlabs',
            agent_id: agentData.agent_id,
            name: agentName,
            use_case: use_case,
            config: {
              agent_id: agentData.agent_id,
              use_case: use_case,
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
