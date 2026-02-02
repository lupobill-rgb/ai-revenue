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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body params
    let tenantId: string | null = null;
    let campaignId: string | null = null;
    
    try {
      const body = await req.json();
      tenantId = body.tenantId || body.tenant_id;
      campaignId = body.campaignId || body.campaign_id;
    } catch {
      // If body parsing fails, try query params as fallback
      const url = new URL(req.url);
      tenantId = url.searchParams.get("tenantId");
      campaignId = url.searchParams.get("campaignId");
    }

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenantId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Fetching landing pages for tenant: ${tenantId}, campaign: ${campaignId || 'all'}`);

    // Fetch landing page assets
    let assetsQuery = supabase
      .from("cmo_content_assets")
      .select(`
        id,
        title,
        campaign_id,
        status,
        created_at,
        key_message,
        cta,
        supporting_points
      `)
      .eq("tenant_id", tenantId)
      .eq("content_type", "landing_page")
      .order("created_at", { ascending: false });

    if (campaignId) {
      assetsQuery = assetsQuery.eq("campaign_id", campaignId);
    }

    const { data: assets, error: assetsError } = await assetsQuery;

    if (assetsError) {
      console.error("Error fetching assets:", assetsError);
      throw assetsError;
    }

    if (!assets || assets.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch variants for all assets
    const assetIds = assets.map(a => a.id);
    const { data: variants, error: variantsError } = await supabase
      .from("cmo_content_variants")
      .select("*")
      .in("asset_id", assetIds);

    if (variantsError) {
      console.error("Error fetching variants:", variantsError);
    }

    // Fetch campaign names
    const campaignIds = [...new Set(assets.filter(a => a.campaign_id).map(a => a.campaign_id))] as string[];
    let campaignMap = new Map<string, string>();
    
    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabase
        .from("cmo_campaigns")
        .select("id, campaign_name")
        .in("id", campaignIds);
      
      if (campaigns) {
        campaignMap = new Map(campaigns.map(c => [c.id, c.campaign_name]));
      }
    }

    // Transform to response format
    const landingPages = assets.map(asset => {
      const variant = variants?.find(v => v.asset_id === asset.id);
      let bodyContent: Record<string, unknown> = {};
      const metadata = (variant?.metadata as Record<string, unknown>) || {};
      
      try {
        bodyContent = variant?.body_content ? JSON.parse(variant.body_content) : {};
      } catch (e) {
        console.warn("Failed to parse body_content for asset:", asset.id);
      }

      const isPublished = asset.status === "published";
      const urlSlug = (metadata.urlSlug as string) || (bodyContent.urlSlug as string) || "";
      const formSubmissionConfig = metadata.formSubmissionConfig as Record<string, unknown> | undefined;
      
      // Landing page is auto-wired if it has formSubmissionConfig with tenantId
      const isAutoWired = !!formSubmissionConfig?.tenantId;
      
      return {
        id: asset.id,
        campaignId: asset.campaign_id,
        campaignName: asset.campaign_id ? campaignMap.get(asset.campaign_id) : null,
        templateType: (metadata.templateType as string) || (bodyContent.templateType as string) || "lead_magnet",
        internalName: asset.title,
        urlSlug,
        heroHeadline: variant?.headline || asset.key_message || "",
        heroSubheadline: (bodyContent.heroSubheadline as string) || variant?.subject_line || "",
        heroSupportingPoints: (bodyContent.heroSupportingPoints as string[]) || asset.supporting_points || [],
        sections: (metadata.sections as unknown[]) || (bodyContent.sections as unknown[]) || [],
        primaryCtaLabel: variant?.cta_text || (bodyContent.primaryCtaLabel as string) || asset.cta || "Get Started",
        primaryCtaType: (bodyContent.primaryCtaType as string) || "form",
        formFields: (metadata.formFields as unknown[]) || (bodyContent.formFields as unknown[]) || [],
        published: isPublished,
        status: asset.status,
        url: isPublished && urlSlug 
          ? `https://pages.ubigrowth.ai/${urlSlug}`
          : null,
        autoWired: isAutoWired,
        formSubmissionConfig: isAutoWired ? formSubmissionConfig : null,
        createdAt: asset.created_at,
        variantId: variant?.id,
      };
    });

    console.log(`Returning ${landingPages.length} landing pages`);

    return new Response(JSON.stringify(landingPages), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in ai-cmo-landing-pages-list:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
