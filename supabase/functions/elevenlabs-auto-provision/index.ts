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

    const { workspace_id } = await req.json().catch(() => ({}))

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'workspace_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Check if workspace already has agents
    const { data: existingAgents, error: checkError } = await supabaseClient
      .from('voice_agents')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('status', 'active')

    if (checkError) {
      console.error('Error checking existing agents:', checkError)
      // Continue anyway - might be table doesn't exist yet
    }

    if (existingAgents && existingAgents.length > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Agents already exist',
          agent_count: existingAgents.length,
          already_provisioned: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get workspace details for personalization
    const { data: workspace } = await supabaseClient
      .from('workspaces')
      .select('name')
      .eq('id', workspace_id)
      .single()

    const workspaceName = workspace?.name || 'Your Company'

    // Create default agents for the workspace
    const agentsToCreate = [
      {
        use_case: 'sales_outreach',
        name: `${workspaceName} Sales Agent`,
      },
      {
        use_case: 'lead_qualification',
        name: `${workspaceName} Lead Qualifier`,
      },
      {
        use_case: 'appointment_setting',
        name: `${workspaceName} Appointment Setter`,
      },
    ]

    const createdAgents = []
    const errors = []

    // Create each agent
    for (const agentConfig of agentsToCreate) {
      try {
        const createResponse = await supabaseClient.functions.invoke('elevenlabs-create-agent', {
          body: {
            workspace_id: workspace_id,
            use_case: agentConfig.use_case,
            name: agentConfig.name,
          },
          // Ensure nested invoke is authenticated as the user (prevents "invalid jwt" from null auth headers).
          headers: {
            Authorization: authHeader,
          },
        })

        if (createResponse.data?.success) {
          createdAgents.push({
            agent_id: createResponse.data.agent_id,
            name: agentConfig.name,
            use_case: agentConfig.use_case,
          })
          console.log(`✅ Created ${agentConfig.use_case} agent:`, createResponse.data.agent_id)
        } else {
          errors.push({
            use_case: agentConfig.use_case,
            error: createResponse.error || 'Unknown error',
          })
          console.error(`❌ Failed to create ${agentConfig.use_case} agent:`, createResponse.error)
        }
      } catch (error) {
        errors.push({
          use_case: agentConfig.use_case,
          error: error.message,
        })
        console.error(`❌ Error creating ${agentConfig.use_case} agent:`, error)
      }
    }

    // Return results
    return new Response(
      JSON.stringify({
        success: createdAgents.length > 0,
        message: `Created ${createdAgents.length} out of ${agentsToCreate.length} agents`,
        agents: createdAgents,
        errors: errors.length > 0 ? errors : undefined,
        workspace_id: workspace_id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Auto-provision error:', error)
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
