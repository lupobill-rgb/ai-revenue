import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Dynamic image prompt based on customer's business profile
const getBusinessPrompt = (
  assetType: string, 
  industry: string, 
  businessName: string,
  campaignName: string, 
  goal: string
) => {
  // Industry-specific visual contexts
  const industryContext: Record<string, string> = {
    "Biotechnology & Pharmaceuticals": "modern laboratory setting, scientists in white coats, high-tech research equipment, clean clinical environment",
    "Healthcare & Medical": "professional medical facility, caring healthcare workers, modern equipment, welcoming patient environment",
    "Technology & SaaS": "sleek modern office, innovative workspace, screens with data visualizations, collaborative tech team",
    "Finance & Banking": "professional financial district setting, modern office tower, confident business professionals",
    "Real Estate & Property": "beautiful property showcase, modern architecture, inviting living spaces, premium finishes",
    "Education & Training": "inspiring learning environment, engaged students, modern classroom technology, collaborative spaces",
    "Consulting & Professional Services": "executive boardroom, professional team meeting, strategic planning session",
    "E-commerce": "modern fulfillment center, product photography setup, happy customers receiving packages",
    "Manufacturing": "advanced manufacturing facility, precision machinery, quality control process, skilled workers",
    "Food & Beverage": "appetizing food presentation, modern restaurant or kitchen, fresh ingredients, culinary excellence",
    "Hospitality & Tourism": "luxury accommodation, welcoming staff, stunning destination views, premium guest experience",
    "Sports & Recreation": "active fitness environment, engaged participants, professional sports facility, energetic atmosphere",
    "Marketing & Advertising": "creative agency workspace, brainstorming session, digital marketing screens, innovative campaigns",
    "Legal Services": "professional law office, confident attorneys, legal library, client consultation",
    "Non-Profit & NGO": "community impact scene, volunteers in action, positive social change, helping others",
  };

  const typeContext: Record<string, string> = {
    video: "cinematic wide shot, dynamic action, professional videography",
    email: "clean professional composition, welcoming atmosphere, bright lighting",
    landing_page: "hero image style, dramatic lighting, call-to-action ready",
    voice: "person on phone in professional setting, conversational moment",
  };

  // Find matching industry or use generic professional context
  const matchedIndustry = Object.keys(industryContext).find(key => 
    industry?.toLowerCase().includes(key.toLowerCase()) ||
    key.toLowerCase().includes(industry?.toLowerCase() || '')
  );
  
  const context = matchedIndustry 
    ? industryContext[matchedIndustry] 
    : "professional business environment, modern office setting, successful team collaboration";
  
  const typeStyle = typeContext[assetType] || typeContext.landing_page;

  return `Professional marketing photograph for ${businessName}: ${context}. ${typeStyle}. 
Campaign: "${campaignName}". Goal: ${goal || "Drive engagement"}.
REQUIREMENTS: Ultra high resolution, professional photography, 
clean modern aesthetic, marketing-ready composition, 16:9 aspect ratio,
authentic business environment, diverse professional team, premium quality.`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assetId, assetType, vertical, campaignName, goal } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const { user, error: authError, supabaseClient } = await verifyAuth(req);
    if (authError || !user || !supabaseClient) {
      return unauthorizedResponse(corsHeaders, authError || "Not authenticated");
    }

    console.log(`[generate-campaign-thumbnail] User ${user.id} generating thumbnail for asset ${assetId}`);

    // Fetch the customer's business profile for dynamic branding
    const { data: businessProfile } = await supabaseClient
      .from("business_profiles")
      .select("business_name, industry")
      .eq("user_id", user.id)
      .single();

    const businessName = businessProfile?.business_name || "Your Business";
    const industry = vertical || businessProfile?.industry || "Professional Services";

    // If assetId provided, verify user has access - RLS enforced
    if (assetId) {
      const { data: asset, error: assetError } = await supabaseClient
        .from("assets")
        .select("id, content, workspace_id")
        .eq("id", assetId)
        .single();

      if (assetError || !asset) {
        console.error('Asset access denied:', assetError);
        return new Response(
          JSON.stringify({ error: 'Asset not found or access denied' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const prompt = getBusinessPrompt(
      assetType || "landing_page",
      industry,
      businessName,
      campaignName || `${businessName} Marketing Campaign`,
      goal || "Drive engagement and conversions"
    );

    console.log(`Generating thumbnail for ${businessName} - ${campaignName} (${assetType})`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Image generation error:", response.status, errorText);
      throw new Error(`Image generation failed: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error("No image generated");
    }

    // Update asset with generated thumbnail - RLS enforced
    if (assetId) {
      const { data: asset } = await supabaseClient
        .from("assets")
        .select("content")
        .eq("id", assetId)
        .single();

      await supabaseClient
        .from("assets")
        .update({
          preview_url: imageUrl,
          content: {
            ...(asset?.content || {}),
            hero_image_url: imageUrl,
            thumbnail_generated_at: new Date().toISOString(),
          },
        })
        .eq("id", assetId);

      console.log(`Updated asset ${assetId} with generated thumbnail`);
    }

    return new Response(
      JSON.stringify({ success: true, imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-campaign-thumbnail:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
