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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
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

    const { campaign_id, draft, publish } = await req.json();
    const tenantId = user.user_metadata?.tenant_id || user.app_metadata?.tenant_id;

    if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!draft) {
      return new Response(JSON.stringify({ error: "Missing draft" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate draft has required fields
    if (!draft.internalName || !draft.urlSlug || !draft.heroHeadline) {
      return new Response(JSON.stringify({ error: "Draft missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine status
    const status = publish ? "published" : "draft";

    // Create the content asset for the landing page
    const { data: asset, error: assetError } = await supabase
      .from("cmo_content_assets")
      .insert({
        tenant_id: tenantId,
        campaign_id: campaign_id || null,
        title: draft.internalName,
        content_type: "landing_page",
        channel: "web",
        status,
        key_message: draft.heroHeadline,
        cta: draft.heroSubheadline,
        supporting_points: draft.heroSupportingPoints,
        funnel_stage: draft.templateType,
        created_by: user.id,
      })
      .select()
      .single();

    if (assetError) {
      console.error("Error creating asset:", assetError);
      return new Response(JSON.stringify({ error: "Failed to save landing page" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create content variant with full landing page data
    const variantData = {
      asset_id: asset.id,
      variant_name: "primary",
      variant_type: draft.templateType,
      headline: draft.heroHeadline,
      body_content: JSON.stringify({
        heroSubheadline: draft.heroSubheadline,
        heroSupportingPoints: draft.heroSupportingPoints,
        sections: draft.sections,
        primaryCtaLabel: draft.primaryCtaLabel,
        primaryCtaType: draft.primaryCtaType,
        formFields: draft.formFields,
        urlSlug: draft.urlSlug,
      }),
      cta_text: draft.primaryCtaLabel,
      metadata: {
        templateType: draft.templateType,
        urlSlug: draft.urlSlug,
        formFields: draft.formFields,
        sections: draft.sections,
      },
    };

    const { error: variantError } = await supabase
      .from("cmo_content_variants")
      .insert(variantData);

    if (variantError) {
      console.error("Error creating variant:", variantError);
      // Don't fail the whole operation, asset is already created
    }

    // Generate the published URL (placeholder - would integrate with hosting layer)
    const baseUrl = Deno.env.get("LANDING_PAGE_BASE_URL") || "https://pages.ubigrowth.ai";
    const publishedUrl = publish ? `${baseUrl}/${draft.urlSlug}` : null;

    // If publishing, create a calendar event
    if (publish) {
      await supabase.from("cmo_calendar_events").insert({
        tenant_id: tenantId,
        title: `Landing Page Published: ${draft.internalName}`,
        event_type: "landing_page_published",
        scheduled_at: new Date().toISOString(),
        asset_id: asset.id,
        campaign_id: campaign_id || null,
        channel: "web",
        status: "completed",
        metadata: {
          url: publishedUrl,
          templateType: draft.templateType,
          urlSlug: draft.urlSlug,
        },
      });
    }

    // Auto-wire the form submission config for lead capture
    // This metadata will be embedded in the rendered page's form
    const formSubmissionConfig = {
      tenantId,
      campaignId: campaign_id || null,
      landingPageSlug: draft.urlSlug,
      landingPageUrl: publishedUrl,
    };

    // Store the form config in the variant metadata for rendering
    await supabase
      .from("cmo_content_variants")
      .update({
        metadata: {
          templateType: draft.templateType,
          urlSlug: draft.urlSlug,
          formFields: draft.formFields,
          sections: draft.sections,
          formSubmissionConfig, // Auto-wired lead capture config
        },
      })
      .eq("asset_id", asset.id);

    console.log(`[landing-pages-save] Auto-wired form submission for slug: ${draft.urlSlug}, campaign: ${campaign_id || 'none'}`);

    // Log agent run
    await supabase.from("agent_runs").insert({
      agent: "landing_page_save",
      tenant_id: tenantId,
      status: "completed",
      input: { draft, publish },
      output: { 
        asset_id: asset.id, 
        status, 
        url: publishedUrl 
      },
    });

    console.log(`Landing page ${publish ? "published" : "saved"} for tenant:`, tenantId);

    return new Response(JSON.stringify({
      id: asset.id,
      url: publishedUrl || "",
      published: publish,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in ai-cmo-landing-pages-save:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
