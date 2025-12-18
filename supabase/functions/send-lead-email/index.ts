import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Refresh Gmail access token if expired
async function refreshGmailToken(
  serviceClient: any,
  userId: string,
  refreshToken: string
): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    console.error("Token refresh failed:", tokenData);
    throw new Error("Failed to refresh Gmail token");
  }

  const { access_token, expires_in } = tokenData;
  const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  // Update token in database
  await serviceClient
    .from("user_gmail_tokens")
    .update({
      access_token,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return access_token;
}

// Send email via Gmail API
async function sendViaGmail(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ id: string }> {
  // Create RFC 2822 formatted email
  const emailLines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    htmlBody,
  ];

  const email = emailLines.join("\r\n");

  // Base64url encode the email
  const encodedEmail = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedEmail }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Gmail API error:", errorData);
    throw new Error(`Gmail API error: ${errorData.error?.message || response.status}`);
  }

  const result = await response.json();
  return { id: result.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, subject, body, templateId, campaignId, sendVia } = await req.json();

    if (!leadId || !subject || !body) {
      throw new Error("Lead ID, subject, and body are required");
    }

    // User client for auth validation
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Service role client for internal operations (activity logging)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch the lead details
    const { data: lead, error: leadError } = await supabaseClient
      .from("leads")
      .select("*, workspace_id")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error("Lead not found");
    }

    if (!lead.email) {
      throw new Error("Lead has no email address");
    }

    // Settings are now keyed by workspace_id (tenant-scoped)
    const workspaceId = lead.workspace_id as string;

    // Get current user (needed for Gmail and activity logging)
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    console.log("sendVia:", sendVia, "user:", user?.id || "null", "userError:", userError?.message || "none");

    let emailResult: { id: string };
    let fromAddress = "onboarding@resend.dev";
    let senderName = "UbiGrowth";
    let actualSendVia = sendVia || "resend";

    // Handle Gmail sending - only if user is authenticated and explicitly requested
    if (actualSendVia === "gmail" && user) {
      // Fetch user's Gmail tokens
      const { data: gmailToken, error: gmailError } = await serviceClient
        .from("user_gmail_tokens")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (gmailError || !gmailToken) {
        throw new Error("Gmail account not connected. Please connect your Gmail account in Settings > Integrations.");
      }

      let accessToken = gmailToken.access_token;

      // Check if token is expired
      const tokenExpiresAt = new Date(gmailToken.token_expires_at);
      if (tokenExpiresAt <= new Date()) {
        console.log("Gmail token expired, refreshing...");
        accessToken = await refreshGmailToken(
          serviceClient,
          user.id,
          gmailToken.refresh_token
        );
      }

      // Send via Gmail API
      emailResult = await sendViaGmail(
        accessToken,
        gmailToken.email,
        lead.email,
        subject,
        body
      );

      fromAddress = gmailToken.email;
      senderName = gmailToken.email.split("@")[0];

      console.log(`Email sent via Gmail from ${fromAddress} to ${lead.email}`);
    } else {
      // Fall back to Resend if Gmail requested but user not authenticated
      if (actualSendVia === "gmail" && !user) {
        console.warn("Gmail requested but user not authenticated, falling back to Resend");
        actualSendVia = "resend";
      }

      // Send via Resend (default)
      let replyToAddress = "noreply@resend.dev";

      if (workspaceId) {
        const { data: emailSettings } = await supabaseClient
          .from("ai_settings_email")
          .select("from_address, reply_to_address, sender_name")
          .eq("tenant_id", workspaceId)
          .maybeSingle();

        if (emailSettings) {
          if (emailSettings.from_address) fromAddress = emailSettings.from_address;
          if (emailSettings.reply_to_address) replyToAddress = emailSettings.reply_to_address;
          if (emailSettings.sender_name) senderName = emailSettings.sender_name;
        }
      }

      // Fallback: Fetch business profile for sender name if not in email settings
      if (!senderName || senderName === "Stephen M. Blaising") {
        if (workspaceId) {
          const { data: profile } = await supabaseClient
            .from("business_profiles")
            .select("business_name")
            .eq("workspace_id", workspaceId)
            .maybeSingle();
          
          if (profile?.business_name) {
            senderName = profile.business_name;
          }
        }
      }

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        throw new Error("RESEND_API_KEY not configured");
      }

      // Build tags for Resend - include all IDs needed for webhook tracking
      const emailTags = [
        { name: "lead_id", value: leadId },
        { name: "workspace_id", value: lead.workspace_id },
        { name: "template_id", value: templateId || "custom" },
      ];
      
      // Add campaign_id if provided - required for campaign_metrics updates via webhooks
      if (campaignId) {
        emailTags.push({ name: "campaign_id", value: campaignId });
      }

      // Send email via Resend with tracking enabled
      const sendEmail = async (fromAddr: string) => {
        return await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${senderName} <${fromAddr}>`,
            reply_to: replyToAddress,
            to: [lead.email],
            subject: subject,
            html: body,
            tags: emailTags,
            headers: {
              "X-Entity-Ref-ID": leadId,
            },
          }),
        });
      };

      // Attempt 1: tenant-configured sender
      let response = await sendEmail(fromAddress);

      // If sender domain isn't authorized in Resend, fall back to Resend sandbox sender for testing
      if (!response.ok) {
        let errorText = "";
        try {
          const errorData = await response.json();
          errorText = String(errorData?.message || response.status);
        } catch {
          errorText = String(response.status);
        }

        const notAuthorized =
          (response.status === 403 || errorText.toLowerCase().includes("not authorized")) &&
          (errorText.toLowerCase().includes("not authorized to send emails from") ||
            errorText.toLowerCase().includes("not authorized"));

        console.warn(
          `Resend send attempt failed: status=${response.status} from=${fromAddress} msg=${errorText}`
        );

        if (notAuthorized) {
          console.warn(
            `Sender domain not authorized for from=${fromAddress}. Falling back to onboarding@resend.dev.`
          );
          fromAddress = "onboarding@resend.dev";
          response = await sendEmail(fromAddress);
        } else {
          throw new Error(`Failed to send email: ${errorText}`);
        }
      }

      if (!response.ok) {
        // If fallback also failed, surface the error
        let errorText = "";
        try {
          const errorData = await response.json();
          errorText = String(errorData?.message || response.status);
        } catch {
          errorText = String(response.status);
        }
        throw new Error(`Failed to send email: ${errorText}`);
      }

      emailResult = await response.json();
      console.log(`Email sent via Resend from ${senderName} <${fromAddress}> to ${lead.email}`);
    }

    // Log activity using service role (bypasses RLS for internal audit logging)
    const { error: activityError } = await serviceClient.from("lead_activities").insert({
      lead_id: leadId,
      workspace_id: lead.workspace_id,
      activity_type: "email_sent",
      description: `Outreach email sent: ${subject}`,
      created_by: user?.id || null,
      metadata: {
        emailId: emailResult.id,
        subject,
        templateId: templateId || "custom",
        campaignId: campaignId || null,
        from: actualSendVia === "gmail" ? fromAddress : `${senderName} <${fromAddress}>`,
        to: lead.email,
        sendVia: actualSendVia,
      },
    });

    if (activityError) {
      console.error("Failed to log lead_activities email_sent:", activityError);
    } else {
      console.log("Activity logged successfully for lead:", leadId);
    }

    // Determine campaign_id - use provided one or find/create default CRM campaign
    let effectiveCampaignId = campaignId;
    
    if (!effectiveCampaignId) {
      // Look for existing default CRM campaign for this workspace
      const { data: existingCampaign } = await serviceClient
        .from("campaigns")
        .select("id")
        .eq("workspace_id", lead.workspace_id)
        .eq("channel", "email")
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      
      if (existingCampaign) {
        effectiveCampaignId = existingCampaign.id;
      } else {
        // Create a default "CRM Manual Outreach" campaign
        // First we need an asset
        const { data: defaultAsset } = await serviceClient
          .from("assets")
          .select("id")
          .eq("workspace_id", lead.workspace_id)
          .eq("type", "email")
          .limit(1)
          .single();
        
        if (defaultAsset) {
          const { data: newCampaign } = await serviceClient
            .from("campaigns")
            .insert({
              workspace_id: lead.workspace_id,
              asset_id: defaultAsset.id,
              channel: "email",
              status: "active",
            })
            .select("id")
            .single();
          
          if (newCampaign) {
            effectiveCampaignId = newCampaign.id;
            // Create initial metrics record
            await serviceClient.from("campaign_metrics").insert({
              campaign_id: newCampaign.id,
              workspace_id: lead.workspace_id,
              sent_count: 0,
              delivered_count: 0,
            });
          }
        }
      }
    }

    // Update campaign metrics
    if (effectiveCampaignId) {
      const { data: existingMetrics } = await serviceClient
        .from("campaign_metrics")
        .select("id, sent_count, delivered_count")
        .eq("campaign_id", effectiveCampaignId)
        .single();

      if (existingMetrics) {
        // Increment sent_count and delivered_count (optimistic - Resend has ~99% delivery)
        await serviceClient
          .from("campaign_metrics")
          .update({ 
            sent_count: (existingMetrics.sent_count || 0) + 1,
            delivered_count: (existingMetrics.delivered_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("campaign_id", effectiveCampaignId);
        console.log("Updated campaign_metrics sent+delivered for campaign:", effectiveCampaignId);
      } else {
        // Create new metrics record
        await serviceClient
          .from("campaign_metrics")
          .insert({
            campaign_id: effectiveCampaignId,
            workspace_id: lead.workspace_id,
            sent_count: 1,
            delivered_count: 1,
          });
        console.log("Created campaign_metrics record for campaign:", effectiveCampaignId);
      }
    }

    // Update lead status if new
    if (lead.status === "new") {
      await supabaseClient
        .from("leads")
        .update({ 
          status: "contacted",
          last_contacted_at: new Date().toISOString()
        })
        .eq("id", leadId);
    } else {
      await supabaseClient
        .from("leads")
        .update({ last_contacted_at: new Date().toISOString() })
        .eq("id", leadId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailId: emailResult.id,
        recipient: lead.email,
        sentVia: actualSendVia,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-lead-email function:", error);
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
