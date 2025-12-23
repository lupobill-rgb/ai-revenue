import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate idempotency key using SHA-256
async function generateIdempotencyKey(parts: string[]): Promise<string> {
  const data = parts.filter(Boolean).join("|");
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Function to replace personalization tags with actual lead data
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
    const { assetId, segmentCodes, scheduledAt } = await req.json();
    const isScheduled = !!scheduledAt;

    if (!assetId) {
      throw new Error("Asset ID is required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Service client for channel_outbox writes (bypasses RLS)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch the asset details
    const { data: asset, error: assetError } = await supabaseClient
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      throw new Error("Asset not found");
    }

    if (asset.type !== "email") {
      throw new Error("Asset must be of type 'email'");
    }

    if (asset.status !== "approved" && asset.status !== "live") {
      throw new Error("Asset must be approved before deployment");
    }

    // Fetch user and tenant settings
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    // Settings are now keyed by workspace_id (tenant-scoped)
    const workspaceId: string | null = asset.workspace_id || null;




    // Fetch email settings from ai_settings_email
    let fromAddress = "onboarding@resend.dev";
    let replyToAddress = "noreply@resend.dev";
    let senderName = "Marketing Team";

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

    // Fallback: Fetch business profile for sender name if not configured
    if (senderName === "Marketing Team" && user) {
      const { data: profile } = await supabaseClient
        .from("business_profiles")
        .select("business_name")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (profile?.business_name) {
        senderName = profile.business_name;
      }
    }

    // Extract email content from asset
    const emailContent = asset.content as any;
    const subjectTemplate = emailContent?.subject || asset.name;
    const htmlBodyTemplate = emailContent?.html || emailContent?.body || "";
    
    // Get recipients from explicit list or from linked CRM leads
    let recipientList = emailContent?.recipients || [];
    let targetLeads = emailContent?.target_leads || [];
    
    // If no explicit recipients, use email addresses from linked CRM leads
    if (recipientList.length === 0 && targetLeads.length > 0) {
      recipientList = targetLeads
        .filter((lead: any) => lead.email)
        .map((lead: any) => lead.email);
      console.log(`Using ${recipientList.length} emails from linked CRM leads`);
    }

    // If still no recipients, fetch leads from the workspace with email addresses
    // Filter by segment codes if provided
    if (recipientList.length === 0 && asset.workspace_id) {
      const hasSegmentFilter = segmentCodes && Array.isArray(segmentCodes) && segmentCodes.length > 0;
      console.log(`No recipients specified, fetching leads from workspace ${asset.workspace_id}${hasSegmentFilter ? ` with segments: ${segmentCodes.join(', ')}` : ''}`);
      
      let leadsQuery = supabaseClient
        .from("leads")
        .select("id, first_name, last_name, email, company, industry, job_title, phone, status, segment_code")
        .eq("workspace_id", asset.workspace_id)
        .not("email", "is", null)
        .in("status", ["new", "contacted", "qualified"]); // Only send to active leads
      
      // Apply segment filter if provided
      if (hasSegmentFilter) {
        leadsQuery = leadsQuery.in("segment_code", segmentCodes);
      }
      
      const { data: workspaceLeads, error: leadsError } = await leadsQuery;

      if (leadsError) {
        console.error("Error fetching workspace leads:", leadsError);
      } else if (workspaceLeads && workspaceLeads.length > 0) {
        targetLeads = workspaceLeads;
        recipientList = workspaceLeads
          .filter((lead: any) => lead.email)
          .map((lead: any) => lead.email);
        console.log(`Found ${recipientList.length} leads with emails in workspace${hasSegmentFilter ? ` (filtered by ${segmentCodes.length} segment(s))` : ''}`);
      }
    }

    if (!recipientList.length) {
      throw new Error("No recipients found - add leads to your CRM with email addresses first");
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Find existing campaign or create new one
    let campaign;
    const { data: existingCampaign } = await supabaseClient
      .from("campaigns")
      .select("*")
      .eq("asset_id", assetId)
      .eq("channel", "email")
      .single();

    if (existingCampaign) {
      // Update existing campaign
      const { data: updatedCampaign, error: updateError } = await supabaseClient
        .from("campaigns")
        .update({
          status: "deploying",
          deployed_at: new Date().toISOString(),
          target_audience: { recipients: recipientList },
        })
        .eq("id", existingCampaign.id)
        .select()
        .single();

      if (updateError) {
        throw new Error("Failed to update campaign record");
      }
      campaign = updatedCampaign;
    } else {
      // Create new campaign if none exists
      const { data: newCampaign, error: campaignError } = await supabaseClient
        .from("campaigns")
        .insert({
          asset_id: assetId,
          channel: "email",
          status: "deploying",
          deployed_at: new Date().toISOString(),
          workspace_id: asset.workspace_id,
          target_audience: { recipients: recipientList },
        })
        .select()
        .single();

      if (campaignError || !newCampaign) {
        console.error("Failed to create campaign:", campaignError);
        throw new Error("Failed to create campaign record");
      }
      campaign = newCampaign;
    }

    // Handle scheduled vs immediate send
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let scheduledCount = 0;
    const sentMessages: Array<{ email: string; messageId: string }> = [];
    
    // If scheduled, just queue the emails without sending
    if (isScheduled) {
      console.log(`Scheduling ${recipientList.length} emails for ${scheduledAt}`);
    }
    
    // Derive tenantId for channel_outbox
    const tenantId = workspaceId || user?.id || "unknown";
    
    // Process each recipient with personalization
    const emailPromises = recipientList.map(async (recipientEmail: string) => {
      try {
        // Find the lead data for this recipient
        const linkedLead = targetLeads.find((lead: any) => lead.email === recipientEmail);
        const leadId = linkedLead?.id || null;
        
        // Generate idempotency key
        const idempotencyKey = await generateIdempotencyKey([
          campaign.id,
          leadId || recipientEmail,
          assetId,
          new Date().toISOString().slice(0, 10), // Daily uniqueness
        ]);
        
        // IDEMPOTENCY: Insert outbox entry BEFORE provider call with status 'queued' or 'scheduled'
        const outboxStatus = isScheduled ? "scheduled" : "queued";
        const { data: insertedOutbox, error: insertError } = await serviceClient
          .from("channel_outbox")
          .insert({
            tenant_id: tenantId,
            workspace_id: workspaceId,
            channel: "email",
            provider: "resend",
            recipient_id: leadId,
            recipient_email: recipientEmail,
            payload: { 
              campaign_id: campaign.id, 
              asset_id: assetId,
              subject: subjectTemplate,
              html_body: htmlBodyTemplate,
              from_address: fromAddress,
              reply_to: replyToAddress,
              sender_name: senderName,
            },
            status: outboxStatus,
            scheduled_at: isScheduled ? scheduledAt : null,
            idempotency_key: idempotencyKey,
            skipped: false,
          })
          .select("id")
          .single();
        
        // If insert failed due to unique constraint (idempotent replay), skip
        if (insertError) {
          if (insertError.code === "23505") { // Unique violation
            console.log(`[email-deploy] Idempotent skip for ${recipientEmail} - already in outbox`);
            await serviceClient
              .from("channel_outbox")
              .update({ skipped: true, skip_reason: "idempotent_replay" })
              .eq("tenant_id", tenantId)
              .eq("workspace_id", workspaceId)
              .eq("idempotency_key", idempotencyKey);
            skippedCount++;
            return;
          }
          console.error(`[email-deploy] Failed to insert outbox for ${recipientEmail}:`, insertError);
          failedCount++;
          return;
        }
        
        const outboxId = insertedOutbox?.id;
        
        // If scheduled, we're done - the cron job will send later
        if (isScheduled) {
          scheduledCount++;
          console.log(`Scheduled email for ${recipientEmail} at ${scheduledAt}`);
          return;
        }
        
        // Personalize subject and body with lead data
        const personalizedSubject = personalizeContent(subjectTemplate, linkedLead || { email: recipientEmail });
        const personalizedBody = personalizeContent(htmlBodyTemplate, linkedLead || { email: recipientEmail });
        
        console.log(`Sending personalized email to ${recipientEmail} from ${senderName}`);
        
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${senderName} <${fromAddress}>`,
            reply_to: replyToAddress,
            to: [recipientEmail],
            subject: personalizedSubject,
            html: personalizedBody,
            tags: [
              { name: "campaign_id", value: campaign.id },
              { name: "asset_id", value: assetId },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Resend API error for ${recipientEmail}:`, response.status, errorText);
          
          // Update outbox with failure
          await serviceClient
            .from("channel_outbox")
            .update({
              status: "failed",
              error: `Resend API error: ${response.status} - ${errorText}`,
            })
            .eq("id", outboxId);
          
          failedCount++;
          return;
        }
        
        const result = await response.json();
        console.log(`Email sent successfully to ${recipientEmail}, provider_message_id: ${result.id}`);
        
        // Update outbox with success and provider_message_id (E1 requirement)
        await serviceClient
          .from("channel_outbox")
          .update({
            status: "sent",
            provider_message_id: result.id,
            provider_response: result,
          })
          .eq("id", outboxId);
        
        sentCount++;
        sentMessages.push({ email: recipientEmail, messageId: result.id });
        
        // Log lead activity if this email came from a linked lead
        if (linkedLead && linkedLead.id) {
          try {
            await supabaseClient.from('lead_activities').insert({
              lead_id: linkedLead.id,
              activity_type: 'email_sent',
              description: `Email campaign sent: ${personalizedSubject}`,
              created_by: user?.id,
              metadata: { 
                campaignId: campaign.id, 
                assetId, 
                subject: personalizedSubject,
                resendId: result.id,
                provider_message_id: result.id,
              },
            });
          } catch (e) {
            console.error('Failed to log lead activity:', e);
          }
        }
      } catch (error) {
        console.error(`Failed to send to ${recipientEmail}:`, error);
        failedCount++;
      }
    });

    await Promise.all(emailPromises);

    // Update or create metrics record
    const { data: existingMetrics } = await supabaseClient
      .from("campaign_metrics")
      .select("*")
      .eq("campaign_id", campaign.id)
      .single();

    if (existingMetrics) {
      // Update existing metrics
      await supabaseClient
        .from("campaign_metrics")
        .update({
          sent_count: sentCount,
          delivered_count: 0, // Will be updated via webhook
          open_count: 0,
          clicks: 0,
          bounce_count: failedCount,
          last_synced_at: new Date().toISOString(),
        })
        .eq("campaign_id", campaign.id);
    } else {
      // Create new metrics if none exist
      await supabaseClient.from("campaign_metrics").insert({
        campaign_id: campaign.id,
        workspace_id: asset.workspace_id,
        sent_count: sentCount,
        delivered_count: 0,
        open_count: 0,
        clicks: 0,
        bounce_count: failedCount,
      });
    }

    // Update campaign status based on whether scheduled or immediate
    if (isScheduled) {
      await supabaseClient
        .from("campaigns")
        .update({ status: "scheduled" })
        .eq("id", campaign.id);
      console.log(`Email campaign scheduled: ${scheduledCount} emails queued for ${scheduledAt}`);
    } else {
      await supabaseClient
        .from("campaigns")
        .update({ status: sentCount > 0 ? "active" : "failed" })
        .eq("id", campaign.id);

      // Update asset status to live
      if (sentCount > 0) {
        await supabaseClient
          .from("assets")
          .update({ status: "live" })
          .eq("id", assetId);
      }

      console.log(`Email campaign deployed: ${sentCount} sent, ${failedCount} failed, ${skippedCount} skipped`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaignId: campaign.id,
        sentCount,
        failedCount,
        skippedCount,
        scheduledCount,
        scheduledAt: isScheduled ? scheduledAt : null,
        // E1 proof: Return provider_message_ids for verification
        sentMessages: sentMessages.slice(0, 10), // First 10 for logging
        message: isScheduled 
          ? `Successfully scheduled ${scheduledCount} emails for ${new Date(scheduledAt).toLocaleString()}`
          : `Successfully sent ${sentCount} personalized emails${skippedCount > 0 ? ` (${skippedCount} skipped as duplicates)` : ""}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in email-deploy function:", error);
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
