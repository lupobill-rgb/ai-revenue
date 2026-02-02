import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifyHmacSignature } from "../_shared/webhook.ts";
import { checkRateLimits, rateLimitResponse, getClientIp } from "../_shared/rate-limit.ts";
import { ingestKernelEvent } from "../_shared/revenue_os_kernel/runtime.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ubigrowth-signature, x-ubigrowth-timestamp",
};

// Rate limit config: 60/min, 500/hour, 2000/day
const RATE_LIMIT_CONFIG = { perMinute: 60, perHour: 500, perDay: 2000 };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();

    // Verify HMAC signature
    const isValid = await verifyHmacSignature({
      req,
      rawBody,
      headerName: "x-ubigrowth-signature",
      secretEnv: "LEAD_CAPTURE_WEBHOOK_SECRET",
      timestampHeader: "x-ubigrowth-timestamp",
      toleranceMs: 5 * 60 * 1000,
    });

    if (!isValid) {
      console.error("[lead-capture] Invalid or missing webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = JSON.parse(rawBody) as {
      tenantId: string;
      tenantId?: string; // Support both tenantId and tenantId
      password?: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      company?: string;
      jobTitle?: string;
      vertical?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      landingPageUrl?: string;
      customFields?: Record<string, unknown>;
      campaignId?: string;
      landingPageSlug?: string;
    };

    const {
      tenantId,
      tenantId,
      password,
      firstName,
      lastName,
      email,
      phone,
      company,
      jobTitle,
      vertical,
      utmSource,
      utmMedium,
      utmCampaign,
      landingPageUrl,
      customFields,
      campaignId,
      landingPageSlug,
    } = body;

    // Use tenantId if provided, otherwise fall back to tenantId
    const effectiveTenantId = tenantId || tenantId;

    // Validate required fields
    if (!effectiveTenantId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: tenantId or tenantId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Rate limiting per tenant + IP
    const clientIp = getClientIp(req);
    const rateLimitResult = await checkRateLimits(
      supabaseClient,
      "lead-capture",
      effectiveTenantId,
      clientIp,
      RATE_LIMIT_CONFIG
    );
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult, corsHeaders);
    }

    if (!firstName || !lastName || !email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: firstName, lastName, email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check tenant form password (if tenantId provided and password configured)
    if (tenantId) {
      const { data: passOk, error: passError } = await supabaseClient.rpc(
        "check_tenant_form_password",
        {
          _tenant_id: tenantId,
          _password: password ?? "",
        }
      );

      if (passError || !passOk) {
        console.error("[lead-capture] Invalid form password for tenant:", tenantId);
        return new Response(
          JSON.stringify({ error: "Invalid form password" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Build source with landing page slug for automation matching
    const leadSource = landingPageSlug 
      ? `landing_page:${landingPageSlug}` 
      : "landing_page";

    // Use centralized RPC for contact/lead upsert (CRM spine)
    const { data: result, error: rpcError } = await supabaseClient.rpc(
      "crm_upsert_contact_and_lead",
      {
        in_tenant_id: effectiveTenantId,
        in_email: email.toLowerCase().trim(),
        in_phone: phone || null,
        in_first_name: firstName || null,
        in_last_name: lastName || null,
        in_company: company || null,
        in_job_title: jobTitle || null,
        in_campaign_id: campaignId || null,
        in_source: leadSource,
      }
    );

    if (rpcError || !result || result.length === 0) {
      console.error("[lead-capture] RPC crm_upsert_contact_and_lead failed:", rpcError);
      throw rpcError || new Error("Failed to create contact/lead");
    }

    const contactId = result[0].contact_id;
    const leadId = result[0].lead_id;
    console.log("[lead-capture] Created CRM contact:", contactId, "lead:", leadId);

    // Log activity to crm_activities
    const activityMeta = {
      landing_page_url: landingPageUrl,
      landing_page_slug: landingPageSlug,
      campaign_id: campaignId,
      utm: {
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
      },
      vertical: vertical,
      custom_fields: customFields || {},
    };

    const { error: activityError } = await supabaseClient
      .from("crm_activities")
      .insert({
        tenant_id: effectiveTenantId,
        contact_id: contactId,
        lead_id: leadId,
        activity_type: "landing_form_submit",
        meta: activityMeta,
      });

    if (activityError) {
      console.error("[lead-capture] Failed to log CRM activity:", activityError);
      // Non-blocking - don't throw
    } else {
      console.log("[lead-capture] Logged CRM activity for contact:", contactId);
    }

    // Revenue OS Kernel (events -> decisions -> actions). No direct side effects from module.
    try {
      const kernelRes = await ingestKernelEvent(
        supabaseClient,
        {
        tenant_id: effectiveTenantId,
        type: "lead_captured",
        source: "cmo_campaigns",
        entity_type: "lead",
        entity_id: leadId,
        correlation_id: leadId, // stable trace id for this flow
        payload: {
          contact_id: contactId,
          lead_id: leadId,
          campaign_id: campaignId || null,
          source: leadSource,
          utm: { utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign },
        },
        },
        { mode: "shadow" }
      );
      console.log("[lead-capture] Kernel ingested lead_captured:", kernelRes);
    } catch (kernelErr) {
      console.warn("[lead-capture] Kernel ingest error:", kernelErr);
      // Non-blocking: lead capture must succeed even if kernel fails.
    }

    console.log(`[lead-capture] Successfully captured lead: ${email} for tenant ${effectiveTenantId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        contactId,
        leadId,
        message: "Lead captured successfully" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[lead-capture] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
