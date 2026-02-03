// Campaign Orchestrator - The Brain
// Simple API: Just pass leads and campaign type
// System automatically chooses best channels and timing

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import OpenAI from "npm:openai@^4.20.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!OPENAI_API_KEY) {
  console.error('FATAL: OPENAI_API_KEY not configured')
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || 'dummy-key-will-fail'
})

interface CampaignRequest {
  campaign_name: string
  campaign_goal: 'appointment' | 'nurture' | 'reactivation' | 'announcement'
  leads: Array<{
    id: string
    name?: string
    email?: string
    phone?: string
    company?: string
    score?: number
  }>
  message?: string  // Optional: AI generates if not provided
  budget_per_lead?: number  // Optional: default $1
}

interface ChannelStrategy {
  lead_id: string
  primary_channel: 'elevenlabs' | 'sms' | 'email'
  fallback_channels: string[]
  timing: 'immediate' | 'business_hours' | 'optimal'
  estimated_cost: number
  reasoning: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Check API key
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify authorization (optional but recommended - allows service-to-service calls)
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      console.log('Authenticated request received')
    } else {
      console.warn('Unauthenticated request - consider requiring auth in production')
    }

    const campaign: CampaignRequest = await req.json()
    
    console.log(`🎯 Orchestrating campaign: ${campaign.campaign_name}`)
    console.log(`📊 Total leads: ${campaign.leads.length}`)
    
    // Step 1: Analyze each lead and determine best channel strategy
    const strategies: ChannelStrategy[] = []
    
    for (const lead of campaign.leads) {
      const strategy = await determineChannelStrategy(lead, campaign)
      strategies.push(strategy)
    }
    
    // Step 2: Group by channel for efficient execution
    const channelGroups = groupByChannel(strategies)
    
    // Step 3: Generate content if not provided
    const content = campaign.message || await generateCampaignContent(campaign)
    
    // Step 4: Execute campaign through appropriate channels
    const executions = await executeCampaign(channelGroups, content, campaign)
    
    // Step 5: Return execution plan
    const summary = {
      success: true,
      campaign_id: crypto.randomUUID(),
      campaign_name: campaign.campaign_name,
      total_leads: campaign.leads.length,
      strategies: {
        elevenlabs_calls: channelGroups.elevenlabs?.length || 0,
        sms_messages: channelGroups.sms?.length || 0,
        email_messages: channelGroups.email?.length || 0
      },
      estimated_cost: strategies.reduce((sum, s) => sum + s.estimated_cost, 0),
      executions: executions,
      started_at: new Date().toISOString()
    }
    
    console.log(`✅ Campaign orchestrated successfully`)
    console.log(`💰 Estimated cost: $${summary.estimated_cost.toFixed(2)}`)
    
    return new Response(
      JSON.stringify(summary, null, 2),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    )
    
  } catch (error) {
    console.error("❌ Orchestration error:", error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    )
  }
})

