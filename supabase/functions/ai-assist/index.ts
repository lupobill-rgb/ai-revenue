import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { runLLM } from "../_shared/llmRouter.ts";

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

    const out = await runLLM({
      tenantId: "public",
      capability: "ai.assist",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 600,
      timeoutMs: 20_000,
    });

    if (out.kind !== "text") throw new Error("Unexpected streaming response");

    const generatedSuggestion = out.text;

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
