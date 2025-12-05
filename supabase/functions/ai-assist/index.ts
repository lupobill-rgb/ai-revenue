import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AssistRequest {
  context: string;
  userPrompt: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { context, userPrompt }: AssistRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Context-specific system prompts - Dynamic based on user's business
    const contextPrompts: Record<string, string> = {
      'campaign-goal': 'You are an expert marketing strategist. Help users define clear, actionable campaign goals that drive measurable business results. Be specific and results-oriented. Keep responses under 50 words. Write in plain text without markdown formatting.',
      'subject-line': 'You are an expert email copywriter. Create compelling subject lines that drive opens and emphasize value. Use proven techniques like urgency, curiosity, and personalization. Provide 3 options. Write in plain text without markdown formatting.',
      'social-caption': 'You are a social media expert. Write engaging captions optimized for social platforms that showcase value and build engagement. Include relevant industry hashtags. Keep it conversational. Write in plain text without markdown formatting.',
      'video-script': 'You are a video marketing expert. Create engaging video scripts with a strong hook, clear message, and compelling call-to-action. Structure with sections. Write in plain text without markdown formatting.',
      'content-optimization': 'You are a content optimization expert. Analyze the content and suggest improvements for clarity, engagement, and conversion. Be specific and actionable. Write in plain text without markdown formatting.',
      'audience-targeting': 'You are an audience targeting expert. Suggest specific audience segments and targeting criteria based on the campaign goal and industry vertical. Write in plain text without markdown formatting.',
    };

    const systemPrompt = contextPrompts[context] || 'You are a helpful AI marketing assistant. Provide clear, actionable suggestions that drive business results. Write in plain text without markdown formatting.';

    // Call Lovable AI
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
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const generatedSuggestion = aiData.choices[0].message.content;

    // Function to clean up markdown and special characters
    const cleanContent = (text: string): string => {
      return text
        // Remove markdown bold
        .replace(/\*\*/g, '')
        // Remove markdown italic
        .replace(/\*/g, '')
        .replace(/_/g, '')
        // Remove markdown headers
        .replace(/^#+\s+/gm, '')
        // Remove markdown links but keep the text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove other special markdown characters but preserve basic punctuation
        .replace(/[`~]/g, '')
        // Clean up multiple spaces
        .replace(/  +/g, ' ')
        // Clean up multiple newlines (keep max 2)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };

    const suggestion = cleanContent(generatedSuggestion);

    return new Response(
      JSON.stringify({
        success: true,
        suggestion,
        context
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in ai-assist:", error);
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
