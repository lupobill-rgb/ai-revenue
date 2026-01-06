import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assetId, variations = 2 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const { user, error: authError, supabaseClient } = await verifyAuth(req);
    if (authError || !user || !supabaseClient) {
      return unauthorizedResponse(corsHeaders, authError || "Not authenticated");
    }

    console.log(`[ab-test-create] User ${user.id} creating A/B test for asset ${assetId}`);

    // Fetch the original asset - RLS enforced
    const { data: asset, error: assetError } = await supabaseClient
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      console.error('Asset fetch error:', assetError);
      return new Response(
        JSON.stringify({ error: "Asset not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const content = asset.content as any;
    const vertical = content?.vertical || "Professional Services";

    // Fetch customer's business profile for dynamic branding
    const { data: businessProfile } = await supabaseClient
      .from("business_profiles")
      .select("business_name, industry")
      .eq("user_id", user.id)
      .single();

    const businessName = businessProfile?.business_name || "Your Business";
    const industry = businessProfile?.industry || vertical;

    // Generate A/B variations using AI
    const systemPrompt = `You are an expert marketing A/B test designer. Generate compelling content variations for split testing for ${businessName} in the ${industry} industry.

The vertical is: ${vertical}
Asset type: ${asset.type}

Generate ${variations} distinct variations that test different:
- Headlines and hooks
- Call-to-action messaging
- Value propositions
- Emotional appeals (excitement, community, health benefits)

Each variation should be significantly different to test meaningful hypotheses.`;

    const userPrompt = `Create ${variations} A/B test variations for this ${asset.type} asset:

Original content:
- Name: ${asset.name}
- Goal: ${asset.goal || "Drive engagement"}
- Description: ${asset.description || ""}
${content?.headline ? `- Headline: ${content.headline}` : ""}
${content?.subject_line ? `- Subject: ${content.subject_line}` : ""}
${content?.body_copy ? `- Body: ${content.body_copy.substring(0, 200)}...` : ""}

Return JSON with this structure:
{
  "variations": [
    {
      "variant_name": "Variation A - [hypothesis being tested]",
      "headline": "string",
      "subject_line": "string (for emails)",
      "body_copy": "string",
      "cta_text": "string",
      "hypothesis": "What we're testing with this variation"
    }
  ],
  "test_hypothesis": "Overall hypothesis for this A/B test",
  "success_metric": "primary metric to determine winner"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }

    const testData = JSON.parse(jsonMatch[0]);

    // Create variation assets - RLS enforced
    const createdVariations = [];
    for (let i = 0; i < testData.variations.length; i++) {
      const variation = testData.variations[i];
      const variantLabel = String.fromCharCode(65 + i);

      const { data: newAsset, error: createError } = await supabaseClient
        .from("assets")
        .insert({
          name: `${asset.name} - Variant ${variantLabel}`,
          type: asset.type,
          status: "review",
          channel: asset.channel,
          goal: asset.goal,
          description: variation.hypothesis,
          workspace_id: asset.workspace_id,
          created_by: user.id,
          content: {
            ...content,
            headline: variation.headline,
            subject_line: variation.subject_line,
            body_copy: variation.body_copy,
            cta_text: variation.cta_text,
            ab_test: {
              original_asset_id: assetId,
              variant: variantLabel,
              hypothesis: variation.hypothesis,
              test_hypothesis: testData.test_hypothesis,
              success_metric: testData.success_metric,
            },
          },
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating variation:", createError);
        continue;
      }

      // Create campaign for variation - RLS enforced
      await supabaseClient.from("campaigns").insert({
        asset_id: newAsset.id,
        channel: asset.channel || "mixed",
        status: "pending",
        workspace_id: asset.workspace_id,
        target_audience: content?.target_audience,
      });

      createdVariations.push({
        id: newAsset.id,
        name: newAsset.name,
        variant: variantLabel,
        hypothesis: variation.hypothesis,
      });
    }

    // Update original asset with A/B test metadata - RLS enforced
    await supabaseClient
      .from("assets")
      .update({
        content: {
          ...content,
          ab_test: {
            is_control: true,
            test_hypothesis: testData.test_hypothesis,
            success_metric: testData.success_metric,
            variations: createdVariations.map((v) => v.id),
          },
        },
      })
      .eq("id", assetId);

    console.log(`Created ${createdVariations.length} A/B test variations for asset ${assetId}`);

    return new Response(
      JSON.stringify({
        success: true,
        originalAssetId: assetId,
        testHypothesis: testData.test_hypothesis,
        successMetric: testData.success_metric,
        variations: createdVariations,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ab-test-create:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
