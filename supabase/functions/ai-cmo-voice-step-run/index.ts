import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

interface VoiceStepRequest {
  tenantId: string;
  campaignId: string;
  leadId: string;
  voiceAgentId: string;
  scriptTemplate: string;
  stepId: string;
}

interface CallResult {
  status: "completed" | "no_answer" | "voicemail" | "busy" | "failed";
  transcript?: string;
  outcome?: "booked" | "no_answer" | "voicemail" | "not_interested" | "callback" | "qualified";
  duration_seconds?: number;
  recording_url?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Allow internal calls with secret or authenticated users
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    const authHeader = req.headers.get("Authorization");

    let isAuthorized = false;

    if (internalSecret && expectedSecret && internalSecret === expectedSecret) {
      isAuthorized = true;
    } else if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) isAuthorized = true;
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: VoiceStepRequest = await req.json();
    const { tenantId, campaignId, leadId, voiceAgentId, scriptTemplate, stepId } = body;

    if (!tenantId || !leadId || !voiceAgentId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: tenantId, leadId, voiceAgentId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Running voice step ${stepId} for lead ${leadId}`);

    // Fetch lead context
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      console.error("Lead not found:", leadError);
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch voice agent configuration
    const { data: voiceAgent, error: agentError } = await supabase
      .from("cmo_content_assets")
      .select("*")
      .eq("id", voiceAgentId)
      .eq("content_type", "voice_agent")
      .single();

    if (agentError || !voiceAgent) {
      console.error("Voice agent not found:", agentError);
      return new Response(
        JSON.stringify({ error: "Voice agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch lead history for context
    const { data: leadHistory } = await supabase
      .from("lead_activities")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Personalize script template
    const personalizedScript = personalizeScript(scriptTemplate, lead, leadHistory || []);

    // Get voice settings for provider credentials
    const { data: voiceSettings } = await supabase
      .from("ai_settings_voice")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    const agentConfig = voiceAgent.dependencies?.config || {};
    const provider = voiceAgent.dependencies?.provider || "vapi";

    // Execute call based on provider
    let callResult: CallResult;

    if (provider === "vapi") {
      callResult = await executeVapiCall(
        lead,
        personalizedScript,
        agentConfig,
        voiceSettings
      );
    } else if (provider === "elevenlabs") {
      callResult = await executeElevenLabsCall(
        lead,
        personalizedScript,
        agentConfig,
        voiceSettings
      );
    } else {
      // Default to VAPI
      callResult = await executeVapiCall(
        lead,
        personalizedScript,
        agentConfig,
        voiceSettings
      );
    }

    console.log(`Call result for lead ${leadId}:`, callResult);

    // Insert into call_logs
    const { data: callLog, error: logError } = await supabase
      .from("lead_activities")
      .insert({
        lead_id: leadId,
        activity_type: "voice_call",
        description: `AI voice call - ${callResult.outcome || callResult.status}`,
        metadata: {
          campaign_id: campaignId,
          voice_agent_id: voiceAgentId,
          step_id: stepId,
          status: callResult.status,
          outcome: callResult.outcome,
          duration_seconds: callResult.duration_seconds,
          transcript: callResult.transcript,
          recording_url: callResult.recording_url,
          provider,
        },
      })
      .select()
      .single();

    if (logError) {
      console.error("Error logging call:", logError);
    }

    // Update lead status based on outcome
    const leadUpdates = getLeadUpdates(callResult);
    if (Object.keys(leadUpdates).length > 0) {
      const { error: updateError } = await supabase
        .from("leads")
        .update(leadUpdates)
        .eq("id", leadId);

      if (updateError) {
        console.error("Error updating lead:", updateError);
      }
    }

    // Determine next action for automation engine
    const stepResult = {
      stepId,
      leadId,
      campaignId,
      status: callResult.status,
      outcome: callResult.outcome,
      shouldContinue: callResult.outcome !== "not_interested",
      nextStepDelay: getNextStepDelay(callResult),
      callLogId: callLog?.id,
    };

    console.log(`Voice step ${stepId} completed with result:`, stepResult);

    return new Response(
      JSON.stringify(stepResult),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in ai-cmo-voice-step-run:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function personalizeScript(template: string, lead: any, history: any[]): string {
  let script = template;

  // Replace lead placeholders
  const replacements: Record<string, string> = {
    "{{first_name}}": lead.first_name || "there",
    "{{last_name}}": lead.last_name || "",
    "{{full_name}}": `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "there",
    "{{company}}": lead.company || "your company",
    "{{email}}": lead.email || "",
    "{{phone}}": lead.phone || "",
    "{{job_title}}": lead.job_title || "",
    "{{source}}": lead.source || "",
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    script = script.replace(new RegExp(placeholder, "gi"), value);
  }

  // Add context from history if relevant
  const recentActivity = history[0];
  if (recentActivity) {
    script = script.replace(
      "{{last_interaction}}",
      recentActivity.description || "our previous conversation"
    );
  }

  return script;
}

