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
    const { leadId, subject, body, templateId } = await req.json();

    if (!leadId || !subject || !body) {
      throw new Error("Lead ID, subject, and body are required");
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

    // Get tenant_id from workspace
    const { data: workspace } = await supabaseClient
      .from("workspaces")
      .select("owner_id")
      .eq("id", lead.workspace_id)
      .single();

    const tenantId = workspace?.owner_id;

    // Fetch email settings from ai_settings_email
    // Default to Resend sandbox for testing if no settings configured
    let fromAddress = "onboarding@resend.dev";
    let replyToAddress = "noreply@resend.dev";
    let senderName = "UbiGrowth";

    if (tenantId) {
      const { data: emailSettings } = await supabaseClient
        .from("ai_settings_email")
        .select("from_address, reply_to_address, sender_name")
        .eq("tenant_id", tenantId)
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
          tags: [
            { name: "lead_id", value: leadId },
            { name: "template_id", value: templateId || "custom" },
          ],
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

    // Log activity
    const { data: { user } } = await supabaseClient.auth.getUser();
    await supabaseClient.from("lead_activities").insert({
      lead_id: leadId,
      activity_type: "email_sent",
      description: `Outreach email sent: ${subject}`,
      created_by: user?.id,
      metadata: { 
        emailId: emailResult.id, 
        subject, 
        templateId: templateId || "custom" 
      },
    });

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
