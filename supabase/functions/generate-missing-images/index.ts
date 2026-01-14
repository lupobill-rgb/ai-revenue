import { verifyAuth, unauthorizedResponse } from "../_shared/auth.ts";
import { openaiImageGenerate } from "../_shared/providers/openai.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }
    const imageModel = Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-1";

    const { user, error: authError, supabaseClient } = await verifyAuth(req);
    if (authError || !user || !supabaseClient) {
      return unauthorizedResponse(corsHeaders, authError || "Not authenticated");
    }

    // Fetch the customer's business profile for dynamic branding
    const { data: businessProfile } = await supabaseClient
      .from("business_profiles")
      .select("business_name, industry")
      .eq("user_id", user.id)
      .single();

    const businessName = businessProfile?.business_name || "Your Business";
    const businessIndustry = businessProfile?.industry || "Professional Services";

    // Fetch assets without preview images
    const { data: assets, error: fetchError } = await supabaseClient
      .from('assets')
      .select('id, name, type, channel, content, preview_url')
      .or('preview_url.is.null,and(type.eq.landing_page,content->>hero_image_url.is.null)')
      .in('type', ['landing_page', 'email', 'video']);

    if (fetchError) throw fetchError;
    if (!assets || assets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No assets need images', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${assets.length} assets needing images for ${businessName}`);
    const results = [];

    for (const asset of assets) {
      try {
        // Check if this asset actually needs an image
        const needsImage = !asset.preview_url && 
          (asset.type !== 'landing_page' || !asset.content?.hero_image_url);
        
        if (!needsImage) continue;

        // Generate appropriate prompt based on asset type and customer's business
        let prompt = '';
        const vertical = asset.channel || businessIndustry;
        
        if (asset.type === 'landing_page') {
          const headline = asset.content?.hero_headline || asset.content?.headline || asset.name;
          prompt = `Create a professional, high-quality hero image for ${businessName} - a ${vertical.toLowerCase()} business landing page. Theme: "${headline}". Style: Modern, clean, professional. Feature authentic business environment, premium quality, welcoming atmosphere. Photorealistic, 16:9 aspect ratio, ultra high resolution.`;
        } else if (asset.type === 'video') {
          const description = asset.content?.description || asset.name;
          prompt = `Create a professional thumbnail image for ${businessName} video about "${description}" for ${vertical}. Style: Vibrant, action-oriented, cinematic. Professional business environment, engaged team members. Photorealistic, 16:9 aspect ratio, ultra sharp focus.`;
        } else if (asset.type === 'email') {
          const subject = asset.content?.subject || asset.name;
          prompt = `Create an email header image for ${businessName} marketing about "${subject}" targeting ${vertical}. Style: Professional, inviting, premium. Feature modern business environment, welcoming atmosphere. Photorealistic, 16:9 aspect ratio.`;
        }

        console.log(`Generating image for asset ${asset.id}: ${asset.name}`);

        const img = await openaiImageGenerate({
          apiKey: OPENAI_API_KEY,
          model: imageModel,
          prompt,
          timeoutMs: 55_000,
        });
        const generatedImageUrl = img.url || (img.b64 ? `data:image/png;base64,${img.b64}` : "");

        if (!generatedImageUrl) {
          console.error(`No image URL returned for ${asset.id}`);
          results.push({ id: asset.id, name: asset.name, success: false, error: 'No image generated' });
          continue;
        }

        // Update the asset with the generated image
        let updateData: any = {};
        if (asset.type === 'landing_page') {
          // Store in content.hero_image_url for landing pages
          updateData = {
            content: {
              ...asset.content,
              hero_image_url: generatedImageUrl
            }
          };
        } else {
          // Store in preview_url for other types
          updateData = {
            preview_url: generatedImageUrl
          };
        }

        const { error: updateError } = await supabaseClient
          .from('assets')
          .update(updateData)
          .eq('id', asset.id);

        if (updateError) {
          console.error(`Failed to update asset ${asset.id}:`, updateError);
          results.push({ id: asset.id, name: asset.name, success: false, error: updateError.message });
        } else {
          console.log(`Successfully generated image for asset ${asset.id}`);
          results.push({ id: asset.id, name: asset.name, success: true });
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (assetError) {
        console.error(`Error processing asset ${asset.id}:`, assetError);
        results.push({ 
          id: asset.id, 
          name: asset.name, 
          success: false, 
          error: assetError instanceof Error ? assetError.message : 'Unknown error' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Generated ${successCount} images, ${failCount} failed`,
        totalProcessed: results.length,
        successCount,
        failCount,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-missing-images:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
