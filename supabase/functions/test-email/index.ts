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

  // Handle location from custom_fields or vertical
  const location = lead.vertical || (lead.custom_fields?.location) || (lead.custom_fields?.city) || "";

  // Handle industry from multiple sources
  const industry = lead.industry || lead.vertical || (lead.custom_fields?.industry) || "";

  const replacements: Record<string, string> = {
    "{{first_name}}": lead.first_name || lead.name?.split(" ")[0] || "there",
    "{{last_name}}": lead.last_name || lead.name?.split(" ").slice(1).join(" ") || "",
    "{{full_name}}":
      lead.name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "there",
    "{{company}}": lead.company || "your company",
    "{{email}}": lead.email || "",
    "{{location}}": location,
    "{{industry}}": industry,
    "{{title}}": lead.title || lead.job_title || "",
    "{{phone}}": lead.phone || "",
  };

  let personalizedContent = content;
  for (const [tag, value] of Object.entries(replacements)) {
    personalizedContent = personalizedContent.replace(
      new RegExp(tag.replace(/[{}]/g, "\\$&"), "gi"),
      value
    );
  }

  return personalizedContent;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Utility: ensure all recipients exist in CRM
  const validateRecipientsInCRM = async (
    supabase: any,
    workspaceId: string,
    emails: string[]
  ): Promise<{ valid: string[]; missing: string[]; leads: Map<string, any> }> => {
    const lowerEmails = emails.map((e) => e.toLowerCase());

    const { data: leadRows, error } = await supabase
      .from("leads")
      .select(
        "email, first_name, last_name, company, industry, job_title, phone, vertical, custom_fields"
      )
      .eq("workspace_id", workspaceId)
      .in("email", lowerEmails);

    if (error) {
      console.error("[test-email] CRM lookup error:", error);
    }

    const leads = new Map<string, any>();
    for (const l of leadRows || []) {
      if (l?.email) leads.set(String(l.email).toLowerCase(), l);
    }

    const valid: string[] = [];
    const missing: string[] = [];
    for (const e of lowerEmails) {
      if (leads.has(e)) {
        valid.push(e);
      } else {
        missing.push(e);
      }
    }

    return { valid, missing, leads };
  };

  try {
    const requestData: TestEmailRequest & { provider?: string } = await req.json();
    const { recipients, subject, body, workspaceId, assetId, to, fromName, fromAddress, provider } =
      requestData;

    // Lightweight "provider test" mode (used by Settings → Providers)
    if (provider && (!recipients || recipients.length === 0) && !to) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (provider === "resend") {
        const ok = Boolean(resendApiKey);
        return new Response(
          JSON.stringify({
            success: ok,
            message: ok ? "Resend is configured" : "RESEND_API_KEY is not configured",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: `Provider '${provider}' test is not supported by this endpoint`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      emailList = recipients.filter((e) => e && typeof e === "string" && e.includes("@"));
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

    // Initialize Supabase client (service role) to fetch settings + CRM lead data
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

    console.log(`[test-email] Email settings for workspace ${workspaceId}:`, emailSettings);

    // Use workspace settings - REQUIRE configured email, don't fall back to defaults
    if (!emailSettings?.from_address) {
      return new Response(
        JSON.stringify({ 
          error: "Email integration not configured. Please set up your email address in Settings → Integrations → Email.",
          requiresSetup: true 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const senderName = emailSettings.sender_name || fromName || "Your Team";
    const senderAddress = emailSettings.from_address;

    const emailSubject = subject || "Test Email";
    const rawBody = body || "";

    // Convert plain-text bodies to HTML so newlines/spacing match preview
    const escapeHtml = (input: string) =>
      input
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const looksLikeHtml = /<\w+[\s\S]*>/i.test(rawBody);
    const emailBodyHtml = looksLikeHtml
      ? rawBody
      : `<div style="font-family: Arial, sans-serif; white-space: pre-wrap; line-height: 1.5;">${escapeHtml(
          rawBody
        )}</div>`;

    // Validate all recipients exist in CRM (enforced server-side for all tenants)
    const { valid: validRecipients, missing: missingRecipients, leads: leadByEmail } =
      await validateRecipientsInCRM(supabase, workspaceId, emailList);

    if (missingRecipients.length > 0) {
      console.log(`[test-email] Rejected non-CRM emails: ${missingRecipients.join(", ")}`);
      return new Response(
        JSON.stringify({
          error: `The following email(s) are not in your CRM: ${missingRecipients.join(
            ", "
          )}. Please add them as contacts first.`,
          missingContacts: missingRecipients,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `[test-email] Sending to ${validRecipients.length} CRM recipient(s) from ${senderName} <${senderAddress}> (workspace: ${workspaceId}, asset: ${assetId || "N/A"})`
    );

    // Send to all validated CRM recipients (personalized per recipient)
    const results = await Promise.allSettled(
      validRecipients.map(async (recipient) => {
        const lead = leadByEmail.get(recipient.toLowerCase()) || {};
        const personalizedSubject = personalizeContent(emailSubject, lead);
        const personalizedHtml = personalizeContent(emailBodyHtml, lead);

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${senderName} <${senderAddress}>`,
            to: [recipient],
            subject: `[TEST] ${personalizedSubject}`,
            html: personalizedHtml,
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

    const successful = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    console.log(`[test-email] Sent: ${successful.length}, Failed: ${failed.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        sentCount: successful.length,
        failedCount: failed.length,
        recipients: validRecipients,
        from: `${senderName} <${senderAddress}>`,
        subject: `[TEST] ${emailSubject}`,
        personalizedWith: "per-recipient CRM match",
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