async function executeVapiCall(
  lead: any,
  script: string,
  agentConfig: any,
  voiceSettings: any
): Promise<CallResult> {
  const vapiKey = voiceSettings?.vapi_private_key || Deno.env.get("VAPI_PRIVATE_KEY");

  if (!vapiKey) {
    console.error("VAPI private key not configured");
    return { status: "failed", outcome: "no_answer" };
  }

  if (!lead.phone) {
    console.error("Lead has no phone number");
    return { status: "failed", outcome: "no_answer" };
  }

  try {
    // Create outbound call via VAPI
    const response = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${vapiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumberId: voiceSettings?.default_vapi_phone_id,
        customer: {
          number: lead.phone,
          name: `${lead.first_name || ""} ${lead.last_name || ""}`.trim(),
        },
        assistant: {
          model: {
            provider: "openai",
            model: agentConfig.model || "gpt-4o-mini",
          },
          voice: {
            provider: "openai",
            voiceId: agentConfig.voice_id || "alloy",
          },
          firstMessage: agentConfig.first_message || script,
          transcriber: {
            provider: "deepgram",
            model: "nova-2",
            language: "en",
          },
          ...(agentConfig.system_prompt && { systemPrompt: agentConfig.system_prompt }),
        },
        maxDurationSeconds: agentConfig.max_duration || 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("VAPI call failed:", errorText);
      return { status: "failed", outcome: "no_answer" };
    }

    const callData = await response.json();
    console.log("VAPI call initiated:", callData.id);

    // For now, return pending - real implementation would poll or use webhooks
    // In production, use VAPI webhooks to get actual results
    return {
      status: "completed",
      outcome: "callback", // Default until webhook updates
      duration_seconds: 0,
      transcript: "",
    };

  } catch (error) {
    console.error("VAPI call error:", error);
    return { status: "failed", outcome: "no_answer" };
  }
}

async function executeElevenLabsCall(
  lead: any,
  script: string,
  agentConfig: any,
  voiceSettings: any
): Promise<CallResult> {
  const elevenLabsKey = voiceSettings?.elevenlabs_api_key || Deno.env.get("ELEVENLABS_API_KEY");

  if (!elevenLabsKey) {
    console.error("ElevenLabs API key not configured");
    return { status: "failed", outcome: "no_answer" };
  }

  if (!lead.phone) {
    console.error("Lead has no phone number");
    return { status: "failed", outcome: "no_answer" };
  }

  try {
    // ElevenLabs conversational AI phone call
    // Note: ElevenLabs telephony integration requires additional setup
    const response = await fetch("https://api.elevenlabs.io/v1/convai/conversation", {
      method: "POST",
      headers: {
        "xi-api-key": elevenLabsKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentConfig.agent_id,
        phone_number: lead.phone,
        first_message: agentConfig.first_message || script,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs call failed:", errorText);
      return { status: "failed", outcome: "no_answer" };
    }

    const callData = await response.json();
    console.log("ElevenLabs call initiated:", callData.conversation_id);

    return {
      status: "completed",
      outcome: "callback",
      duration_seconds: 0,
      transcript: "",
    };

  } catch (error) {
    console.error("ElevenLabs call error:", error);
    return { status: "failed", outcome: "no_answer" };
  }
}

function getLeadUpdates(result: CallResult): Record<string, any> {
  const updates: Record<string, any> = {};

  switch (result.outcome) {
    case "booked":
      updates.status = "qualified";
      updates.score = 90;
      break;
    case "qualified":
      updates.status = "qualified";
      updates.score = 75;
      break;
    case "callback":
      updates.status = "contacted";
      updates.score = 50;
      break;
    case "not_interested":
      updates.status = "lost";
      updates.score = 10;
      break;
    case "voicemail":
    case "no_answer":
      // Keep current status, maybe schedule retry
      break;
  }

  return updates;
}

function getNextStepDelay(result: CallResult): number {
  // Return delay in seconds before next step
  switch (result.outcome) {
    case "booked":
      return 0; // Immediate next step (e.g., send confirmation)
    case "callback":
      return 86400; // 24 hours
    case "voicemail":
      return 172800; // 48 hours
    case "no_answer":
      return 86400; // 24 hours
    case "not_interested":
      return -1; // Stop sequence
    default:
      return 86400; // Default 24 hours
  }
}
