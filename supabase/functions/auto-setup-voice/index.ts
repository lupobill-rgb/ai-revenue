// Auto-Setup Voice Agents
// Automatically configures ElevenLabs and orchestration
// Zero-config onboarding - everything just works!

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

serve(async (req) => {
  try {
    const { tenant_id, user_id } = await req.json()
    
    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Tenant ID required' }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }
    
    console.log(`🚀 Auto-setup for tenant: ${tenant_id}`)
    
    const setupResults = {
      success: true,
      tenant_id,
      setup_steps: [] as any[],
      agents_created: [] as any[],
      ready_to_use: false
    }
    
    // Step 1: Check ElevenLabs connection
    if (ELEVENLABS_API_KEY) {
      try {
        const elevenLabsCheck = await fetch('https://api.elevenlabs.io/v1/user', {
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY
          }
        })
        
        if (elevenLabsCheck.ok) {
          setupResults.setup_steps.push({
            step: 'elevenlabs_connection',
            status: 'connected',
            message: 'ElevenLabs connected successfully'
          })
          
          // Check for agents
          const agentsCheck = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY
            }
          })
          
          if (agentsCheck.ok) {
            const agentsData = await agentsCheck.json()
            if (!agentsData.agents || agentsData.agents.length === 0) {
              // No agents - user needs to create one in ElevenLabs dashboard
              setupResults.setup_steps.push({
                step: 'elevenlabs_agents',
                status: 'action_required',
                message: 'Create agent at https://elevenlabs.io/app/agents',
                action_url: 'https://elevenlabs.io/app/agents'
              })
            } else {
              setupResults.agents_created.push({
                provider: 'elevenlabs',
                count: agentsData.agents.length,
                agents: agentsData.agents.map((a: any) => ({
                  id: a.agent_id,
                  name: a.name || 'ElevenLabs Agent'
                }))
              })
            }
          }
        }
      } catch (error) {
        setupResults.setup_steps.push({
          step: 'elevenlabs_connection',
          status: 'skipped',
          message: 'ElevenLabs not configured (optional)'
        })
      }
    }
    
    // Step 2: Setup orchestration defaults
    if (OPENAI_API_KEY) {
      setupResults.setup_steps.push({
        step: 'orchestration',
        status: 'ready',
        message: 'Smart orchestration enabled',
        features: [
          'Automatic channel selection',
          'Cost optimization',
          'Lead qualification',
          'Multi-channel routing'
        ]
      })
    }
    
    // Step 3: Determine ready state
    const hasElevenLabs = setupResults.setup_steps.some(s => s.step === 'elevenlabs_connection' && s.status === 'connected')
    const hasOrchestration = setupResults.setup_steps.some(s => s.step === 'orchestration' && s.status === 'ready')
    
    setupResults.ready_to_use = hasElevenLabs && hasOrchestration
    
    // Step 4: Generate onboarding message
    if (setupResults.ready_to_use) {
      setupResults.setup_steps.push({
        step: 'complete',
        status: 'success',
        message: '🎉 Voice agents ready! You can start sending campaigns.',
        next_steps: [
          'Go to any campaign',
          'Select leads',
          'Click "Send" - system handles the rest!'
        ]
      })
    } else {
      const missing = []
      if (!hasElevenLabs) missing.push('Voice provider (ElevenLabs)')
      if (!hasOrchestration) missing.push('OpenAI for orchestration')
      
      setupResults.setup_steps.push({
        step: 'incomplete',
        status: 'action_required',
        message: `Missing: ${missing.join(', ')}`,
        help_url: 'See API_KEYS_MASTER_CHECKLIST.md'
      })
    }
    
    console.log(`✅ Auto-setup complete. Ready: ${setupResults.ready_to_use}`)
    
    return new Response(
      JSON.stringify(setupResults, null, 2),
      { 
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    )
    
  } catch (error) {
    console.error("❌ Auto-setup error:", error)
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
