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
    const lowerEmails = emails.map((e) => e.toLowerCase().trim());

    console.log(`[test-email] CRM lookup: workspaceId=${workspaceId}, emails=${JSON.stringify(lowerEmails)}`);

    // Use case-insensitive matching by querying all leads and filtering
    // Also try both with and without workspace filter for debugging
    const { data: leadRows, error } = await supabase
      .from("leads")
      .select(
        "id, email, first_name, last_name, company, industry, job_title, phone, vertical, custom_fields, workspace_id"
      )
      .eq("workspace_id", workspaceId);

    if (error) {
      console.error("[test-email] CRM lookup error:", error);
    }

    console.log(`[test-email] Found ${leadRows?.length || 0} total leads in workspace ${workspaceId}`);

    // Filter leads by email (case-insensitive)
    const matchedLeads = (leadRows || []).filter((l: any) => 
      l?.email && lowerEmails.includes(l.email.toLowerCase().trim())
    );

    console.log(`[test-email] Matched ${matchedLeads.length} leads by email`);

    const leads = new Map<string, any>();
    for (const l of matchedLeads) {
      if (l?.email) leads.set(String(l.email).toLowerCase().trim(), l);
    }

    const valid: string[] = [];
    const missing: string[] = [];
    for (const e of lowerEmails) {
      if (leads.has(e)) {
        valid.push(e);
        console.log(`[test-email] ✓ Found lead for: ${e}`);
      } else {
        missing.push(e);
        console.log(`[test-email] ✗ No lead found for: ${e}`);
      }
    }

    // If emails are missing, log sample emails from the workspace for debugging
    if (missing.length > 0 && leadRows?.length > 0) {
      const sampleEmails = leadRows.slice(0, 5).map((l: any) => l?.email).filter(Boolean);
      console.log(`[test-email] Sample emails in workspace: ${JSON.stringify(sampleEmails)}`);
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
      .select("sender_name, from_address, reply_to_address")
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
    const replyToAddress = emailSettings.reply_to_address || senderAddress;

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

    // Get lead IDs for channel_outbox tracking
    const { data: leadData } = await supabase
      .from("leads")
      .select("id, email")
      .eq("workspace_id", workspaceId)
      .in("email", validRecipients);
    
    const leadIdByEmail = new Map<string, string>();
    for (const lead of leadData || []) {
      if (lead?.email && lead?.id) {
        leadIdByEmail.set(lead.email.toLowerCase(), lead.id);
      }
    }

    // Send to all validated CRM recipients (personalized per recipient)
    const results = await Promise.allSettled(
      validRecipients.map(async (recipient) => {
        const lead = leadByEmail.get(recipient.toLowerCase()) || {};
        const leadId = leadIdByEmail.get(recipient.toLowerCase());
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
            reply_to: replyToAddress,
            to: [recipient],
            subject: `[TEST] ${personalizedSubject}`,
            html: personalizedHtml,
            // Add tracking tags for webhook correlation
            tags: [
              { name: "workspace_id", value: workspaceId },
              ...(leadId ? [{ name: "lead_id", value: leadId }] : []),
              ...(assetId ? [{ name: "asset_id", value: assetId }] : []),
              { name: "test_email", value: "true" },
            ],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`[test-email] Resend error for ${recipient}:`, errorData);
          throw new Error(errorData.message || `Failed to send to ${recipient}`);
        }

        const result = await response.json();
        
        // Create channel_outbox record for webhook tracking
        if (result.id) {
          const { error: outboxError } = await supabase
            .from("channel_outbox")
            .insert({
              tenant_id: workspaceId,
              workspace_id: workspaceId,
              channel: "email",
              provider: "resend",
              recipient_id: leadId || null,
              recipient_email: recipient,
              payload: {
                subject: personalizedSubject,
                test_email: true,
                asset_id: assetId,
              },
              status: "sent",
              provider_message_id: result.id,
              provider_response: result,
            });
          
          if (outboxError) {
            console.error(`[test-email] Failed to create outbox record:`, outboxError);
          } else {
            console.log(`[test-email] Created outbox record for ${recipient}, provider_message_id: ${result.id}`);
          }
        }

        return { recipient, response: result };
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    const failureMessages = failed.map((r) => {
      const reason = (r as PromiseRejectedResult).reason;
      return reason instanceof Error ? reason.message : String(reason);
    });

    console.log(`[test-email] Sent: ${successful.length}, Failed: ${failed.length}`);

    // If nothing was sent, bubble up as a hard error so the UI doesn't look like it succeeded.
    if (successful.length === 0 && failed.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            failureMessages.find((m) => m.toLowerCase().includes("domain is not verified")) ||
            "All test emails failed to send. Please verify your email integration settings.",
          details: failureMessages,
          recipients: validRecipients,
          from: `${senderName} <${senderAddress}>`,
          subject: `[TEST] ${emailSubject}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: failed.length === 0,
        sentCount: successful.length,
        failedCount: failed.length,
        failureMessages,
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
