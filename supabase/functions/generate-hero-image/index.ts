import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImageRequest {
  vertical: string;
  contentType?: string;
  goal?: string;
  assetGoal?: string;
  businessName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vertical, contentType, goal, assetGoal, businessName }: ImageRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Dynamic image prompts based on vertical/industry
    const verticalPrompts: Record<string, string> = {
      'Hotels & Resorts': `Luxury hotel resort with premium amenities, elegant pool area, guests enjoying services, professional hospitality photography, warm lighting, ultra high resolution`,
      'Multifamily Real Estate': `Modern apartment complex with community amenities, residents enjoying lifestyle, contemporary architecture, professional real estate photography, golden hour, ultra high resolution`,
      'Entertainment Venues': `Vibrant entertainment venue, exciting atmosphere, happy guests, dynamic event photography, dramatic lighting, ultra high resolution`,
      'Physical Therapy': `Modern physical therapy clinic, professional healthcare setting, patient care, clean medical facility, professional healthcare photography, ultra high resolution`,
      'Corporate Offices': `Modern corporate office space, professional business environment, team collaboration, contemporary design, professional photography, ultra high resolution`,
      'Education': `Modern educational campus, students learning, professional academic environment, bright lighting, educational photography, ultra high resolution`,
      'Gyms': `Premium fitness center, modern gym equipment, athletes training, dynamic fitness photography, energetic lighting, ultra high resolution`,
      'Restaurants': `Upscale restaurant interior, delicious cuisine presentation, dining atmosphere, professional food photography, warm ambiance, ultra high resolution`,
      'Retail': `Modern retail store, premium shopping experience, product displays, professional retail photography, inviting atmosphere, ultra high resolution`,
      'Healthcare': `Modern healthcare facility, professional medical services, patient care environment, clean clinical setting, professional photography, ultra high resolution`,
      'Technology': `Innovative tech company tenant, modern technology environment, digital innovation, professional tech photography, contemporary design, ultra high resolution`,
      'Finance': `Professional financial services office, modern business environment, trust and reliability, professional corporate photography, sophisticated atmosphere, ultra high resolution`,
      'Real Estate': `Beautiful property exterior and interior, real estate showcase, professional property photography, inviting atmosphere, ultra high resolution`,
      'Automotive': `Premium automotive showroom, vehicles on display, professional automotive photography, sleek design, ultra high resolution`,
      'Travel': `Stunning travel destination, tourism experience, adventure and exploration, professional travel photography, beautiful scenery, ultra high resolution`,
    };

    // Content type specific modifiers
    const contentTypeModifiers: Record<string, string> = {
      'email': 'marketing email hero image, engaging and professional',
      'social': 'social media post, eye-catching and shareable',
      'video': 'video thumbnail, dynamic and attention-grabbing',
      'landing_page': 'website hero section, professional and converting',
      'voice': 'professional business communication imagery',
    };

    // Build the prompt
    let imagePrompt = verticalPrompts[vertical] || `Professional business marketing image for ${vertical} industry, high quality commercial photography, ultra high resolution`;
    
    // Add content type context
    if (contentType && contentTypeModifiers[contentType]) {
      imagePrompt = `${contentTypeModifiers[contentType]}. ${imagePrompt}`;
    }
    
    // Add goal-specific context if provided
    const campaignGoal = goal || assetGoal;
    if (campaignGoal) {
      imagePrompt = `${imagePrompt}. Focus on: ${campaignGoal}`;
    }

    // Add business name if provided
    if (businessName) {
      imagePrompt = `${imagePrompt}. For: ${businessName}`;
    }

    console.log("Generating image with prompt:", imagePrompt);

    // Call Lovable AI image generation
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: imagePrompt
          }
        ],
        modalities: ["image", "text"]
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
          JSON.stringify({ error: "Payment required. Please add funds to your Lovable AI tenant." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error("No image generated");
    }

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl,
        vertical,
        prompt: imagePrompt
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in generate-hero-image:", error);
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
