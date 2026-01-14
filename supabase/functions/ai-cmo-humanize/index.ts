/**
 * AI CMO Humanize - De-robotizes AI-generated content
 * Makes text sound more natural and human-written
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { openaiChatCompletionsRaw } from "../_shared/providers/openai.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, tone = 'conversational', preserveKeywords, targetAudience } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip humanization for very short texts
    if (text.length < 20) {
      return new Response(
        JSON.stringify({ text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ text }), // Return original on config error
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

    const toneInstructions = {
      conversational: 'Use a natural, conversational tone like you are talking to a friend.',
      professional: 'Maintain professionalism while sounding approachable and human.',
      casual: 'Use casual, relaxed language with personality.',
      friendly: 'Be warm, welcoming, and personable.',
    };

    const systemPrompt = `You are an expert copywriter who specializes in making AI-generated content sound natural and human-written.

Your job is to rewrite the given text to:
1. Remove robotic or formulaic patterns
2. Add natural sentence variety and rhythm
3. Include conversational elements where appropriate
4. Use contractions naturally (don't → don't, cannot → can't)
5. Vary sentence length for better flow
6. Remove repetitive transitions like "Furthermore", "Moreover", "Additionally"
7. Make it feel like a real person wrote it

Tone: ${toneInstructions[tone as keyof typeof toneInstructions] || toneInstructions.conversational}
${targetAudience ? `Target Audience: ${targetAudience}` : ''}
${preserveKeywords?.length ? `Important: Preserve these keywords/phrases: ${preserveKeywords.join(', ')}` : ''}

Rules:
- Keep the same meaning and key information
- Maintain the original length (within 10%)
- Do not add new facts or claims
- Output ONLY the rewritten text, nothing else`;

    const response = await openaiChatCompletionsRaw(
      {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.7,
        max_tokens: Math.max(500, text.length * 2),
      },
      OPENAI_API_KEY,
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ text }), // Return original on API error
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const humanizedText = data.choices?.[0]?.message?.content?.trim();

    if (!humanizedText) {
      console.error('Empty response from AI gateway');
      return new Response(
        JSON.stringify({ text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Humanized ${text.length} chars → ${humanizedText.length} chars`);

    return new Response(
      JSON.stringify({ text: humanizedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Humanize error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
