import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

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

    // Rate limiting per user
    const rateLimitResult = await checkRateLimit(`generate_video:${user.id}`, RATE_LIMIT_CONFIG);
    if (!rateLimitResult.allowed) {
      console.warn(`[generate-video] Rate limit exceeded for user ${user.id}`);
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

    // Build context-aware prompt from user inputs
    let contextParts = [];
    
    if (assetGoal) {
      contextParts.push(`Marketing goal: ${assetGoal}`);
    }
    
    if (description) {
      contextParts.push(description);
    }

    // PICKLEBALL DEFINITION FOR AI MODELS
    const pickleballDefinition = `CRITICAL PICKLEBALL EQUIPMENT REQUIREMENTS - THIS IS NOT TENNIS:
    1. PADDLES: Players hold SOLID RECTANGULAR PADDLES (like large ping-pong paddles) - absolutely NO stringed tennis rackets
    2. BALL: Small PERFORATED PLASTIC BALL with visible HOLES (wiffle ball style) - absolutely NO fuzzy yellow tennis balls
    3. COURT: SMALL court approximately 20x44 feet with "kitchen" non-volley zone - NOT a large tennis court
    4. NET: Lower net at 34 inches - shorter than tennis
    NEGATIVE: Do NOT show tennis rackets, tennis balls, tennis courts, or any tennis equipment.`;

    // Create vertical-specific video prompts
    const verticalPrompts: Record<string, string> = {
      'Hotels & Resorts': `${pickleballDefinition}. SCENE: Luxury resort hotel with dedicated PICKLEBALL courts (small courts with kitchen zones), guests holding SOLID PADDLES playing with PERFORATED PLASTIC BALLS, PlayKout branded facilities, oceanfront clubhouse.`,
      'Multifamily Real Estate': `${pickleballDefinition}. SCENE: Modern apartment complex with community PICKLEBALL courts, residents using SOLID PADDLES and WIFFLE-STYLE BALLS, PlayKout branded court markings, apartment amenity area.`,
      'Pickleball Clubs & Country Clubs': `${pickleballDefinition}. SCENE: Championship PICKLEBALL facility with green courts showing kitchen zones, players with SOLID PADDLES hitting PERFORATED BALLS, PlayKout signage, professional clubhouse.`,
      'Entertainment Venues': `${pickleballDefinition}. SCENE: Professional PICKLEBALL tournament venue, stadium seating, players with SOLID PADDLES and WIFFLE BALLS under dramatic lighting, PlayKout sponsorship banners.`,
      'Physical Therapy': `${pickleballDefinition}. SCENE: Sports therapy clinic, therapist working with PICKLEBALL player, SOLID PADDLES and PERFORATED BALLS visible, PlayKout rehabilitation branding.`,
      'Corporate Offices & Co-Working Spaces': `${pickleballDefinition}. SCENE: Modern office with rooftop PICKLEBALL court, professionals using SOLID PADDLES and WIFFLE BALLS during break, PlayKout branded workspace.`,
      'Education': `${pickleballDefinition}. SCENE: Campus PICKLEBALL courts, students learning with SOLID PADDLES and PERFORATED BALLS in PE class, PlayKout educational program signage.`,
      'Gyms': `${pickleballDefinition}. SCENE: Fitness center with indoor PICKLEBALL courts, athletes training with SOLID PADDLES and WIFFLE BALLS, PlayKout fitness branding.`
    };

    // Use optimized template if available, otherwise fall back to vertical prompts
    let verticalPrompt: string;
    if (optimizedTemplate) {
      verticalPrompt = `${pickleballDefinition}. ${optimizedTemplate.content}. ${verticalPrompts[vertical] || 'Professional PlayKout pickleball facility'}`;
    } else {
      verticalPrompt = verticalPrompts[vertical] || `${pickleballDefinition}. Professional PlayKout pickleball facility`;
    }
    
    // Construct final prompt
    let videoPrompt = verticalPrompt;
    
    if (contextParts.length > 0) {
      videoPrompt = `${videoPrompt}. Additional context: ${contextParts.join('. ')}`;
    }
    videoPrompt = `${videoPrompt}. Professional cinematic marketing footage. PlayKout branding visible. REMEMBER: SOLID PADDLES and PERFORATED BALLS only - absolutely NO tennis rackets or tennis balls.`;

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

    // Store credentials for background task (service role needed for background updates)
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
