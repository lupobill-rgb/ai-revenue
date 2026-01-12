import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { runLLM, type LLMMessage } from "../_shared/llmRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AppContext {
  businessName: string | null;
  industry: string | null;
  currentRoute: string;
  leadCount: number;
  campaignCount: number;
  modulesEnabled: string[];
  icpSegments?: string[];
  workspaceId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, context }: { messages: ChatMessage[]; context?: AppContext } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    console.log(`[ai-chat] Request received - validating auth`);
    
    let businessName = context?.businessName || "your business";
    let industry = context?.industry || "your industry";
    let leadCount = context?.leadCount || 0;
    let campaignCount = context?.campaignCount || 0;
    let currentRoute = context?.currentRoute || "/dashboard";
    let modulesEnabled = context?.modulesEnabled || [];
    let icpSegments: string[] = context?.icpSegments || [];
    let workspaceId = context?.workspaceId;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("[ai-chat] Authentication failed", authError);
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (workspaceId) {
      const { data: workspace, error: workspaceError } = await supabaseClient
        .from("workspaces")
        .select("id, owner_id")
        .eq("id", workspaceId)
        .maybeSingle();

      if (workspaceError) {
        console.error("[ai-chat] Workspace lookup error:", workspaceError);
      }

      let hasAccess = workspace && workspace.owner_id === user.id;

      if (!hasAccess) {
        const { data: membership, error: membershipError } = await supabaseClient
          .from("workspace_members")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (membership) {
          hasAccess = true;
        }

        if (membershipError) {
          console.error("[ai-chat] Workspace membership lookup error:", membershipError);
        }
      }

      if (!hasAccess) {
        return new Response(
          JSON.stringify({ error: "Forbidden: workspace access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get workspace ID if not provided (but skip since we have no user now)
    if (false) {  // Disabled - no auth
      const { data: workspace, error: wsError } = await supabaseClient
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      
      if (wsError) {
        console.error("[ai-chat] Workspace lookup error:", wsError.message);
      }
      
      workspaceId = workspace?.id;
      console.log(`[ai-chat] Workspace lookup result: ${workspaceId || 'none found'}`);
    }

    if (workspaceId) {
      console.log(`[ai-chat] Using workspace context: ${workspaceId}`);
    } else {
      console.log(`[ai-chat] No workspace - using generic context`);
    }

    if (workspaceId) {

      // Fetch business profile by workspace
      const { data: profile } = await supabaseClient
        .from("business_profiles")
        .select("business_name, industry")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      
      if (profile) {
        businessName = profile.business_name || businessName;
        industry = profile.industry || industry;
      }

      // Fetch ICP segments
      if (icpSegments.length === 0) {
        const { data: segments } = await supabaseClient
          .from("cmo_icp_segments")
          .select("segment_name")
          .eq("workspace_id", workspaceId)
          .limit(5);

        if (segments) {
          icpSegments = segments
            .map((s) => s.segment_name)
            .filter(Boolean) as string[];
        }
      }

      // Get counts scoped to workspace
      const { count: leads } = await supabaseClient
        .from("crm_leads")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);
      
      const { count: campaigns } = await supabaseClient
        .from("cmo_campaigns")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);

      leadCount = leads || 0;
      campaignCount = campaigns || 0;
    }

    console.log(`[ai-chat] Context: ${businessName}, ${industry}, segments: ${icpSegments.length}, leads: ${leadCount}`);

    // Build context-aware system prompt with ICP segments
    const systemPrompt = `You are the UbiGrowth AI Assistant, an expert marketing automation assistant for ${businessName}.

ACCOUNT CONTEXT:
- Business: ${businessName}
- Industry: ${industry}
- Target Segments: ${icpSegments.length > 0 ? icpSegments.join(", ") : "Not defined yet"}
- Current leads: ${leadCount}
- Active campaigns: ${campaignCount}
- Current page: ${currentRoute}
- Enabled modules: ${modulesEnabled.length > 0 ? modulesEnabled.join(", ") : "All standard modules"}

YOUR CAPABILITIES:
1. Answer questions about the user's account and data
2. Help create marketing campaigns (email, social, voice, landing pages)
3. Provide industry-specific marketing advice for ${industry}
4. Guide users through the platform features
5. Suggest optimizations based on their current setup
6. Recommend strategies targeting their ICP segments: ${icpSegments.join(", ") || "their audience"}

RESPONSE GUIDELINES:
- Be concise and direct. Avoid filler phrases.
- When asked about account data (industry, business name, leads, campaigns, segments), use the context above.
- Personalize recommendations for ${businessName} and ${industry}.
- Reference their target segments (${icpSegments.join(", ") || "their audience"}) when discussing campaigns or content.
- Use clear, professional language without markdown formatting.
- If asked about a feature, explain how to access it in the current UI.

When the user asks "What is my industry?" respond with: "${industry}".
When the user asks about their segments, mention: ${icpSegments.length > 0 ? icpSegments.join(", ") : "No segments defined yet - recommend they set up ICP segments in CMO → Brand Setup"}.
When asked about leads or campaigns, reference the actual counts provided.`;

    const llmMessages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    console.log("[ai-chat] Calling LLM router (stream)");

    const tenantId = workspaceId || user.id;
    const out = await runLLM({
      tenantId,
      capability: "ai.chat",
      messages: llmMessages,
      temperature: 0.7,
      maxTokens: 2048,
      stream: true,
      timeoutMs: 25_000,
    });

    if (out.kind !== "stream") {
      return new Response(
        JSON.stringify({ error: "AI service error: expected stream response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pass-through provider stream to client.
    return new Response(out.response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "x-llm-provider": out.provider,
        "x-llm-model": out.model,
      },
    });

  } catch (error) {
    console.error("Error in ai-chat:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
