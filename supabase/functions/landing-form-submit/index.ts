import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FormPayload {
  tenantSlug: string;
  slug: string;
  formData: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    work_email?: string;
    email?: string;
    company?: string;
    role?: string;
    phone?: string;
    [key: string]: string | undefined;
  };
  tracking?: {
    campaignId?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const payload: FormPayload = await req.json();
    console.log("[landing-form-submit] Received payload:", JSON.stringify(payload, null, 2));

    // Validate required fields
    if (!payload.tenantSlug || !payload.slug) {
      console.error("[landing-form-submit] Missing tenantSlug or slug");
      return new Response(
        JSON.stringify({ error: "Missing tenantSlug or slug" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Resolve tenant from os_tenant_registry
    const { data: tenant, error: tenantError } = await supabase
      .from("os_tenant_registry")
      .select("tenant_id, name")
      .eq("slug", payload.tenantSlug)
      .single();

    if (tenantError || !tenant) {
      console.error("[landing-form-submit] Tenant not found:", payload.tenantSlug, tenantError);
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = tenant.tenant_id;
    console.log("[landing-form-submit] Resolved tenant:", tenant.name, tenantId);

    // 2. Resolve landing page
    const { data: landingPage, error: lpError } = await supabase
      .from("landing_pages")
      .select("id, campaign_id, internal_name")
      .eq("tenant_id", tenantId)
      .eq("url_slug", payload.slug)
      .single();

    if (lpError || !landingPage) {
      console.error("[landing-form-submit] Landing page not found:", payload.slug, lpError);
      return new Response(
        JSON.stringify({ error: "Landing page not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[landing-form-submit] Resolved landing page:", landingPage.internal_name);

    // 3. Parse contact data from form
    const formData = payload.formData;
    let firstName = formData.first_name || "";
    let lastName = formData.last_name || "";
    
    // Parse full_name if first/last not provided
    if (formData.full_name && (!firstName || !lastName)) {
      const nameParts = formData.full_name.trim().split(/\s+/);
      firstName = firstName || nameParts[0] || "";
      lastName = lastName || nameParts.slice(1).join(" ") || "";
    }

    const email = (formData.work_email || formData.email || "").toLowerCase().trim();
    
    if (!email) {
      console.error("[landing-form-submit] No email provided");
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("[landing-form-submit] Invalid email format:", email);
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Use centralized RPC for contact/lead upsert
    const campaignId = payload.tracking?.campaignId || landingPage.campaign_id;
    const source = `landing_page:${payload.slug}`;

    const { data: result, error: rpcError } = await supabase.rpc(
      "crm_upsert_contact_and_lead",
      {
        in_tenant_id: tenantId,
        in_email: email,
        in_phone: formData.phone || null,
        in_first_name: firstName || null,
        in_last_name: lastName || null,
        in_company: formData.company || null,
        in_job_title: formData.role || null,
        in_campaign_id: campaignId,
        in_source: source,
      }
    );

    if (rpcError || !result || result.length === 0) {
      console.error("[landing-form-submit] RPC failed:", rpcError);
      throw rpcError || new Error("Failed to create contact/lead");
    }

    const contactId = result[0].contact_id;
    const leadId = result[0].lead_id;
    console.log("[landing-form-submit] Created contact:", contactId, "lead:", leadId);

    // 6. Log activity
    const activityMeta = {
      landing_page_id: landingPage.id,
      landing_page_slug: payload.slug,
      form_data: formData,
      tracking: payload.tracking || {},
    };

    const { error: activityError } = await supabase
      .from("crm_activities")
      .insert({
        tenant_id: tenantId,
        contact_id: contactId,
        lead_id: leadId,
        activity_type: "landing_form_submit",
        meta: activityMeta,
      });

    if (activityError) {
      console.error("[landing-form-submit] Failed to log activity:", activityError);
      // Non-blocking - don't throw
    } else {
      console.log("[landing-form-submit] Logged activity for contact:", contactId);
    }

    // 7. Trigger kernel for next steps (automations, scoring, routing)
    try {
      const { error: kernelError } = await supabase.functions.invoke(
        "cmo-kernel",
        {
          body: {
            agent_name: "cmo_lead_router",
            tenant_id: tenantId,
            campaign_id: campaignId,
            payload: {
              contact_id: contactId,
              lead_id: leadId,
              source: `landing_page:${payload.slug}`,
              utm: payload.tracking || {},
            },
          },
        }
      );
      if (kernelError) {
        console.warn("[landing-form-submit] Kernel lead router failed:", kernelError);
      } else {
        console.log("[landing-form-submit] Triggered cmo_lead_router for lead:", leadId);
      }
    } catch (kernelErr) {
      console.warn("[landing-form-submit] Kernel call error:", kernelErr);
    }

    console.log("[landing-form-submit] Successfully processed form submission");

    return new Response(
      JSON.stringify({
        success: true,
        contact_id: contactId,
        lead_id: leadId,
        message: "Form submitted successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[landing-form-submit] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
