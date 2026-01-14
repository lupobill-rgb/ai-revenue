import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { LLMMessage } from "../_shared/llmRouter.ts";
import { openaiChatStream } from "../_shared/providers/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface TenantContext {
  businessName: string;
  industry: string;
  icpSegments: string[];
  leadCount: number;
  campaignCount: number;
}

const buildSystemPrompt = (ctx: TenantContext) => `You are an AI platform assistant for ${ctx.businessName || "this business"} - a friendly, knowledgeable guide helping users discover and use the marketing automation platform.

## Account Context:
- Business: ${ctx.businessName || "Not configured"}
- Industry: ${ctx.industry || "Not specified"}
- Target Segments: ${ctx.icpSegments.length > 0 ? ctx.icpSegments.join(", ") : "Not defined yet"}
- Current Leads: ${ctx.leadCount}
- Active Campaigns: ${ctx.campaignCount}

## Platform Features You Can Guide Users Through:

1. **Video Studio** (/video) - AI-powered video generation for marketing campaigns
2. **Email Studio** (/email) - Create and send personalized email campaigns
3. **Social Media Studio** (/social) - Schedule and publish content across platforms
4. **Voice Agents** (/voice-agents) - Deploy AI voice agents for outbound calls
5. **CRM & Lead Management** (/crm) - Track leads, manage deals, AI scoring
6. **Content Calendar** (/automation) - Plan and schedule marketing content
7. **Asset Catalog** (/assets) - Browse all marketing assets
8. **Reports** (/reports) - Analytics and performance reports
9. **Dashboard** (/dashboard) - Real-time performance tracking

## Your Behavior:
- Be concise but helpful (2-3 sentences max per response)
- Personalize suggestions based on their industry (${ctx.industry || "their business"}) and target segments
- Ask clarifying questions to understand goals
- Suggest specific features based on their needs
- Use emojis sparingly to be friendly
- When suggesting a feature, mention the navigation path
- Reference their ICP segments when discussing targeting
- If this is their first message, give a warm welcome personalized to their business

## Response Format:
Keep responses short and actionable. End with a question or suggestion when appropriate.`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[ai-walkthrough-direct] OPTIONS preflight received");
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    console.log("[ai-walkthrough-direct] Request received");

    // Check OPENAI_API_KEY
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    const { messages, isFirstMessage, workspaceId } = await req.json();

    // Fetch tenant context (optional - works without auth)
    let tenantContext: TenantContext = {
      businessName: "your business",
      industry: "your industry",
      icpSegments: [],
      leadCount: 0,
      campaignCount: 0,
    };

    // Try to fetch context if workspaceId provided
    if (workspaceId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

      // Fetch business profile
      const { data: profile } = await supabaseClient
        .from("business_profiles")
        .select("business_name, industry")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (profile) {
        tenantContext.businessName = profile.business_name || tenantContext.businessName;
        tenantContext.industry = profile.industry || tenantContext.industry;
      }

      // Fetch ICP segments
      const { data: segments } = await supabaseClient
        .from("cmo_icp_segments")
        .select("segment_name")
        .eq("workspace_id", workspaceId)
        .limit(5);

      if (segments) {
        tenantContext.icpSegments = segments
          .map((s: any) => s.segment_name)
          .filter(Boolean) as string[];
      }

      // Fetch counts
      const { count: leadCount } = await supabaseClient
        .from("crm_leads")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);

      const { count: campaignCount } = await supabaseClient
        .from("cmo_campaigns")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);

      tenantContext.leadCount = leadCount || 0;
      tenantContext.campaignCount = campaignCount || 0;
    }

    console.log("[ai-walkthrough-direct] Context loaded, calling OpenAI...");

    const systemPrompt = buildSystemPrompt(tenantContext);

    // Vendor fetch moved into `_shared/providers/*` for router-guard compliance.
    const response = await openaiChatStream({
      apiKey: OPENAI_API_KEY,
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...(messages as Message[])] as unknown as LLMMessage[],
      temperature: 0.7,
      maxTokens: 500, // Shorter responses for walkthrough
      timeoutMs: 55_000,
    });

    console.log("[ai-walkthrough-direct] Streaming response from OpenAI");

    // Pass through the stream with CORS headers
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
      },
    });

  } catch (error) {
    console.error("[ai-walkthrough-direct] Error:", error);
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
