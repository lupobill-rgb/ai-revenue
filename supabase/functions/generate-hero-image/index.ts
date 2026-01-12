import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { runImage } from "../_shared/llmRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id, x-tenant-id",
  "Access-Control-Expose-Headers": "x-ai-revenue-build",
  "x-ai-revenue-build": "generate-hero-image-llm-router-v1",
};

interface ImageRequest {
  vertical: string;
  contentType?: string;
  goal?: string;
  assetGoal?: string;
  businessName?: string;
  workspaceId?: string;
  size?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ImageRequest = await req.json();
    const { vertical, contentType, goal, assetGoal, businessName } = body;
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: userError?.message || "Invalid JWT" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspaceId = req.headers.get("x-workspace-id") || req.headers.get("x-tenant-id") || body.workspaceId || null;
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "Missing workspace context", missing: ["x-workspace-id"] }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate workspace membership (owner or member)
    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .select("id, owner_id")
      .eq("id", workspaceId)
      .maybeSingle();

    if (wsError || !workspace) {
      return new Response(JSON.stringify({ error: "Invalid workspace", details: wsError?.message || "Not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let hasAccess = workspace.owner_id === user.id;
    if (!hasAccess) {
      const { data: membership, error: membershipError } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (membershipError) {
        return new Response(JSON.stringify({ error: "Workspace membership check failed", details: membershipError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      hasAccess = !!membership;
    }

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Forbidden: workspace access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      'Technology': `Innovative tech company workspace, modern technology environment, digital innovation, professional tech photography, contemporary design, ultra high resolution`,
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

    const allowedSizes = new Set(["1024x1024", "1024x1536", "1536x1024"]);
    const requestedSize = typeof body?.size === "string" ? body.size.trim() : "";
    const size = allowedSizes.has(requestedSize) ? requestedSize : "1024x1024";

    // Centralized image routing (provider/model selection + fallback)
    const out = await runImage({
      tenantId: workspaceId,
      capability: "image.generate",
      prompt: imagePrompt,
      size,
      timeoutMs: 40_000,
    });

    const b64 = out.b64;
    const imageUrlFromApi = out.url;
    if ((!b64 || typeof b64 !== "string") && (!imageUrlFromApi || typeof imageUrlFromApi !== "string")) {
      return new Response(JSON.stringify({ error: "Image generation failed", details: "No image returned by AI provider" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store to Supabase Storage to avoid giant data URLs in DB fields.
    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const bucket = "cmo-assets";
    const objectPath = `generated/${workspaceId}/${crypto.randomUUID()}.png`;
    let blob: Blob;
    if (b64 && typeof b64 === "string") {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      blob = new Blob([bytes], { type: "image/png" });
    } else {
      // Fallback: fetch the returned URL and store bytes.
      const imgResp = await fetch(imageUrlFromApi);
      if (!imgResp.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch generated image" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const buf = await imgResp.arrayBuffer();
      blob = new Blob([buf], { type: "image/png" });
    }

    const { error: uploadError } = await admin.storage.from(bucket).upload(objectPath, blob, {
      contentType: "image/png",
      upsert: true,
    });
    if (uploadError) {
      return new Response(JSON.stringify({ error: "Failed to store image", details: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: urlData } = admin.storage.from(bucket).getPublicUrl(objectPath);
    const imageUrl = urlData?.publicUrl || null;
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Failed to resolve image URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        error: "Unhandled error",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
