/**
 * AI CMO Humanize - De-robotizes AI-generated content
 * Uses shared CMO prompts for consistency
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAgentConfig, buildTenantPrompt } from "../_shared/cmo-prompts.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, tone = 'conversational', preserveKeywords, targetAudience, brand_voice } = await req.json();

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ text }), // Return original on config error
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get agent config from shared prompts
    const agentConfig = getAgentConfig('content_humanizer');
    
    // Build system prompt with tenant context and tone modifiers
    let systemPrompt = buildTenantPrompt('content_humanizer', { brand_voice });
    
    // Add tone-specific instructions
    const toneInstructions: Record<string, string> = {
      conversational: 'Use a natural, conversational tone like talking to a friend.',
      professional: 'Maintain professionalism while sounding approachable.',
      casual: 'Use casual, relaxed language with personality.',
      friendly: 'Be warm, welcoming, and personable.',
    };
    
    systemPrompt += `\n\nTone: ${toneInstructions[tone] || toneInstructions.conversational}`;
    if (targetAudience) systemPrompt += `\nTarget Audience: ${targetAudience}`;
    if (preserveKeywords?.length) systemPrompt += `\nPreserve keywords: ${preserveKeywords.join(', ')}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: agentConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: agentConfig.temperature,
        max_tokens: Math.max(agentConfig.maxTokens, text.length * 2),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Content Humanizer] AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ text }), // Return original on API error
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const humanizedText = data.choices?.[0]?.message?.content?.trim();

    if (!humanizedText) {
      console.error('[Content Humanizer] Empty response from AI gateway');
      return new Response(
        JSON.stringify({ text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Content Humanizer] ${text.length} chars → ${humanizedText.length} chars`);

    return new Response(
      JSON.stringify({ 
        text: humanizedText,
        changes_made: [],
        confidence_score: 0.85
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Content Humanizer] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
