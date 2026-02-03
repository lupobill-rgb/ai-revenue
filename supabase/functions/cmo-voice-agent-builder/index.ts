import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VoiceAgentBuilderInput {
  tenant_id?: string; // Deprecated, kept for backward compatibility
  workspace_id: string;
  brand_voice: string;
  icp: string;
  offer: string;
  constraints?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const input: VoiceAgentBuilderInput = await req.json();
    const { tenant_id, workspace_id, brand_voice, icp, offer, constraints = [] } = input;

    // Prefer workspace_id, fallback to tenant_id for backward compatibility
    const workspaceId = workspace_id || tenant_id;
    
    if (!workspaceId || !brand_voice || !icp || !offer) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: workspace_id (or tenant_id), brand_voice, icp, offer' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Voice Agent Builder: Building agent for workspace ${workspaceId}`);

    // Fetch brand profile for additional context
    const { data: brandProfile } = await supabase
      .from('cmo_brand_profiles')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    // Fetch existing voice settings
    const { data: voiceSettings } = await supabase
      .from('ai_settings_voice')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    const brandContext = brandProfile ? `
Company: ${brandProfile.brand_name}
Industry: ${brandProfile.industry || 'Not specified'}
Value Proposition: ${brandProfile.unique_value_proposition || offer}
Tagline: ${brandProfile.tagline || ''}
` : '';

    // Build the AI prompt for generating voice agent config
    const systemPrompt = `You are an expert voice AI agent designer. Your job is to create comprehensive, brand-aligned voice agent configurations for outbound and inbound calls.

Generate configurations that are:
- Aligned with the brand voice and tone
- Compliant with all constraints
- Optimized for the target ICP
- Professional and conversion-focused

Output ONLY valid JSON matching the exact schema requested.`;

    const userPrompt = `Create a voice agent configuration with the following parameters:

**Brand Context:**
${brandContext}

**Brand Voice:** ${brand_voice}

**Target ICP:**
${icp}

**Offer:**
${offer}

**Constraints:**
${constraints.length > 0 ? constraints.map((c, i) => `${i + 1}. ${c}`).join('\n') : 'None specified'}

Generate the following configuration in JSON format:

{
  "agent_name": "descriptive agent name",
  "system_prompt": "Complete system prompt for the voice AI agent including personality, objectives, and guidelines. Be thorough - this will be used directly.",
  "first_message": "The opening message the agent will use when starting a call",
  "language": "en-US",
  "voice_id": "EXAVITQu4vr4xnSDxMaL",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75,
    "style": 0.0,
    "use_speaker_boost": true
  },
  "call_settings": {
    "max_duration_seconds": 480,
    "silence_timeout_seconds": 10,
    "end_call_phrases": ["goodbye", "have a great day", "talk soon"]
  },
  "tools": [
    {
      "name": "book_meeting",
      "description": "Book a meeting with the prospect",
      "parameters": {
        "preferred_time": "string",
        "meeting_type": "string"
      }
    },
    {
      "name": "update_crm",
      "description": "Update the lead record in CRM",
      "parameters": {
        "status": "string",
        "notes": "string"
      }
    },
    {
      "name": "tag_lead",
      "description": "Add tags to the lead for segmentation",
      "parameters": {
        "tags": "array of strings"
      }
    }
  ],
  "objection_handlers": [
    {
      "objection": "common objection",
      "response": "recommended response"
    }
  ],
  "qualification_questions": [
    "question to qualify the lead"
  ],
  "compliance_notes": "Any compliance considerations based on constraints"
}

Make the system_prompt comprehensive and ready to use directly with Vapi or ElevenLabs.`;

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices?.[0]?.message?.content;

    if (!generatedContent) {
      throw new Error('No content generated from AI');
    }

    // Parse the JSON from AI response
    let agentConfig: any;
    try {
      const jsonMatch = generatedContent.match(/```json\n?([\s\S]*?)\n?```/) || 
                        generatedContent.match(/```\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : generatedContent;
      agentConfig = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', generatedContent);
      throw new Error('Failed to parse generated agent configuration');
    }

    // Determine provider based on settings
    const provider = voiceSettings?.vapi_private_key ? 'vapi' : 'elevenlabs';
    
    // Use configured voice ID if available
    const voiceId = voiceSettings?.default_elevenlabs_voice_id || agentConfig.voice_id || 'EXAVITQu4vr4xnSDxMaL';

    // Store the agent configuration as a content asset
    const { data: savedAgent, error: saveError } = await supabase
      .from('cmo_content_assets')
      .insert({
        workspace_id: workspaceId,
        title: agentConfig.agent_name || 'Voice Agent Configuration',
        content_type: 'voice_agent_config',
        channel: 'voice',
        key_message: agentConfig.system_prompt,
        supporting_points: [
          agentConfig.first_message,
          JSON.stringify(agentConfig.tools),
          JSON.stringify(agentConfig.objection_handlers),
        ],
        status: 'draft',
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save agent config:', saveError);
    }

    console.log(`Voice agent config created for workspace ${workspaceId}`);

    return new Response(JSON.stringify({
      provider,
      agent_config: {
        agentId: savedAgent?.id || null,
        agentName: agentConfig.agent_name,
        systemPrompt: agentConfig.system_prompt,
        firstMessage: agentConfig.first_message,
        language: agentConfig.language || 'en-US',
        voiceId,
        voiceSettings: agentConfig.voice_settings,
        callSettings: agentConfig.call_settings,
        tools: agentConfig.tools?.map((t: any) => t.name) || ['book_meeting', 'update_crm', 'tag_lead'],
        toolDefinitions: agentConfig.tools,
        objectionHandlers: agentConfig.objection_handlers,
        qualificationQuestions: agentConfig.qualification_questions,
        complianceNotes: agentConfig.compliance_notes,
      },
      stored_asset_id: savedAgent?.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Voice Agent Builder error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
