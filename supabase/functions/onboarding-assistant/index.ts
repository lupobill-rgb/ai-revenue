import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    console.log(`[onboarding] Auth header present: ${!!authHeader}`);
    
    if (!authHeader) {
      console.error("[onboarding] FAIL: No Authorization header");
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is authenticated
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError) {
      console.error("[onboarding] Auth error:", authError.message);
    }
    
    if (!user) {
      console.error("[onboarding] FAIL: No user from getUser()");
      return new Response(
        JSON.stringify({ 
          error: "Authentication failed",
          details: authError?.message || "No user found"
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[onboarding] User authenticated: ${user.id}`);

    const { messages, userName } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    
    if (!GEMINI_API_KEY) {
      console.error("FATAL: GEMINI_API_KEY environment variable not set");
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a friendly AI onboarding assistant for UbiGrowth AI, an AI-powered marketing automation platform. 

Your role is to warmly greet ${userName || 'the user'} and guide them through getting started with the platform in a conversational way.

Key features to mention naturally during the conversation:
1. AI-powered campaign creation - Create multi-channel marketing campaigns in seconds
2. Content approval workflow - Review and approve AI-generated content before publishing
3. Multi-channel deployment - Deploy to email, social media, and voice channels
4. CRM & lead management - Track and nurture leads through the pipeline
5. Analytics & reporting - Monitor campaign performance in real-time

Guidelines:
- Be warm, friendly, and encouraging
- Keep responses concise (2-3 sentences max)
- Ask one question at a time to understand their needs
- Personalize suggestions based on their responses
- If they mention specific goals (lead generation, brand awareness, etc.), tailor your guidance
- End conversations by encouraging them to explore specific features

Start by greeting ${userName || 'them'} warmly and asking what brings them to UbiGrowth AI today.`;

    // Convert to Gemini format
    const geminiContents = [
      { role: "user", parts: [{ text: systemPrompt }] }
    ];
    
    for (const msg of messages) {
      geminiContents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }]
      });
    }

    console.log("[onboarding] Calling Gemini API");

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: geminiContents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("[onboarding] Gemini API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error: " + errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Onboarding assistant error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
