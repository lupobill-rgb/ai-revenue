import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { checkRateLimits, rateLimitResponse, getClientIp } from "../_shared/rate-limit.ts";

// Declare EdgeRuntime global for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit config: 5/min, 20/hour, 100/day (costly AI operation)
const RATE_LIMIT_CONFIG = { perMinute: 5, perHour: 20, perDay: 100 };

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
    
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is missing from environment variables");
      throw new Error("GEMINI_API_KEY is not configured");
    }

    console.log("GEMINI_API_KEY found, generating video with Veo 3.1...");

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

    console.log(`[generate-video] User ${user.id} generating video for asset ${assetId}`);

    // If assetId provided, verify user has access (RLS enforced)
    if (assetId) {
      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .select('id, workspace_id')
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

    // Check for AI-optimized templates first (based on conversion data)
    let optimizedTemplate = null;
    try {
      const { data: templates } = await supabase
        .from('content_templates')
        .select('*')
        .eq('template_type', 'video')
        .order('conversion_rate', { ascending: false })
        .order('last_optimized_at', { ascending: false })
        .limit(1);
      
      if (templates && templates.length > 0 && templates[0].last_optimized_at) {
        optimizedTemplate = templates[0];
        console.log(`Using AI-optimized template: ${optimizedTemplate.template_name} (conversion rate: ${optimizedTemplate.conversion_rate}%)`);
      }
    } catch (templateError) {
      console.log("No optimized templates found, using default prompts");
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

    // Create industry-specific video prompts (dynamic based on customer's business)
    const verticalPrompts: Record<string, string> = {
      'Biotechnology & Pharmaceuticals': `SCENE: Modern pharmaceutical research laboratory, scientists in professional attire, advanced equipment, data visualization screens showing analytics, clean clinical environment.`,
      'Healthcare & Medical': `SCENE: Modern healthcare facility, caring medical professionals with patients, state-of-the-art medical equipment, warm and welcoming clinical environment.`,
      'Technology & SaaS': `SCENE: Modern tech office with collaborative workspace, professionals using cutting-edge software, digital screens displaying product interfaces, innovative atmosphere.`,
      'Financial Services': `SCENE: Professional financial office, advisors meeting with clients, market data on screens, trustworthy and sophisticated business environment.`,
      'Professional Services': `SCENE: Modern consulting office, professionals in strategic meetings, presentation materials, collaborative workspace with city views.`,
      'Manufacturing': `SCENE: Advanced manufacturing facility, precision equipment, quality control processes, skilled workers demonstrating expertise.`,
      'Retail & E-commerce': `SCENE: Modern retail environment, happy customers, product showcases, seamless shopping experience, branded packaging.`,
      'Real Estate': `SCENE: Stunning property showcase, modern interiors, architectural details, lifestyle amenities, aspirational living spaces.`,
      'Education & Training': `SCENE: Modern learning environment, engaged students and instructors, interactive technology, collaborative learning spaces.`,
      'Hospitality & Travel': `SCENE: Luxury hospitality venue, exceptional guest experiences, premium amenities, stunning locations.`,
      'Media & Entertainment': `SCENE: Creative studio environment, content production, engaged audiences, dynamic entertainment experiences.`,
      'Non-Profit': `SCENE: Community impact in action, volunteers making a difference, beneficiaries being helped, positive social change.`,
    };

    // Use optimized template if available, otherwise fall back to vertical prompts
    let verticalPrompt: string;
    if (optimizedTemplate) {
      verticalPrompt = `${optimizedTemplate.content}. ${verticalPrompts[vertical] || 'Professional business environment showcasing excellence and innovation.'}`;
    } else {
      verticalPrompt = verticalPrompts[vertical] || `Professional business environment for ${industry} showcasing excellence, innovation, and customer success.`;
    }
    
    // Construct final prompt with customer's brand
    let videoPrompt = verticalPrompt;
    
    if (contextParts.length > 0) {
      videoPrompt = `${videoPrompt}. Additional context: ${contextParts.join('. ')}`;
    }
    videoPrompt = `${videoPrompt}. Professional cinematic marketing footage for ${businessName}. High production value, engaging visuals, modern aesthetic.`;

    console.log("Generating video with Veo 3.1 using prompt:", videoPrompt);

    const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Step 1: Generate starting image with Lovable AI
    console.log("Generating starting image with Lovable AI...");
    const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: videoPrompt }],
        modalities: ["image", "text"]
      })
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error("Lovable AI image generation error:", imageResponse.status, errorText);
      throw new Error(`Image generation failed: ${imageResponse.status}`);
    }

    const imageData = await imageResponse.json();
    const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      throw new Error("No image generated");
    }
    
    console.log("Image generated successfully with Lovable AI");
    
    // Extract base64 data from data URL for Veo
    const base64Match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error("Invalid image data URL format");
    }
    
    const mimeType = base64Match[1];
    const imageBytes = base64Match[2];

    // Start async video generation in background
    const generateVideoInBackground = async () => {
      console.log("Starting Veo 3.1 video generation in background...");
      
      // Use service role for background task since user session won't persist
      const bgSupabase = createClient(supabaseUrl, serviceRoleKey);
      
      try {
        // Step 2: Generate video with Veo 3.1 using the image
        const videoStartResponse = await fetch(`${BASE_URL}/models/veo-3.1-generate-preview:predictLongRunning?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{
              prompt: videoPrompt,
              image: { bytesBase64Encoded: imageBytes, mimeType: mimeType }
            }]
          })
        });

        if (!videoStartResponse.ok) {
          const errorText = await videoStartResponse.text();
          console.error("Video generation start error:", videoStartResponse.status, errorText);
          throw new Error(`Video generation failed to start: ${videoStartResponse.status}`);
        }

        const startData = await videoStartResponse.json();
        const operationName = startData.name;
        
        if (!operationName) throw new Error("No operation name returned");

        console.log("Video generation started, operation:", operationName);

        // Poll for completion
        let isDone = false;
        let videoUri = null;
        const maxAttempts = 120;
        let attempts = 0;

        while (!isDone && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          attempts++;

          const statusResponse = await fetch(`${BASE_URL}/${operationName}?key=${GEMINI_API_KEY}`, {
            headers: { "Content-Type": "application/json" }
          });

          if (!statusResponse.ok) {
            console.error("Error checking operation status:", statusResponse.status);
            continue;
          }

          const statusData = await statusResponse.json();
          isDone = statusData.done === true;

          if (isDone) {
            videoUri = statusData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
            console.log("Video generation complete, URI:", videoUri);
            break;
          } else {
            console.log(`Polling attempt ${attempts}/${maxAttempts}, still processing...`);
          }
        }

        if (!videoUri) {
          console.log("Video generation timed out or failed, using image fallback");
          throw new Error("No video URI returned after polling");
        }

        // Download the video
        const videoDownloadResponse = await fetch(videoUri, {
          headers: { "x-goog-api-key": GEMINI_API_KEY }
        });

        if (!videoDownloadResponse.ok) {
          throw new Error(`Failed to download video: ${videoDownloadResponse.status}`);
        }

        const videoBlob = await videoDownloadResponse.arrayBuffer();
        const videoBase64 = btoa(String.fromCharCode(...new Uint8Array(videoBlob)));
        const videoUrl = `data:video/mp4;base64,${videoBase64}`;

        console.log("Video downloaded successfully");

        // Update asset with video URL
        if (assetId) {
          const { error: updateError } = await bgSupabase
            .from('assets')
            .update({ preview_url: videoUrl, updated_at: new Date().toISOString() })
            .eq('id', assetId);

          if (updateError) {
            console.error("Failed to update asset:", updateError);
          } else {
            console.log("Asset updated with video URL");
          }
        }

      } catch (videoError) {
        console.error("Background video generation failed:", videoError);
        
        // Fallback: Update asset with image only
        if (assetId) {
          const { error: updateError } = await bgSupabase
            .from('assets')
            .update({ preview_url: imageUrl, updated_at: new Date().toISOString() })
            .eq('id', assetId);

          if (updateError) {
            console.error("Failed to update asset with image fallback:", updateError);
          } else {
            console.log("Asset updated with image URL (video generation failed)");
          }
        }
      }
    };

    // Start background task without awaiting
    EdgeRuntime.waitUntil(generateVideoInBackground());

    // Return immediately with image URL and processing status
    return new Response(
      JSON.stringify({
        success: true,
        processing: true,
        imageUrl: imageUrl,
        videoUrl: null,
        vertical,
        prompt: videoPrompt,
        message: "Video is processing with Veo 3.1 in the background. This may take 5-15 minutes for high-quality 8-second videos."
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
        errorMessage = "GEMINI_API_KEY is not authorized. Please check your API configuration.";
        statusCode = 401;
      } else if (error.message.includes("429") || error.message.includes("Rate limit")) {
        errorMessage = "Gemini API rate limit reached. Videos will be queued and processed sequentially.";
        statusCode = 429;
      } else if (error.message.includes("quota")) {
        errorMessage = "Gemini API quota exceeded. Please check your Google Cloud billing.";
        statusCode = 429;
      }
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage, retryable: statusCode === 429 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: statusCode }
    );
  }
});
