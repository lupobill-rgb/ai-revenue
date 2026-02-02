import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { checkRateLimits, rateLimitResponse, getClientIp } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit config: 10/min, 50/hour, 200/day
const RATE_LIMIT_CONFIG = { perMinute: 10, perHour: 50, perDay: 200 };

interface VideoRequest {
  vertical: string;
  assetGoal?: string;
  description?: string;
  assetId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vertical, assetGoal, description, assetId }: VideoRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is missing from environment variables");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating marketing visual with Lovable AI...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Use anon key + user's JWT for RLS enforcement
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting per user + IP (use service role client for rate limit checks)
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const clientIp = getClientIp(req);
    const rateLimitResult = await checkRateLimits(
      serviceClient,
      "generate-video",
      user.id,
      clientIp,
      RATE_LIMIT_CONFIG
    );
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult, corsHeaders);
    }

    console.log(`[generate-video] User ${user.id} generating visual for asset ${assetId}`);

    // If assetId provided, verify user has access (RLS enforced)
    if (assetId) {
      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .select('id, tenant_id')
        .eq('id', assetId)
        .single();

      if (assetError || !asset) {
        console.error('Asset access denied:', assetError);
        return new Response(
          JSON.stringify({ error: 'Asset not found or access denied' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch customer's business profile for dynamic branding
    let businessName = "Your Company";
    let industry = vertical || "Business Services";
    
    try {
      const { data: profile } = await supabase
        .from('business_profiles')
        .select('business_name, industry')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (profile) {
        businessName = profile.business_name || businessName;
        industry = profile.industry || vertical || industry;
      }
    } catch (profileError) {
      console.log("Could not fetch business profile, using defaults");
    }

    // Build context-aware prompt from user inputs
    let contextParts = [];
    
    if (assetGoal) {
      contextParts.push(`Marketing goal: ${assetGoal}`);
    }
    
    if (description) {
      contextParts.push(description);
    }

    // Create industry-specific visual prompts
    const verticalPrompts: Record<string, string> = {
      'Biotechnology & Pharmaceuticals': `Modern pharmaceutical research laboratory with scientists in professional attire, advanced equipment, data visualization screens, clean clinical environment`,
      'Healthcare & Medical': `Modern healthcare facility with caring medical professionals, state-of-the-art medical equipment, warm and welcoming clinical environment`,
      'Technology & SaaS': `Modern tech office with collaborative tenant, professionals using cutting-edge software, digital screens displaying interfaces, innovative atmosphere`,
      'Financial Services': `Professional financial office with advisors meeting clients, market data on screens, trustworthy and sophisticated business environment`,
      'Professional Services': `Modern consulting office with professionals in strategic meetings, presentation materials, collaborative tenant with city views`,
      'Manufacturing': `Advanced manufacturing facility with precision equipment, quality control processes, skilled workers demonstrating expertise`,
      'Retail & E-commerce': `Modern retail environment with happy customers, product showcases, seamless shopping experience, branded packaging`,
      'Real Estate': `Stunning property showcase with modern interiors, architectural details, lifestyle amenities, aspirational living spaces`,
      'Education & Training': `Modern learning environment with engaged students and instructors, interactive technology, collaborative learning spaces`,
      'Hospitality & Travel': `Luxury hospitality venue with exceptional guest experiences, premium amenities, stunning locations`,
      'Media & Entertainment': `Creative studio environment with content production, engaged audiences, dynamic entertainment experiences`,
      'Non-Profit': `Community impact in action with volunteers making a difference, beneficiaries being helped, positive social change`,
      'Banking & Financial Services': `Professional banking environment with modern financial technology, trusted advisors, secure digital banking interfaces`,
    };

    const verticalPrompt = verticalPrompts[vertical] || `Professional business environment for ${industry} showcasing excellence, innovation, and customer success`;
    
    // Construct final prompt
    let imagePrompt = `Ultra high resolution professional marketing image. ${verticalPrompt}`;
    
    if (contextParts.length > 0) {
      imagePrompt = `${imagePrompt}. ${contextParts.join('. ')}`;
    }
    imagePrompt = `${imagePrompt}. Professional cinematic quality for ${businessName}. High production value, engaging visuals, modern aesthetic. 16:9 aspect ratio hero image.`;

    console.log("Generating image with Lovable AI using prompt:", imagePrompt);

    // Generate image with Lovable AI
    const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: imagePrompt }],
        modalities: ["image", "text"]
      })
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error("Lovable AI image generation error:", imageResponse.status, errorText);
      
      if (imageResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later.", retryable: true }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (imageResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to your Lovable tenant.", retryable: false }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Image generation failed: ${imageResponse.status}`);
    }

    const imageData = await imageResponse.json();
    const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.error("No image in response:", JSON.stringify(imageData));
      throw new Error("No image generated");
    }
    
    console.log("Image generated successfully with Lovable AI");

    // Update asset with image URL
    if (assetId) {
      const { error: updateError } = await serviceClient
        .from('assets')
        .update({ preview_url: imageUrl, updated_at: new Date().toISOString() })
        .eq('id', assetId);

      if (updateError) {
        console.error("Failed to update asset:", updateError);
      } else {
        console.log("Asset updated with image URL");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processing: false,
        imageUrl: imageUrl,
        videoUrl: null,
        vertical,
        prompt: imagePrompt,
        message: "Marketing visual generated successfully."
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error in generate-video:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    
    let errorMessage = "Unknown error occurred";
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        errorMessage = "API key is not authorized. Please check your configuration.";
        statusCode = 401;
      } else if (error.message.includes("429") || error.message.includes("Rate limit")) {
        errorMessage = "Rate limit reached. Please try again later.";
        statusCode = 429;
      }
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage, retryable: statusCode === 429 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: statusCode }
    );
  }
});
