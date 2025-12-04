import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const systemPrompt = `You are the UbiGrowth AI platform assistant - a friendly, knowledgeable guide helping users discover and use the marketing automation platform.

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
- Ask clarifying questions to understand what the user wants to accomplish
- Suggest specific features based on their goals
- Use emojis sparingly to be friendly
- If they ask about something outside the platform, gently guide them back
- When suggesting a feature, mention the navigation path (e.g., "Head to Video Studio in the left menu")
- If this is their first message, give a warm welcome and ask what they'd like to accomplish with marketing automation

## Response Format:
Keep responses short and actionable. End with a question or suggestion when appropriate.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, isFirstMessage } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("AI service is not configured");
    }

    // Build conversation with system prompt
    const conversationMessages = [
      { role: "system", content: systemPrompt },
      ...(isFirstMessage ? [] : messages),
    ];

    // If first message, add a starter prompt
    if (isFirstMessage) {
      conversationMessages.push({
        role: "user",
        content: "Hi! I'm new here and want to learn about this platform."
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
