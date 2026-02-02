import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VoiceAgentRequest {
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

    // Handle GET request - List voice agents
    if (req.method === "GET") {
      const url = new URL(req.url);
      const campaignId = url.searchParams.get("campaignId");

      const tenantId = user.user_metadata?.tenant_id || user.app_metadata?.tenant_id;
      if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "tenant_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build query for voice agents
      let query = supabase
        .from("cmo_content_assets")
        .select("id, title, dependencies")
        .eq("tenant_id", tenantId)
        .eq("content_type", "voice_agent");

      if (campaignId) {
        query = query.eq("campaign_id", campaignId);
      }

      const { data: voiceAgents, error: listError } = await query.order("created_at", { ascending: false });

      if (listError) {
        console.error("Error listing voice agents:", listError);
        return new Response(
          JSON.stringify({ error: "Failed to list voice agents" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Transform to expected response format
      const agents = (voiceAgents || []).map((agent: any) => ({
        id: agent.id,
        name: agent.title,
        provider: agent.dependencies?.provider || "vapi",
      }));

      return new Response(
        JSON.stringify(agents),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle POST request - Create voice agent
    const body: VoiceAgentRequest = await req.json();
    const { campaignId, brandVoice, icp, offer, constraints = [] } = body;
    const tenantId = user.user_metadata?.tenant_id || user.app_metadata?.tenant_id;

    if (!brandVoice || !icp || !offer) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: brandVoice, icp, offer" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "tenant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call kernel cmo_voice_agent_builder
    console.log("Calling kernel cmo_voice_agent_builder...");
    
    const kernelResponse = await fetch(`${supabaseUrl}/functions/v1/cmo-kernel`, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "voice-agent-builder",
        tenant_id: tenantId,
        payload: {
          brandVoice,
          icp,
          offer,
          constraints,
          campaignId,
        },
      }),
    });

    if (!kernelResponse.ok) {
      const errorText = await kernelResponse.text();
      console.error("Kernel error:", errorText);
      return new Response(
        JSON.stringify({ error: "Voice agent generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const kernelData = await kernelResponse.json();
    const { provider, agent_config } = kernelData;

    console.log("Kernel returned voice agent config:", { provider, agentName: agent_config?.agent_name });

    // Insert into voice_agents table (using cmo_content_assets as voice_agents container)
    const { data: voiceAgent, error: insertError } = await supabase
      .from("cmo_content_assets")
      .insert({
        tenant_id: tenantId,
        campaign_id: campaignId || null,
        title: agent_config.agent_name || "AI Voice Agent",
        content_type: "voice_agent",
        channel: "voice",
        status: "draft",
        key_message: agent_config.first_message,
        supporting_points: agent_config.qualification_questions || [],
        tone: brandVoice,
        dependencies: {
          provider,
          config: agent_config,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting voice agent:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to store voice agent" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Voice agent ${voiceAgent.id} created successfully`);

    return new Response(
      JSON.stringify({
        id: voiceAgent.id,
        provider,
        config: agent_config,
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
