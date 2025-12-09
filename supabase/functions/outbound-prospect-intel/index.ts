import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a B2B Prospect Intelligence Analyst. Analyze prospect profiles, detect buying signals, and score prospects for outbound prioritization.

## Output Format
Return ONLY valid JSON with this structure:
{
  "enriched_profile": {
    "seniority_level": "VP|Director|Manager|IC",
    "decision_maker": boolean,
    "budget_authority_likely": boolean,
    "department": "Sales|Marketing|Engineering|...",
    "company_size_estimate": "1-10|11-50|51-200|201-1000|1000+",
    "icp_fit_score": 0-100
  },
  "buying_signals": [
    {
      "signal_type": "job_change|company_funding|tech_adoption|expansion|content_engagement|hiring",
      "description": "string",
      "strength": 1-100,
      "recency": "recent|medium|stale"
    }
  ],
  "priority_score": {
    "score": 0-100,
    "band": "hot|warm|cold",
    "rationale": "string"
  },
  "personalization_hooks": ["string"],
  "recommended_approach": {
    "channel": "linkedin|email|multi",
    "timing": "immediate|this_week|nurture",
    "message_angle": "efficiency|growth|competitive|risk"
  }
}

## Scoring Rules
- ICP Fit: Title match +30, Industry match +25, Company size +25, Department +20
- Hot (80-100): Strong ICP + recent signal. Warm (50-79): Good fit OR signal. Cold (0-49): Low fit.
- Job change signals: 80-90 strength. Funding: 85-95. Hiring: 70-80. Content: 50-70.`;

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

    const { tenant_id, workspace_id, prospect, brand_context, prospect_id } = await req.json();

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
        agent: "prospect_intel",
        mode: "outbound",
        status: "running",
        input: { prospect, brand_context, prospect_id },
      })
      .select("id")
      .single();

    if (runError) {
      console.error("Failed to log agent run:", runError);
    }

    const runId = runData?.id;

    // Build prompt
    const userPrompt = `Analyze this prospect and provide intelligence:

PROSPECT:
${JSON.stringify(prospect, null, 2)}

BRAND CONTEXT:
${JSON.stringify(brand_context, null, 2)}

Return your analysis as valid JSON.`;

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
    let intelligence;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      intelligence = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      intelligence = { raw_response: content };
    }

    // Store prospect score if we have a prospect_id
    if (prospect_id && intelligence?.priority_score) {
      const { error: scoreError } = await supabase.from("prospect_scores").upsert({
        tenant_id,
        prospect_id,
        score: intelligence.priority_score.score,
        band: intelligence.priority_score.band,
        rationale: intelligence.priority_score.rationale,
        last_scored_at: new Date().toISOString(),
      }, { onConflict: "prospect_id" });

      if (scoreError) {
        console.error("Failed to save prospect score:", scoreError);
      }
    }

    // Store buying signals if we have a prospect_id
    if (prospect_id && intelligence?.buying_signals?.length > 0) {
      const signals = intelligence.buying_signals.map((s: any) => ({
        tenant_id,
        prospect_id,
        source: "ai_analysis",
        signal_type: s.signal_type,
        signal_data: s,
        signal_strength: s.strength,
        detected_at: new Date().toISOString(),
      }));

      const { error: signalError } = await supabase.from("prospect_signals").insert(signals);
      if (signalError) {
        console.error("Failed to save signals:", signalError);
      }
    }

    // Update agent run
    if (runId) {
      await supabase.from("agent_runs").update({
        status: "completed",
        output: intelligence,
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
    }

    return new Response(JSON.stringify({
      success: true,
      agent: "prospect_intel",
      mode: "outbound",
      run_id: runId,
      data: intelligence,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("prospect-intel error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
