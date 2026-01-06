import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DomainRecord {
  record: string;
  name: string;
  type: string;
  ttl: string;
  status: string;
  value: string;
  priority?: number;
}

interface ResendDomain {
  id: string;
  name: string;
  status: "not_started" | "pending" | "verified" | "failed" | "temporary_failure";
  created_at: string;
  region: string;
  records: DomainRecord[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, action, tenantId } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ error: "Domain is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client for updating email settings
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Helper function to activate email when domain is verified
    async function activateEmailIfVerified(verified: boolean, tenant?: string) {
      if (verified && tenant) {
        const { error } = await supabase
          .from("ai_settings_email")
          .update({ 
            is_connected: true,
            updated_at: new Date().toISOString()
          })
          .eq("tenant_id", tenant);
        
        if (error) {
          console.error("Failed to activate email settings:", error);
        } else {
          console.log(`[resend-verify-domain] Activated email for tenant ${tenant}`);
        }
      }
    }

    // Get list of domains from Resend
    const domainsResponse = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
      },
    });

    if (!domainsResponse.ok) {
      const errorText = await domainsResponse.text();
      console.error("Resend API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch domains from Resend", details: errorText }),
        { status: domainsResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domainsData = await domainsResponse.json();
    const domains: ResendDomain[] = domainsData.data || [];

    // Find the domain
    const foundDomain = domains.find(
      (d) => d.name.toLowerCase() === domain.toLowerCase()
    );

    if (!foundDomain) {
      // Domain not added to Resend yet - offer to add it
      if (action === "add") {
        const addResponse = await fetch("https://api.resend.com/domains", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: domain }),
        });

        if (!addResponse.ok) {
          const errorText = await addResponse.text();
          console.error("Failed to add domain:", errorText);
          return new Response(
            JSON.stringify({ error: "Failed to add domain to Resend", details: errorText }),
            { status: addResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const newDomain: ResendDomain = await addResponse.json();
        return new Response(
          JSON.stringify({
            status: "added",
            domain: newDomain.name,
            domainStatus: newDomain.status,
            records: newDomain.records,
            message: "Domain added to Resend. Please add the DNS records shown below.",
            emailActivated: false,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          status: "not_found",
          domain,
          message: "Domain not found in Resend. Click 'Add Domain' to register it.",
          emailActivated: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Domain exists - check if we need to trigger verification
    if (action === "verify" && foundDomain.status !== "verified") {
      const verifyResponse = await fetch(
        `https://api.resend.com/domains/${foundDomain.id}/verify`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
          },
        }
      );

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        console.error("Failed to verify domain:", errorText);
        // Don't return error - just continue to show current status
      }

      // Re-fetch to get updated status
      const updatedResponse = await fetch(
        `https://api.resend.com/domains/${foundDomain.id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
          },
        }
      );

      if (updatedResponse.ok) {
        const updatedDomain: ResendDomain = await updatedResponse.json();
        const isVerified = updatedDomain.status === "verified";
        
        // Activate email sending when domain is verified
        await activateEmailIfVerified(isVerified, tenantId);
        
        return new Response(
          JSON.stringify({
            status: isVerified ? "verified" : "pending",
            domain: updatedDomain.name,
            domainStatus: updatedDomain.status,
            records: updatedDomain.records,
            message: isVerified
              ? "Domain is verified and ready to send emails!"
              : "Verification in progress. DNS records may take up to 48 hours to propagate.",
            emailActivated: isVerified,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if domain is verified and activate email
    const isVerified = foundDomain.status === "verified";
    await activateEmailIfVerified(isVerified, tenantId);

    // Return current status with records
    return new Response(
      JSON.stringify({
        status: isVerified ? "verified" : "pending",
        domain: foundDomain.name,
        domainStatus: foundDomain.status,
        records: foundDomain.records,
        message: isVerified
          ? "Domain is verified and ready to send emails!"
          : foundDomain.status === "pending"
          ? "DNS records found but verification pending. This can take up to 48 hours."
          : `Domain status: ${foundDomain.status}. Please ensure DNS records are configured correctly.`,
        emailActivated: isVerified,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in resend-verify-domain:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});