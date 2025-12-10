import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VoiceAgentRequest {
  tenantId: string;
  campaignId?: string;
  brandVoice: string;
  icp: string;
  offer: string;
  constraints?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: VoiceAgentRequest = await req.json();
    const { tenantId, campaignId, brandVoice, icp, offer, constraints = [] } = body;

    if (!tenantId || !brandVoice || !icp || !offer) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: tenantId, brandVoice, icp, offer" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify tenant access
    const { data: tenantAccess } = await supabase
      .from("user_tenants")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (!tenantAccess && user.id !== tenantId) {
      return new Response(
        JSON.stringify({ error: "Access denied to tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get workspace for tenant
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .or(`owner_id.eq.${tenantId},id.in.(select workspace_id from workspace_members where user_id = '${user.id}')`)
      .limit(1)
      .single();

    const workspaceId = workspace?.id || tenantId;

    // Fetch brand profile for context
    const { data: brandProfile } = await supabase
      .from("cmo_brand_profiles")
      .select("*")
      .eq("tenant_id", tenantId)
      .limit(1)
      .single();

    // Fetch voice settings
    const { data: voiceSettings } = await supabase
      .from("ai_settings_voice")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    // Build AI prompt for voice agent generation
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const brandContext = brandProfile ? `
Brand: ${brandProfile.brand_name}
Industry: ${brandProfile.industry || "Not specified"}
Value Proposition: ${brandProfile.unique_value_proposition || ""}
Brand Tone: ${brandProfile.brand_tone || brandVoice}
Messaging Pillars: ${JSON.stringify(brandProfile.messaging_pillars || [])}
` : `Brand Voice: ${brandVoice}`;

    const systemPrompt = `You are a Voice Agent Architect for AI-powered outbound calling systems.
Your task is to generate a complete voice agent configuration for VAPI/ElevenLabs.

${brandContext}

Generate a voice agent configuration that:
1. Matches the brand voice and tone
2. Addresses the target ICP's pain points and desires
3. Presents the offer naturally in conversation
4. Handles common objections gracefully
5. Respects all compliance constraints
6. Qualifies prospects effectively

Output JSON with this structure:
{
  "agent_name": "string - descriptive name for the agent",
  "system_prompt": "string - detailed system prompt for the AI voice agent",
  "first_message": "string - opening message when call connects",
  "voice_id": "string - recommended voice ID (alloy, echo, fable, onyx, nova, shimmer for OpenAI; or ElevenLabs voice ID)",
  "model": "string - gpt-4o-mini or gpt-4o",
  "tools": [
    {
      "name": "string",
      "description": "string",
      "parameters": {}
    }
  ],
  "objection_handlers": [
    {
      "objection": "string - the objection",
      "response": "string - recommended response"
    }
  ],
  "qualification_questions": [
    "string - questions to qualify the prospect"
  ],
  "compliance_statements": [
    "string - required compliance statements"
  ],
  "call_flow": {
    "opening": "string",
    "discovery": "string", 
    "pitch": "string",
    "handling_objections": "string",
    "closing": "string"
  }
}`;

    const userPrompt = `Create a voice agent for:

ICP (Ideal Customer Profile):
${icp}

Offer:
${offer}

Brand Voice: ${brandVoice}

Compliance Constraints:
${constraints.length > 0 ? constraints.map(c => `- ${c}`).join("\n") : "- Standard professional compliance"}

Generate a complete voice agent configuration optimized for high conversion while maintaining brand authenticity.`;

    console.log("Calling AI to generate voice agent configuration...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      return new Response(
        JSON.stringify({ error: "AI generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    
    let agentConfig;
    try {
      agentConfig = JSON.parse(content);
    } catch {
      // Try to extract JSON from markdown
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        agentConfig = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    console.log("Voice agent configuration generated:", agentConfig.agent_name);

    // Determine voice provider based on settings
    const voiceProvider = voiceSettings?.vapi_private_key ? "vapi" : 
                          voiceSettings?.elevenlabs_api_key ? "elevenlabs" : "vapi";

    // Store the voice agent configuration as a content asset
    const { data: voiceAsset, error: assetError } = await supabase
      .from("cmo_content_assets")
      .insert({
        tenant_id: tenantId,
        workspace_id: workspaceId,
        campaign_id: campaignId || null,
        title: agentConfig.agent_name || "AI Voice Agent",
        content_type: "voice_agent",
        channel: "voice",
        status: "draft",
        key_message: agentConfig.first_message,
        supporting_points: agentConfig.qualification_questions || [],
        tone: brandVoice,
        dependencies: {
          config: agentConfig,
          voice_provider: voiceProvider,
          voice_id: agentConfig.voice_id,
          model: agentConfig.model,
          system_prompt: agentConfig.system_prompt,
          tools: agentConfig.tools,
          objection_handlers: agentConfig.objection_handlers,
          compliance_statements: agentConfig.compliance_statements,
          call_flow: agentConfig.call_flow,
        },
      })
      .select()
      .single();

    if (assetError) {
      console.error("Error storing voice agent:", assetError);
      return new Response(
        JSON.stringify({ error: "Failed to store voice agent configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log agent run
    await supabase.from("agent_runs").insert({
      tenant_id: tenantId,
      workspace_id: workspaceId,
      agent: "cmo_voice_agent_builder",
      mode: "create",
      input: { brandVoice, icp, offer, constraints, campaignId },
      output: agentConfig,
      status: "completed",
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        voiceAgentId: voiceAsset.id,
        agentName: agentConfig.agent_name,
        voiceProvider,
        config: agentConfig,
        status: "created",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in ai-cmo-voice-agents:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
