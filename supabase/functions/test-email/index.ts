import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  recipients: string[];
  subject: string;
  body: string;
  workspaceId: string;
  assetId?: string;
  // Legacy support
  to?: string;
  fromName?: string;
  fromAddress?: string;
}

// Function to replace personalization tags with actual lead data (matches email-deploy)
function personalizeContent(content: string, lead: any): string {
  if (!content || !lead) return content;
  
  // Handle location from multiple possible sources
  const location = lead.location || lead.city || lead.address || 
    (lead.custom_fields?.location) || "";
  
  // Handle industry from multiple sources  
  const industry = lead.industry || lead.vertical || 
    (lead.custom_fields?.industry) || "";
  
  const replacements: Record<string, string> = {
    "{{first_name}}": lead.first_name || lead.name?.split(" ")[0] || "there",
    "{{last_name}}": lead.last_name || lead.name?.split(" ").slice(1).join(" ") || "",
    "{{full_name}}": lead.name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "there",
    "{{company}}": lead.company || "your company",
    "{{email}}": lead.email || "",
    "{{location}}": location,
    "{{industry}}": industry,
    "{{title}}": lead.title || lead.job_title || "",
    "{{phone}}": lead.phone || "",
  };

  let personalizedContent = content;
  for (const [tag, value] of Object.entries(replacements)) {
    personalizedContent = personalizedContent.replace(new RegExp(tag.replace(/[{}]/g, "\\$&"), "gi"), value);
  }
  
  return personalizedContent;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: TestEmailRequest = await req.json();
    const { recipients, subject, body, workspaceId, assetId, to, fromName, fromAddress } = requestData;

    // Validate workspaceId
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: "workspaceId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Support both new array format and legacy single 'to' format
    let emailList: string[] = [];
    if (recipients && Array.isArray(recipients)) {
      emailList = recipients.filter(e => e && typeof e === 'string' && e.includes('@'));
    } else if (to) {
      emailList = [to];
    }

    if (emailList.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid email recipients provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (emailList.length > 20) {
      return new Response(
        JSON.stringify({ error: "Maximum 20 test recipients allowed" }),
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

    // Initialize Supabase client to fetch workspace email settings
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch workspace email settings
    const { data: emailSettings, error: settingsError } = await supabase
      .from("ai_settings_email")
      .select("sender_name, from_address")
      .eq("tenant_id", workspaceId)
      .maybeSingle();

    if (settingsError) {
      console.error("[test-email] Error fetching email settings:", settingsError);
    }

    // Use workspace settings, fall back to provided values or defaults
    let senderName = emailSettings?.sender_name || fromName || "UbiGrowth";
    let senderAddress = emailSettings?.from_address || fromAddress || "onboarding@resend.dev";

    // Validate that we have a proper from address (not the resend default unless no settings)
    if (!emailSettings?.from_address && senderAddress === "onboarding@resend.dev") {
      console.warn("[test-email] No custom email domain configured, using Resend default");
    }

    const emailSubject = subject || "Test Email";
    let emailBody = body || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Test Email</h1>
        <p>This is a test email to verify your email configuration.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      </div>
    `;

    // Fetch a sample lead from CRM for personalization preview
    let sampleLead: any = null;
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("id, first_name, last_name, name, email, company, industry, job_title, phone, location, city, custom_fields")
      .eq("workspace_id", workspaceId)
      .not("first_name", "is", null)
      .limit(1);

    if (!leadsError && leads && leads.length > 0) {
      sampleLead = leads[0];
      console.log(`[test-email] Using sample lead for personalization: ${sampleLead.first_name} ${sampleLead.last_name || ""}`);
    } else {
      console.log("[test-email] No leads found in CRM, using default personalization fallbacks");
    }

    // Personalize subject and body with sample lead data
    const personalizedSubject = personalizeContent(emailSubject, sampleLead || {});
    const personalizedBody = personalizeContent(emailBody, sampleLead || {});

    console.log(`[test-email] Sending to ${emailList.length} recipient(s) from ${senderName} <${senderAddress}>`);
    console.log(`[test-email] Workspace: ${workspaceId}, Asset: ${assetId || 'N/A'}`);
    console.log(`[test-email] Subject: ${personalizedSubject}`);
    console.log(`[test-email] HTML body length: ${personalizedBody.length} chars`);

    // Send to all recipients
    const results = await Promise.allSettled(
      emailList.map(async (recipient) => {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${senderName} <${senderAddress}>`,
            to: [recipient],
            subject: `[TEST] ${personalizedSubject}`,
            html: personalizedBody,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error(`[test-email] Resend error for ${recipient}:`, errorData);
          throw new Error(errorData.message || `Failed to send to ${recipient}`);
        }
        
        return { recipient, response: await response.json() };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    console.log(`[test-email] Sent: ${successful.length}, Failed: ${failed.length}`);

    if (failed.length > 0) {
      failed.forEach((f, i) => {
        if (f.status === 'rejected') {
          console.error(`[test-email] Failed:`, f.reason);
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        sentCount: successful.length,
        failedCount: failed.length,
        recipients: emailList,
        from: `${senderName} <${senderAddress}>`,
        subject: `[TEST] ${personalizedSubject}`,
        personalizedWith: sampleLead ? `${sampleLead.first_name || ""} ${sampleLead.last_name || ""}`.trim() : "default values",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[test-email] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
