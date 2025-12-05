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

    // Fetch business profile to get sender name
    const { data: { user } } = await supabaseClient.auth.getUser();
    let senderName = "Marketing Team";
    
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

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Send email via Resend with tracking enabled
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${senderName} <steve@brainsurgeryteam.com>`,
        reply_to: "sblaising@brainsurgeryinc.com",
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

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to send email: ${errorData.message || response.status}`);
    }

    const emailResult = await response.json();

    // Log activity
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

    console.log(`Email sent to ${lead.email} from ${senderName}`);

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
