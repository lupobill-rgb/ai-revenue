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
    const { tenant_id } = await req.json()

    if (!tenant_id) {
      throw new Error('tenant_id is required')
    }

    // Get Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Check if tenant already has agents
    const { data: existingAgents, error: checkError } = await supabaseClient
      .from('voice_agents')
      .select('id')
      .eq('tenant_id', tenant_id)
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

    // Get tenant details for personalization
    const { data: tenant } = await supabaseClient
      .from('tenants')
      .select('name')
      .eq('id', tenant_id)
      .single()

    const tenantName = tenant?.name || 'Your Company'

    // Create default agents for the tenant
    const agentsToCreate = [
      {
        use_case: 'sales_outreach',
        name: `${tenantName} Sales Agent`,
      },
      {
        use_case: 'lead_qualification',
        name: `${tenantName} Lead Qualifier`,
      },
      {
        use_case: 'appointment_setting',
        name: `${tenantName} Appointment Setter`,
      },
    ]

    const createdAgents = []
    const errors = []

    // Create each agent
    for (const agentConfig of agentsToCreate) {
      try {
        const createResponse = await supabaseClient.functions.invoke('elevenlabs-create-agent', {
          body: {
            tenant_id: tenant_id,
            use_case: agentConfig.use_case,
            name: agentConfig.name,
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
        tenant_id: tenant_id,
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