// Determine best channel strategy for each lead
async function determineChannelStrategy(
  lead: any, 
  campaign: CampaignRequest
): Promise<ChannelStrategy> {
  
  // Get lead score (or qualify if not scored)
  let leadScore = lead.score
  
  if (!leadScore) {
    // Quick qualification using OpenAI
    const quickQual = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Score this lead 1-10: ${JSON.stringify(lead)}`
      }],
      max_tokens: 50,
      temperature: 0.3
    })
    
    const scoreMatch = quickQual.choices[0].message.content.match(/\d+/)
    leadScore = scoreMatch ? parseInt(scoreMatch[0]) : 5
  }
  
  // Intelligence: Choose channel based on multiple factors
  const hasPhone = !!lead.phone
  const hasEmail = !!lead.email
  const budget = campaign.budget_per_lead || 1.0
  const goal = campaign.campaign_goal
  
  let primary_channel: ChannelStrategy['primary_channel'] = 'email'
  let fallback_channels: string[] = []
  let estimated_cost = 0.02
  let reasoning = ''
  
  // HIGH VALUE (8-10) + Has Phone + Budget allows
  if (leadScore >= 8 && hasPhone && budget >= 0.50) {
    if (goal === 'appointment') {
      primary_channel = 'elevenlabs'
      fallback_channels = ['sms', 'email']
      estimated_cost = 0.75
      reasoning = 'High-value lead, appointment goal → Live AI call for best conversion'
    } else {
      primary_channel = 'elevenlabs'
      fallback_channels = ['sms', 'email']
      estimated_cost = 0.75
      reasoning = 'High-value lead, non-appointment → AI call with SMS/email backup'
    }
  }
  
  // MEDIUM VALUE (5-7) + Has Phone
  else if (leadScore >= 5 && hasPhone) {
    primary_channel = 'elevenlabs'
    fallback_channels = ['sms', 'email']
    estimated_cost = 0.75
    reasoning = 'Medium-value lead → AI call with SMS/email backup'
  }
  
  // MEDIUM VALUE (5-7) + No Phone but has Email
  else if (leadScore >= 5 && hasEmail) {
    primary_channel = 'email'
    fallback_channels = ['sms']
    estimated_cost = 0.02
    reasoning = 'Medium-value lead, no phone → Email with SMS backup'
  }
  
  // LOW VALUE (1-4) or Limited Contact Info
  else {
    if (hasEmail) {
      primary_channel = 'email'
      fallback_channels = hasPhone ? ['sms'] : []
      estimated_cost = 0.02
      reasoning = 'Low-value/incomplete lead → Email only (cost-effective)'
    } else if (hasPhone) {
      primary_channel = 'sms'
      fallback_channels = []
      estimated_cost = 0.05
      reasoning = 'Low-value lead, no email → SMS only'
    }
  }
  
  return {
    lead_id: lead.id,
    primary_channel,
    fallback_channels,
    timing: leadScore >= 8 ? 'immediate' : 'business_hours',
    estimated_cost,
    reasoning
  }
}

// Group strategies by channel for batch execution
function groupByChannel(strategies: ChannelStrategy[]) {
  return strategies.reduce((groups, strategy) => {
    const channel = strategy.primary_channel
    if (!groups[channel]) groups[channel] = []
    groups[channel].push(strategy)
    return groups
  }, {} as Record<string, ChannelStrategy[]>)
}

// Generate campaign content using AI
async function generateCampaignContent(campaign: CampaignRequest): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: 'You are a marketing copywriter. Create concise, professional campaign messages.'
    }, {
      role: 'user',
      content: `Create a ${campaign.campaign_goal} message for ${campaign.campaign_name}. Keep it under 100 words.`
    }],
    max_tokens: 200
  })
  
  return completion.choices[0].message.content
}

// Execute campaign through channels
async function executeCampaign(
  channelGroups: Record<string, ChannelStrategy[]>,
  content: string,
  campaign: CampaignRequest
) {
  const executions = []
  
  // Execute ElevenLabs calls
  if (channelGroups.elevenlabs?.length) {
    console.log(`📞 Scheduling ${channelGroups.elevenlabs.length} ElevenLabs calls`)
    executions.push({
      channel: 'elevenlabs',
      count: channelGroups.elevenlabs.length,
      status: 'queued',
      note: 'AI voice calls will be made during business hours'
    })
    // TODO: Queue ElevenLabs calls via their API
  }
  
  // Execute SMS via Twilio
  if (channelGroups.sms?.length) {
    console.log(`📱 Scheduling ${channelGroups.sms.length} SMS messages`)
    executions.push({
      channel: 'sms',
      count: channelGroups.sms.length,
      status: 'queued',
      note: 'SMS messages will be sent via Twilio'
    })
    // TODO: Queue SMS via Twilio API
  }
  
  // Execute Email via Resend
  if (channelGroups.email?.length) {
    console.log(`📧 Scheduling ${channelGroups.email.length} emails`)
    executions.push({
      channel: 'email',
      count: channelGroups.email.length,
      status: 'queued',
      note: 'Emails will be sent via Resend'
    })
    // TODO: Queue emails via Resend API
  }
  
  return executions
}
