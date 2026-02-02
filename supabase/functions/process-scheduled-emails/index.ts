import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Function to replace personalization tags with actual lead data
function personalizeContent(content: string, lead: any): string {
  if (!content || !lead) return content;
  
  const location = lead.location || lead.city || lead.address || 
    (lead.custom_fields?.location) || "";
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
    console.log("[process-scheduled-emails] Starting scheduled email processing");
    
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Fetch scheduled emails that are due (scheduled_at <= now)
    const now = new Date().toISOString();
    const { data: scheduledEmails, error: fetchError } = await serviceClient
      .from("channel_outbox")
      .select("*")
      .eq("status", "scheduled")
      .eq("channel", "email")
      .lte("scheduled_at", now)
      .limit(100); // Process in batches

    if (fetchError) {
      console.error("[process-scheduled-emails] Error fetching scheduled emails:", fetchError);
      throw new Error("Failed to fetch scheduled emails");
    }

    if (!scheduledEmails || scheduledEmails.length === 0) {
      console.log("[process-scheduled-emails] No scheduled emails to process");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No scheduled emails due" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-scheduled-emails] Found ${scheduledEmails.length} emails to send`);

    let sentCount = 0;
    let failedCount = 0;

    for (const outbox of scheduledEmails) {
      try {
        const payload = outbox.payload as any;
        const recipientEmail = outbox.recipient_email;
        
        // Fetch lead data for personalization if we have a recipient_id
        let leadData: any = { email: recipientEmail };
        if (outbox.recipient_id) {
          const { data: lead } = await serviceClient
            .from("leads")
            .select("*")
            .eq("id", outbox.recipient_id)
            .single();
          if (lead) {
            leadData = lead;
          }
        }

        // Personalize content
        const personalizedSubject = personalizeContent(payload.subject || "No Subject", leadData);
        const personalizedBody = personalizeContent(payload.html_body || "", leadData);
        
        const fromAddress = payload.from_address || "onboarding@resend.dev";
        const replyTo = payload.reply_to || fromAddress;
        const senderName = payload.sender_name || "Marketing Team";

        console.log(`[process-scheduled-emails] Sending to ${recipientEmail}`);

        // Send via Resend
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${senderName} <${fromAddress}>`,
            reply_to: replyTo,
            to: [recipientEmail],
            subject: personalizedSubject,
            html: personalizedBody,
            tags: [
              { name: "campaign_id", value: payload.campaign_id || "unknown" },
              { name: "asset_id", value: payload.asset_id || "unknown" },
              { name: "scheduled", value: "true" },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[process-scheduled-emails] Resend error for ${recipientEmail}:`, errorText);
          
          await serviceClient
            .from("channel_outbox")
            .update({
              status: "failed",
              error: `Resend API error: ${response.status} - ${errorText}`,
            })
            .eq("id", outbox.id);
          
          failedCount++;
          continue;
        }

        const result = await response.json();
        console.log(`[process-scheduled-emails] Sent to ${recipientEmail}, id: ${result.id}`);

        // Update outbox to sent
        await serviceClient
          .from("channel_outbox")
          .update({
            status: "sent",
            provider_message_id: result.id,
            provider_response: result,
          })
          .eq("id", outbox.id);

        sentCount++;

        // Log lead activity if we have a lead
        if (outbox.recipient_id) {
          try {
            await serviceClient.from("lead_activities").insert({
              lead_id: outbox.recipient_id,
              tenant_id: outbox.tenant_id,
              activity_type: "email_sent",
              description: `Scheduled email sent: ${personalizedSubject}`,
              metadata: {
                campaign_id: payload.campaign_id,
                asset_id: payload.asset_id,
                resendId: result.id,
                scheduled: true,
              },
            });
          } catch (e) {
            console.error("[process-scheduled-emails] Failed to log lead activity:", e);
          }
        }
      } catch (err) {
        console.error(`[process-scheduled-emails] Error processing outbox ${outbox.id}:`, err);
        failedCount++;
      }
    }

    // Update campaign metrics if we have sent emails
    const campaignIds = [...new Set(scheduledEmails.map(e => (e.payload as any)?.campaign_id).filter(Boolean))];
    for (const campaignId of campaignIds) {
      const { data: metrics } = await serviceClient
        .from("campaign_metrics")
        .select("*")
        .eq("campaign_id", campaignId)
        .single();

      if (metrics) {
        const sentInThisBatch = scheduledEmails.filter(e => (e.payload as any)?.campaign_id === campaignId).length;
        await serviceClient
          .from("campaign_metrics")
          .update({
            sent_count: (metrics.sent_count || 0) + sentInThisBatch,
            last_synced_at: new Date().toISOString(),
          })
          .eq("campaign_id", campaignId);
      }
    }

    console.log(`[process-scheduled-emails] Complete: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: scheduledEmails.length,
        sentCount,
        failedCount,
        message: `Processed ${scheduledEmails.length} scheduled emails: ${sentCount} sent, ${failedCount} failed`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[process-scheduled-emails] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
