import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifySvixSignature } from "../_shared/svix-verify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();

    // Verify Resend/Svix webhook signature
    const isValid = await verifySvixSignature({
      req,
      rawBody,
      secretEnv: "RESEND_WEBHOOK_SECRET",
    });

    if (!isValid) {
      console.error("[email-tracking-webhook] Invalid webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const event = JSON.parse(rawBody);
    console.log("[email-tracking-webhook] Event received:", event.type);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Extract lead_id and tenant_id from tags
    const leadId = event.data?.tags?.find(
      (tag: any) => tag.name === "lead_id"
    )?.value;

    const tenantId = event.data?.tags?.find(
      (tag: any) => tag.name === "tenant_id"
    )?.value;

    if (!leadId) {
      console.log("[email-tracking-webhook] No lead_id found in event");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let activityType = "";
    let description = "";

    switch (event.type) {
      case "email.delivered":
        activityType = "email_delivered";
        description = "Outreach email was delivered";
        break;
      case "email.opened":
        activityType = "email_opened";
        description = "Lead opened outreach email";
        break;
      case "email.clicked":
        activityType = "email_clicked";
        description = `Lead clicked link in email: ${event.data?.click?.link || "unknown"}`;
        break;
      case "email.bounced":
        activityType = "email_bounced";
        description = "Email bounced - delivery failed";
        break;
      default:
        console.log("[email-tracking-webhook] Unhandled event type:", event.type);
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Get lead's tenant_id if not provided in tags
    let leadWorkspaceId = tenantId;
    if (!leadWorkspaceId) {
      const { data: lead } = await supabaseClient
        .from("leads")
        .select("tenant_id")
        .eq("id", leadId)
        .single();
      leadWorkspaceId = lead?.tenant_id;
    }

    if (!leadWorkspaceId) {
      console.error("[email-tracking-webhook] Could not determine tenant_id for lead:", leadId);
      return new Response(JSON.stringify({ received: true, error: "Missing tenant_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log activity with tenant_id for RLS compliance
    const { error: activityError } = await supabaseClient
      .from("lead_activities")
      .insert({
        lead_id: leadId,
        tenant_id: leadWorkspaceId,
        activity_type: activityType,
        description: description,
        metadata: {
          email_id: event.data?.email_id,
          timestamp: event.created_at,
          raw_event: event.type,
        },
      });

    if (activityError) {
      console.error("[email-tracking-webhook] Error logging activity:", activityError);
    }

    // Trigger automated lead scoring recalculation for engagement events
    if (event.type === "email.opened" || event.type === "email.clicked") {
      try {
        await supabaseClient.functions.invoke("auto-score-lead", {
          body: { leadId },
        });
        console.log(`[email-tracking-webhook] Triggered auto-scoring for lead ${leadId}`);
      } catch (scoreError) {
        console.error("[email-tracking-webhook] Error triggering auto-score:", scoreError);
      }
    }

    console.log(`[email-tracking-webhook] Tracked ${activityType} for lead ${leadId}`);

    return new Response(JSON.stringify({ received: true, tracked: activityType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[email-tracking-webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
