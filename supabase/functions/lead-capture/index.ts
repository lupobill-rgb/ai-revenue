import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifyHmacSignature } from "../_shared/webhook.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ubigrowth-signature, x-ubigrowth-timestamp",
};

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
      workspaceId: string;
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
    };

    const {
      workspaceId,
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
    } = body;

    // Validate required fields
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: workspaceId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify workspace exists
    const { data: workspace, error: wsError } = await supabaseClient
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .single();

    if (wsError || !workspace) {
      console.error("[lead-capture] Invalid workspace:", workspaceId);
      return new Response(
        JSON.stringify({ error: "Invalid workspace" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check workspace form password (if configured)
    const { data: passOk, error: passError } = await supabaseClient.rpc(
      "check_workspace_form_password",
      {
        _workspace_id: workspaceId,
        _password: password ?? "",
      }
    );

    if (passError || !passOk) {
      console.error("[lead-capture] Invalid form password for workspace:", workspaceId);
      return new Response(
        JSON.stringify({ error: "Invalid form password" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if lead already exists in this workspace
    const { data: existingLead } = await supabaseClient
      .from("leads")
      .select("id")
      .eq("email", email)
      .eq("workspace_id", workspaceId)
      .single();

    if (existingLead) {
      // Update existing lead
      const { data, error } = await supabaseClient
        .from("leads")
        .update({
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          company: company || null,
          job_title: jobTitle || null,
          vertical: vertical || null,
          utm_source: utmSource || null,
          utm_medium: utmMedium || null,
          utm_campaign: utmCampaign || null,
          landing_page_url: landingPageUrl || null,
          custom_fields: customFields || {},
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingLead.id)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabaseClient.from("lead_activities").insert({
        lead_id: existingLead.id,
        workspace_id: workspaceId,
        activity_type: "note",
        description: `Lead updated via landing page form`,
        metadata: { landing_page_url: landingPageUrl },
      });

      console.log(`[lead-capture] Lead updated: ${email} in workspace ${workspaceId}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          leadId: existingLead.id,
          message: "Lead updated successfully" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Calculate vertical-specific lead score
    let score = 40; // Base score
    const companySize = customFields?.companySize || customFields?.company_size || '';
    
    // Vertical-specific scoring logic
    const verticalScoring: Record<string, (l: any) => number> = {
      'hotels_resorts': (l) => {
        let s = 0;
        if (l.jobTitle?.toLowerCase().includes('general manager') || l.jobTitle?.toLowerCase().includes('revenue manager')) s += 25;
        if (l.companySize === 'large' || l.companySize === 'enterprise') s += 20;
        if (l.customFields?.rooms && parseInt(l.customFields.rooms) > 100) s += 15;
        return s;
      },
      'multifamily_real_estate': (l) => {
        let s = 0;
        if (l.jobTitle?.toLowerCase().includes('property manager') || l.jobTitle?.toLowerCase().includes('leasing director')) s += 25;
        if (l.customFields?.units && parseInt(l.customFields.units) > 200) s += 20;
        if (l.companySize === 'large' || l.companySize === 'enterprise') s += 15;
        return s;
      },
      'pickleball_country_clubs': (l) => {
        let s = 0;
        if (l.jobTitle?.toLowerCase().includes('club manager') || l.jobTitle?.toLowerCase().includes('membership director')) s += 25;
        if (l.customFields?.members && parseInt(l.customFields.members) > 500) s += 20;
        if (l.companySize === 'medium' || l.companySize === 'large') s += 15;
        return s;
      },
      'entertainment_venues': (l) => {
        let s = 0;
        if (l.jobTitle?.toLowerCase().includes('venue manager') || l.jobTitle?.toLowerCase().includes('event director')) s += 25;
        if (l.customFields?.capacity && parseInt(l.customFields.capacity) > 1000) s += 20;
        if (l.companySize === 'medium' || l.companySize === 'large') s += 15;
        return s;
      },
      'physical_therapy': (l) => {
        let s = 0;
        if (l.jobTitle?.toLowerCase().includes('clinic director') || l.jobTitle?.toLowerCase().includes('practice owner')) s += 25;
        if (l.customFields?.clinics && parseInt(l.customFields.clinics) > 3) s += 20;
        if (l.companySize === 'medium' || l.companySize === 'large') s += 15;
        return s;
      },
      'corporate_coworking': (l) => {
        let s = 0;
        if (l.jobTitle?.toLowerCase().includes('facilities manager') || l.jobTitle?.toLowerCase().includes('operations director')) s += 25;
        if (l.customFields?.sqft && parseInt(l.customFields.sqft) > 20000) s += 20;
        if (l.companySize === 'large' || l.companySize === 'enterprise') s += 15;
        return s;
      },
      'education': (l) => {
        let s = 0;
        if (l.jobTitle?.toLowerCase().includes('dean') || l.jobTitle?.toLowerCase().includes('director') || l.jobTitle?.toLowerCase().includes('superintendent')) s += 25;
        if (l.customFields?.students && parseInt(l.customFields.students) > 1000) s += 20;
        if (l.companySize === 'large' || l.companySize === 'enterprise') s += 15;
        return s;
      },
      'gyms': (l) => {
        let s = 0;
        if (l.jobTitle?.toLowerCase().includes('owner') || l.jobTitle?.toLowerCase().includes('general manager')) s += 25;
        if (l.customFields?.members && parseInt(l.customFields.members) > 500) s += 20;
        if (l.customFields?.locations && parseInt(l.customFields.locations) > 1) s += 15;
        return s;
      }
    };
    
    // Apply vertical-specific scoring
    if (vertical && verticalScoring[vertical]) {
      score += verticalScoring[vertical]({ jobTitle, companySize, customFields });
    }
    
    // Universal scoring factors
    if (jobTitle && (jobTitle.toLowerCase().includes('director') || 
        jobTitle.toLowerCase().includes('manager') || 
        jobTitle.toLowerCase().includes('vp') || 
        jobTitle.toLowerCase().includes('ceo') ||
        jobTitle.toLowerCase().includes('owner'))) {
      score += 15;
    }
    
    if (companySize === 'enterprise' || companySize === 'large') {
      score += 10;
    }
    
    if (phone) {
      score += 10;
    }
    
    // Cap score at 100
    score = Math.min(score, 100);

    // Create new lead with workspace_id
    const { data, error } = await supabaseClient
      .from("leads")
      .insert({
        workspace_id: workspaceId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        company: company || null,
        job_title: jobTitle || null,
        source: "landing_page",
        status: "new",
        score,
        vertical: vertical || null,
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null,
        landing_page_url: landingPageUrl || null,
        custom_fields: customFields || {},
      })
      .select()
      .single();

    if (error) throw error;

    // Log initial activity with workspace_id
    await supabaseClient.from("lead_activities").insert({
      lead_id: data.id,
      workspace_id: workspaceId,
      activity_type: "note",
      description: `New lead captured via landing page form`,
      metadata: { 
        landing_page_url: landingPageUrl,
        initial_score: score 
      },
    });

    console.log(`[lead-capture] New lead captured: ${email} (Score: ${score}) in workspace ${workspaceId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        leadId: data.id,
        message: "Lead created successfully" 
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
