import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an Outbound Message Generator for AI CMO. Generate hyper-personalized, concise outbound messages that cut through noise. No fluff, no buzzwords, no corporate speak.

## Output Format
Return ONLY valid JSON:
{
  "message_text": "string - the actual message",
  "subject_line": "string - only for email channel, max 50 chars",
  "variant_tag": "A|B|C",
  "reasoning_summary": "string - brief explanation of approach"
}

## Step Type Guidelines
- connect: Hook with specific signal, brief value, soft CTA
- follow_up: Reference previous, new angle, more direct CTA
- bump: Very short (2-3 sentences), acknowledge busy, direct question
- nudge: Ultra short, pattern interrupt okay
- booking: Clear calendar mention, specific time, remove friction

## Channel Guidelines
- LinkedIn: Max 300 chars for connection, conversational, first name only
- Email: Subject max 50 chars, body 3-5 sentences max

## Rules
1. Start with their name, never "Hi" or "Hey there"
2. Reference specific signal in first sentence
3. No buzzwords: "synergy", "leverage", "unlock", "game-changer", "revolutionary"
4. No fake urgency or scarcity
5. Sound like a peer, not a salesperson
6. CTA must be low-commitment
7. Match length_preference strictly`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { 
      tenant_id, 
      workspace_id, 
      prospect_profile, 
      prospect_insights,
      step_context,
      brand_voice,
      call_to_action,
      sequence_id,
      step_id
    } = await req.json();

    if (!tenant_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "tenant_id and workspace_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log agent run
    const { data: runData, error: runError } = await supabase
      .from("agent_runs")
      .insert({
        tenant_id,
        workspace_id,
        agent: "message_gen",
        mode: "outbound",
        status: "running",
        input: { prospect_profile, prospect_insights, step_context, brand_voice, call_to_action },
      })
      .select("id")
      .single();

    if (runError) {
      console.error("Failed to log agent run:", runError);
    }

    const runId = runData?.id;

    // Build prompt
    const userPrompt = `Generate an outbound message for this prospect:

PROSPECT PROFILE:
${JSON.stringify(prospect_profile, null, 2)}

PROSPECT INSIGHTS:
${JSON.stringify(prospect_insights, null, 2)}

STEP CONTEXT:
- Step Type: ${step_context?.step_type || 'connect'}
- Channel: ${step_context?.channel || 'linkedin'}
- Sequence Position: ${step_context?.sequence_position || 1}

BRAND VOICE:
${JSON.stringify(brand_voice, null, 2)}

CALL TO ACTION:
${call_to_action || 'open to a quick chat?'}

Generate a personalized message that references their specific situation. Return valid JSON.`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      if (runId) {
        await supabase.from("agent_runs").update({
          status: "failed",
          error_message: `AI error: ${aiResponse.status}`,
          completed_at: new Date().toISOString(),
        }).eq("id", runId);
      }

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let messageOutput;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      messageOutput = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      messageOutput = { message_text: content, variant_tag: "A", reasoning_summary: "Raw response" };
    }

    // Store message template in sequence step if step_id provided
    if (step_id && messageOutput?.message_text) {
      const { error: stepError } = await supabase
        .from("outbound_sequence_steps")
        .update({
          message_template: messageOutput.message_text,
          metadata: {
            variant_tag: messageOutput.variant_tag,
            reasoning: messageOutput.reasoning_summary,
            subject_line: messageOutput.subject_line,
            generated_at: new Date().toISOString(),
          },
        })
        .eq("id", step_id);

      if (stepError) {
        console.error("Failed to save message template:", stepError);
      }
    }

    // Update agent run
    if (runId) {
      await supabase.from("agent_runs").update({
        status: "completed",
        output: messageOutput,
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
    }

    return new Response(JSON.stringify({
      success: true,
      agent: "message_gen",
      mode: "outbound",
      run_id: runId,
      data: messageOutput,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("message-gen error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
