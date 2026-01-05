import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Expected CNAME target for custom domains
const EXPECTED_CNAME_TARGET = "campaigns.ubigrowth.ai";

interface DnsRecord {
  type: number;
  TTL: number;
  data: string;
}

interface DnsResponse {
  Status: number;
  Answer?: DnsRecord[];
  Authority?: DnsRecord[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, tenantId } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ error: "Domain is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Verifying DNS for domain: ${domain}`);

    // Use Google's DNS-over-HTTPS to lookup CNAME records
    // This is a reliable way to check DNS from the server side
    const dnsUrl = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=CNAME`;
    
    const dnsResponse = await fetch(dnsUrl, {
      headers: {
        "Accept": "application/dns-json",
      },
    });

    if (!dnsResponse.ok) {
      console.error("DNS lookup failed:", await dnsResponse.text());
      return new Response(
        JSON.stringify({ 
          verified: false,
          error: "DNS lookup failed",
          message: "Unable to query DNS records. Please try again later."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dnsData: DnsResponse = await dnsResponse.json();
    console.log("DNS response:", JSON.stringify(dnsData));

    // Check if there are CNAME records pointing to our target
    let verified = false;
    let foundCname = "";
    let statusMessage = "";

    if (dnsData.Status === 0 && dnsData.Answer) {
      // Find CNAME record (type 5)
      const cnameRecord = dnsData.Answer.find((record) => record.type === 5);
      
      if (cnameRecord) {
        foundCname = cnameRecord.data.replace(/\.$/, ""); // Remove trailing dot
        console.log(`Found CNAME: ${foundCname}`);
        
        // Check if it points to our expected target
        if (foundCname.toLowerCase() === EXPECTED_CNAME_TARGET.toLowerCase()) {
          verified = true;
          statusMessage = `✓ Domain verified! CNAME correctly points to ${EXPECTED_CNAME_TARGET}`;
        } else {
          statusMessage = `CNAME record found but points to ${foundCname} instead of ${EXPECTED_CNAME_TARGET}`;
        }
      } else {
        // Check if there's an A record (sometimes CNAME is resolved to A)
        const aRecord = dnsData.Answer.find((record) => record.type === 1);
        if (aRecord) {
          statusMessage = `Found A record (${aRecord.data}) but no CNAME. Please add a CNAME record pointing to ${EXPECTED_CNAME_TARGET}`;
        } else {
          statusMessage = `No CNAME record found. Please add a CNAME record pointing to ${EXPECTED_CNAME_TARGET}`;
        }
      }
    } else if (dnsData.Status === 3) {
      // NXDOMAIN - domain doesn't exist
      statusMessage = `Domain ${domain} not found in DNS. Please check if the domain is configured correctly.`;
    } else {
      statusMessage = `No DNS records found. Please add a CNAME record pointing to ${EXPECTED_CNAME_TARGET}`;
    }

    // If verified and tenantId provided, update the database
    if (verified && tenantId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { error: updateError } = await supabase
        .from("ai_settings_domain")
        .update({ 
          cname_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq("tenant_id", tenantId);

      if (updateError) {
        console.error("Failed to update domain verification status:", updateError);
      } else {
        console.log(`Updated cname_verified=true for tenant ${tenantId}`);
      }
    }

    return new Response(
      JSON.stringify({
        verified,
        domain,
        foundCname,
        expectedCname: EXPECTED_CNAME_TARGET,
        message: statusMessage,
        dnsStatus: dnsData.Status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in verify-domain-dns:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message, verified: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
