import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, subject, body, templateId, campaignId } = await req.json();

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




    // Fetch email settings from ai_settings_email
    // Default to Resend sandbox for testing if no settings configured
    let fromAddress = "onboarding@resend.dev";
    let replyToAddress = "noreply@resend.dev";
    let senderName = "UbiGrowth";

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
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        const { data: profile } = await supabaseClient
          .from("business_profiles")
          .select("business_name")
          .eq("user_id", user.id)
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

    const emailResult = await response.json();

    // Log activity using service role (bypasses RLS for internal audit logging)
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { error: activityError } = await serviceClient.from("lead_activities").insert({
      lead_id: leadId,
      workspace_id: lead.workspace_id,
      activity_type: "email_sent",
      description: `Outreach email sent: ${subject}`,
      created_by: user?.id,
      metadata: {
        emailId: emailResult.id,
        subject,
        templateId: templateId || "custom",
        campaignId: campaignId || null,
        from: `${senderName} <${fromAddress}>`,
        to: lead.email,
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

    console.log(`Email sent to ${lead.email} from ${senderName} <${fromAddress}>`);

    return new Response(
      JSON.stringify({
        success: true,
        emailId: emailResult.id,
        recipient: lead.email,
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
