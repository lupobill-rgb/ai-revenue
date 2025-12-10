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

    // 4. Upsert contact (by tenant_id + email)
    const { data: existingContact } = await supabase
      .from("crm_contacts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", email)
      .single();

    let contactId: string;

    if (existingContact) {
      // Update existing contact
      const { data: updatedContact, error: updateError } = await supabase
        .from("crm_contacts")
        .update({
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          company: formData.company || undefined,
          job_title: formData.role || undefined,
          phone: formData.phone || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingContact.id)
        .select("id")
        .single();

      if (updateError) {
        console.error("[landing-form-submit] Failed to update contact:", updateError);
        throw updateError;
      }
      contactId = updatedContact!.id;
      console.log("[landing-form-submit] Updated existing contact:", contactId);
    } else {
      // Create new contact
      const { data: newContact, error: insertError } = await supabase
        .from("crm_contacts")
        .insert({
          tenant_id: tenantId,
          email,
          first_name: firstName,
          last_name: lastName,
          company: formData.company || null,
          job_title: formData.role || null,
          phone: formData.phone || null,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[landing-form-submit] Failed to create contact:", insertError);
        throw insertError;
      }
      contactId = newContact!.id;
      console.log("[landing-form-submit] Created new contact:", contactId);
    }

    // 5. Create lead tied to campaign
    const campaignId = payload.tracking?.campaignId || landingPage.campaign_id;
    const source = `landing_page:${payload.slug}`;

    // Build UTM tracking metadata
    const trackingMeta: Record<string, string> = {};
    if (payload.tracking?.utm_source) trackingMeta.utm_source = payload.tracking.utm_source;
    if (payload.tracking?.utm_medium) trackingMeta.utm_medium = payload.tracking.utm_medium;
    if (payload.tracking?.utm_campaign) trackingMeta.utm_campaign = payload.tracking.utm_campaign;
    if (payload.tracking?.utm_term) trackingMeta.utm_term = payload.tracking.utm_term;
    if (payload.tracking?.utm_content) trackingMeta.utm_content = payload.tracking.utm_content;

    const { data: lead, error: leadError } = await supabase
      .from("crm_leads")
      .insert({
        tenant_id: tenantId,
        contact_id: contactId,
        campaign_id: campaignId,
        source,
        status: "new",
        score: 0,
        notes: Object.keys(trackingMeta).length > 0 
          ? `UTM: ${JSON.stringify(trackingMeta)}`
          : null,
      })
      .select("id")
      .single();

    if (leadError) {
      console.error("[landing-form-submit] Failed to create lead:", leadError);
      throw leadError;
    }

    console.log("[landing-form-submit] Created lead:", lead!.id);

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
        lead_id: lead!.id,
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
              lead_id: lead!.id,
              source: `landing_page:${payload.slug}`,
              utm: payload.tracking || {},
            },
          },
        }
      );
      if (kernelError) {
        console.warn("[landing-form-submit] Kernel lead router failed:", kernelError);
      } else {
        console.log("[landing-form-submit] Triggered cmo_lead_router for lead:", lead!.id);
      }
    } catch (kernelErr) {
      console.warn("[landing-form-submit] Kernel call error:", kernelErr);
    }

    console.log("[landing-form-submit] Successfully processed form submission");

    return new Response(
      JSON.stringify({
        success: true,
        contact_id: contactId,
        lead_id: lead!.id,
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
