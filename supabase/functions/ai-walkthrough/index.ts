import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

1. **Video Studio** (/video) - AI-powered video generation for marketing campaigns. Users describe what they want, and AI creates professional marketing videos.

2. **Email Studio** (/email) - Create and send personalized email campaigns with AI-generated content. Supports segmentation and performance tracking.

3. **Social Media Studio** (/social) - Schedule and publish content across multiple social platforms. AI optimizes posting times for maximum engagement.

4. **Voice Agents** (/voice-agents) - Deploy AI voice agents for outbound calls. Automate lead qualification and follow-ups with natural conversations.

5. **CRM & Lead Management** (/crm) - Track leads through your pipeline, manage deals, and let AI score and prioritize prospects. Features include:
   - Lead Pipeline with scoring
   - Deals management
   - Task management
   - Email sequences
   - Activity timeline
   - Predictive analytics

6. **Content Calendar** (/automation) - Plan and schedule all marketing content. Visualize campaigns and maintain consistent publishing.

7. **Asset Catalog** (/assets) - Browse and manage all your marketing assets (videos, emails, landing pages, voice agents).

8. **Reports** (/reports) - Comprehensive analytics and performance reports across all campaigns.

9. **Dashboard** (/dashboard) - Real-time performance tracking with ROI metrics, engagement data, and campaign overview.

## Your Behavior:
- Be concise but helpful (2-3 sentences max per response)
- Personalize suggestions based on their industry (${ctx.industry || "their business"}) and target segments
- Ask clarifying questions to understand what the user wants to accomplish
- Suggest specific features based on their goals
- Use emojis sparingly to be friendly
- If they ask about something outside the platform, gently guide them back
- When suggesting a feature, mention the navigation path (e.g., "Head to Video Studio in the left menu")
- Reference their ICP segments when discussing targeting or campaigns
- If this is their first message, give a warm welcome personalized to their business

## Response Format:
Keep responses short and actionable. End with a question or suggestion when appropriate.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, isFirstMessage, workspaceId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("AI service is not configured");
    }

    // Fetch tenant context
    let tenantContext: TenantContext = {
      businessName: "your business",
      industry: "your industry",
      icpSegments: [],
      leadCount: 0,
      campaignCount: 0,
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (authHeader) {
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user } } = await supabaseClient.auth.getUser();
      
      if (user) {
        // Get workspace ID if not provided
        let wsId = workspaceId;
        if (!wsId) {
          const { data: workspace } = await supabaseClient
            .from("workspaces")
            .select("id")
            .eq("owner_id", user.id)
            .maybeSingle();
          wsId = workspace?.id;
        }

        if (wsId) {
          // Fetch business profile
          const { data: profile } = await supabaseClient
            .from("business_profiles")
            .select("business_name, industry")
            .eq("workspace_id", wsId)
            .maybeSingle();

          if (profile) {
            tenantContext.businessName = profile.business_name || tenantContext.businessName;
            tenantContext.industry = profile.industry || tenantContext.industry;
          }

          // Fetch ICP segments
          const { data: segments } = await supabaseClient
            .from("cmo_icp_segments")
            .select("segment_name")
            .eq("workspace_id", wsId)
            .limit(5);

          if (segments) {
            tenantContext.icpSegments = segments
              .map((s) => s.segment_name)
              .filter(Boolean) as string[];
          }

          // Fetch lead count
          const { count: leadCount } = await supabaseClient
            .from("crm_leads")
            .select("*", { count: "exact", head: true })
            .eq("workspace_id", wsId);

          tenantContext.leadCount = leadCount || 0;

          // Fetch campaign count
          const { count: campaignCount } = await supabaseClient
            .from("cmo_campaigns")
            .select("*", { count: "exact", head: true })
            .eq("workspace_id", wsId);

          tenantContext.campaignCount = campaignCount || 0;
        }
      }
    }

    console.log(`[ai-walkthrough] Context: ${tenantContext.businessName}, ${tenantContext.industry}, segments: ${tenantContext.icpSegments.length}`);

    // Build conversation with tenant-aware system prompt
    const conversationMessages = [
      { role: "system", content: buildSystemPrompt(tenantContext) },
      ...(isFirstMessage ? [] : messages),
    ];

    // If first message, add a personalized starter prompt
    if (isFirstMessage) {
      conversationMessages.push({
        role: "user",
        content: `Hi! I'm exploring the platform${tenantContext.businessName !== "your business" ? ` for ${tenantContext.businessName}` : ""}. What can you help me with?`,
      });
    }

    console.log(`[ai-walkthrough] Processing ${messages?.length || 0} messages, isFirst: ${isFirstMessage}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: conversationMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "I'm getting a lot of questions right now. Please try again in a moment!" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please contact support." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Unable to connect to AI service" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("ai-walkthrough error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
