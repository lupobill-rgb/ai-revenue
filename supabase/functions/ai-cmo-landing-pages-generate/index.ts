import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, draft } = await req.json();

    if (!tenant_id || !draft) {
      return new Response(JSON.stringify({ error: "Missing tenant_id or draft" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch brand profile to customize the landing page
    const { data: brandProfile } = await supabase
      .from("cmo_brand_profiles")
      .select("*")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    // Fetch ICP segments for targeting context
    const { data: icpSegments } = await supabase
      .from("cmo_icp_segments")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_primary", true)
      .limit(1);

    const brandContext = brandProfile ? {
      brand_name: brandProfile.brand_name,
      brand_voice: brandProfile.brand_voice,
      brand_tone: brandProfile.brand_tone,
      unique_value_proposition: brandProfile.unique_value_proposition,
      tagline: brandProfile.tagline,
      key_differentiators: brandProfile.key_differentiators,
    } : null;

    const icpContext = icpSegments?.[0] ? {
      segment_name: icpSegments[0].segment_name,
      pain_points: icpSegments[0].pain_points,
      goals: icpSegments[0].goals,
      objections: icpSegments[0].objections,
    } : null;

    // Call Lovable AI to enhance the landing page
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert landing page copywriter. Enhance the provided landing page content to be more compelling, persuasive, and conversion-focused.

${brandContext ? `Brand Context:
- Brand Name: ${brandContext.brand_name}
- Voice: ${brandContext.brand_voice || "Professional and engaging"}
- Tone: ${brandContext.brand_tone || "Confident and helpful"}
- Value Proposition: ${brandContext.unique_value_proposition || ""}
- Tagline: ${brandContext.tagline || ""}
- Key Differentiators: ${JSON.stringify(brandContext.key_differentiators || [])}` : ""}

${icpContext ? `Target Audience:
- Segment: ${icpContext.segment_name}
- Pain Points: ${JSON.stringify(icpContext.pain_points || [])}
- Goals: ${JSON.stringify(icpContext.goals || [])}
- Common Objections: ${JSON.stringify(icpContext.objections || [])}` : ""}

Rules:
1. Enhance headlines to be punchy, benefit-driven, and specific
2. Add power words and emotional triggers
3. Make supporting points concrete with numbers or specifics where possible
4. Improve section copy to address pain points and showcase benefits
5. Optimize CTA text for urgency and value
6. Keep the same structure (templateType, sections count, formFields)
7. Return valid JSON matching the exact input structure`;

    const userPrompt = `Enhance this landing page content:\n${JSON.stringify(draft, null, 2)}

Return the enhanced version as valid JSON with the same structure.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Return original draft on AI failure
      return new Response(JSON.stringify(draft), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      console.error("No content in AI response");
      return new Response(JSON.stringify(draft), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse AI response - extract JSON from possible markdown code blocks
    let enhancedDraft = draft;
    try {
      let jsonStr = aiContent;
      // Remove markdown code blocks if present
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      enhancedDraft = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return original on parse failure
      return new Response(JSON.stringify(draft), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the agent run
    await supabase.from("agent_runs").insert({
      agent: "landing_page_enhancer",
      tenant_id,
      tenant_id: tenant_id,
      status: "completed",
      input: { original: draft },
      output: { enhanced: enhancedDraft },
    });

    console.log("Landing page enhanced successfully for tenant:", tenant_id);

    return new Response(JSON.stringify(enhancedDraft), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in ai-cmo-landing-pages-generate:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
