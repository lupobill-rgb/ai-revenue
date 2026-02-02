import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegenerateInput {
  tenant_id: string;
  landing_page_id: string;
  overrides: {
    heroHeadline?: string;
    heroSubheadline?: string;
    primaryCtaLabel?: string;
  };
}

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
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

    const input: RegenerateInput = await req.json();
    const { tenant_id, landing_page_id, overrides } = input;

    if (!tenant_id || !landing_page_id) {
      return new Response(JSON.stringify({ error: "Missing tenant_id or landing_page_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Regenerating landing page ${landing_page_id} for tenant ${tenant_id}`);

    // Fetch existing landing page asset
    const { data: asset, error: assetError } = await supabase
      .from("cmo_content_assets")
      .select("*")
      .eq("id", landing_page_id)
      .eq("tenant_id", tenant_id)
      .eq("content_type", "landing_page")
      .single();

    if (assetError || !asset) {
      return new Response(JSON.stringify({ error: "Landing page not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing variant
    const { data: variant } = await supabase
      .from("cmo_content_variants")
      .select("*")
      .eq("asset_id", landing_page_id)
      .single();

    // Parse existing body content
    let existingBody: Record<string, unknown> = {};
    try {
      if (variant?.body_content) {
        existingBody = JSON.parse(variant.body_content);
      }
    } catch {}

    // Fetch brand profile for context
    const { data: brandProfile } = await supabase
      .from("cmo_brand_profiles")
      .select("*")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    // Fetch ICP for targeting
    const { data: icpSegments } = await supabase
      .from("cmo_icp_segments")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_primary", true)
      .limit(1);

    const icp = icpSegments?.[0];

    // Build current landing page state with user overrides applied
    const currentPage = {
      internalName: asset.title,
      templateType: existingBody.template_type || "lead_magnet",
      urlSlug: existingBody.url_slug || "",
      heroHeadline: overrides.heroHeadline || variant?.headline || asset.key_message || "",
      heroSubheadline: overrides.heroSubheadline || variant?.subject_line || "",
      heroSupportingPoints: existingBody.hero_supporting_points || asset.supporting_points || [],
      sections: existingBody.sections || [],
      primaryCtaLabel: overrides.primaryCtaLabel || variant?.cta_text || asset.cta || "Get Started",
      primaryCtaType: existingBody.primary_cta_type || "form",
      formFields: existingBody.form_fields || [],
    };

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured - returning with overrides only");
      return new Response(JSON.stringify({
        id: asset.id,
        tenant_id,
        campaign_id: asset.campaign_id,
        internalName: asset.title,
        templateType: currentPage.templateType,
        urlSlug: currentPage.urlSlug,
        heroHeadline: currentPage.heroHeadline,
        heroSubheadline: currentPage.heroSubheadline,
        heroSupportingPoints: currentPage.heroSupportingPoints,
        sections: currentPage.sections,
        primaryCtaLabel: currentPage.primaryCtaLabel,
        primaryCtaType: currentPage.primaryCtaType,
        formFields: currentPage.formFields,
        status: asset.status,
        url: existingBody.published_url || "",
        autoWired: true,
        variantId: variant?.id,
        created_at: asset.created_at,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // AI regeneration prompt - agent decides structure based on user's key text nudges
    const systemPrompt = `You are an expert landing page optimizer. Given the user's key text changes (headline, subheadline, CTA), regenerate the supporting content to be cohesive and high-converting.

${brandProfile ? `Brand Context:
- Brand: ${brandProfile.brand_name}
- Voice: ${brandProfile.brand_voice || "Professional"}
- Tone: ${brandProfile.brand_tone || "Confident"}
- Industry: ${brandProfile.industry || "Business"}
- Value Prop: ${brandProfile.unique_value_proposition || ""}` : ""}

${icp ? `Target ICP:
- Segment: ${icp.segment_name}
- Pain Points: ${JSON.stringify(icp.pain_points || [])}
- Goals: ${JSON.stringify(icp.goals || [])}` : ""}

Rules:
1. Keep the same template_type: "${currentPage.templateType}"
2. Use the provided headline/subheadline/CTA exactly as given - DO NOT change them
3. UPDATE the heroSupportingPoints to match the new headline promise
4. UPDATE section headings and body text to be cohesive with the new messaging
5. Keep the same number of sections and their types
6. Keep form_fields and urlSlug unchanged
7. Make copy punchy, benefit-driven, and specific
8. Return valid JSON matching the exact structure provided`;

    const userPrompt = `Rebuild this landing page content to match the new key text:

**NEW HEADLINE (keep exactly):** "${currentPage.heroHeadline}"
**NEW SUBHEADLINE (keep exactly):** "${currentPage.heroSubheadline}"
**NEW CTA (keep exactly):** "${currentPage.primaryCtaLabel}"

Current page structure to update:
${JSON.stringify(currentPage, null, 2)}

Return the complete JSON with updated heroSupportingPoints and sections that match the new headline. Keep templateType, urlSlug, primaryCtaType, and formFields unchanged.`;

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
        temperature: 0.6,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI error:", aiResponse.status);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let regeneratedPage = currentPage;
    
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const aiContent = aiData.choices?.[0]?.message?.content;

      try {
        let jsonStr = aiContent;
        const jsonMatch = aiContent?.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        }
        if (jsonStr) {
          regeneratedPage = JSON.parse(jsonStr);
          // Ensure user's overrides are preserved exactly
          regeneratedPage.heroHeadline = currentPage.heroHeadline;
          regeneratedPage.heroSubheadline = currentPage.heroSubheadline;
          regeneratedPage.primaryCtaLabel = currentPage.primaryCtaLabel;
        }
      } catch {
        console.error("Failed to parse AI response, using overrides only");
      }
    }

    // Save updated content to database
    const sectionsArray = Array.isArray(regeneratedPage.sections) 
      ? regeneratedPage.sections 
      : (Array.isArray(currentPage.sections) ? currentPage.sections : []);
    
    const newBodyContent = JSON.stringify({
      template_type: regeneratedPage.templateType || currentPage.templateType,
      url_slug: existingBody.url_slug,
      published_url: existingBody.published_url,
      hero_supporting_points: regeneratedPage.heroSupportingPoints || currentPage.heroSupportingPoints,
      sections: sectionsArray.map((s: any) => ({
        ...s,
        enabled: s.enabled !== false,
      })),
      primary_cta_type: regeneratedPage.primaryCtaType || currentPage.primaryCtaType,
      form_fields: currentPage.formFields,
      crm_form_id: existingBody.crm_form_id,
      utm_source: existingBody.utm_source,
      utm_campaign: existingBody.utm_campaign,
    });

    // Update asset
    await supabase
      .from("cmo_content_assets")
      .update({
        key_message: regeneratedPage.heroHeadline,
        cta: regeneratedPage.primaryCtaLabel,
        supporting_points: regeneratedPage.heroSupportingPoints,
        updated_at: new Date().toISOString(),
      })
      .eq("id", landing_page_id);

    // Update variant
    if (variant) {
      await supabase
        .from("cmo_content_variants")
        .update({
          headline: regeneratedPage.heroHeadline,
          subject_line: regeneratedPage.heroSubheadline,
          cta_text: regeneratedPage.primaryCtaLabel,
          body_content: newBodyContent,
          updated_at: new Date().toISOString(),
        })
        .eq("id", variant.id);
    }

    // Log agent run
    await supabase.from("agent_runs").insert({
      agent: "cmo_landing_optimizer",
      tenant_id,
      tenant_id: tenant_id,
      status: "completed",
      input: { landing_page_id, overrides },
      output: { regenerated: true },
    });

    // Build response in LandingPageDraft format
    const response = {
      id: asset.id,
      tenant_id,
      campaign_id: asset.campaign_id,
      internalName: asset.title,
      templateType: regeneratedPage.templateType || currentPage.templateType,
      urlSlug: existingBody.url_slug || "",
      heroHeadline: regeneratedPage.heroHeadline,
      heroSubheadline: regeneratedPage.heroSubheadline,
      heroSupportingPoints: regeneratedPage.heroSupportingPoints || [],
      sections: regeneratedPage.sections || [],
      primaryCtaLabel: regeneratedPage.primaryCtaLabel,
      primaryCtaType: regeneratedPage.primaryCtaType || "form",
      formFields: currentPage.formFields,
      status: asset.status,
      url: existingBody.published_url || "",
      autoWired: true,
      variantId: variant?.id,
      created_at: asset.created_at,
    };

    console.log(`Landing page ${landing_page_id} regenerated successfully`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Landing page regenerate error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
