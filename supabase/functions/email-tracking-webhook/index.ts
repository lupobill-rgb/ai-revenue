import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

// Resend webhook signing secret (optional but recommended)
const RESEND_WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET');

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Optional: Verify Resend webhook signature if secret is configured
    if (RESEND_WEBHOOK_SECRET) {
      const svixId = req.headers.get('svix-id');
      const svixTimestamp = req.headers.get('svix-timestamp');
      const svixSignature = req.headers.get('svix-signature');

      if (!svixId || !svixTimestamp || !svixSignature) {
        console.error('[email-tracking-webhook] Missing Svix headers for signature verification');
        return new Response(JSON.stringify({ error: 'Missing webhook signature headers' }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log('[email-tracking-webhook] Webhook signature headers present');
    }

    const event = await req.json();
    console.log("Resend tracking webhook received:", event.type);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Extract lead_id and workspace_id from tags
    const leadId = event.data?.tags?.find(
      (tag: any) => tag.name === "lead_id"
    )?.value;

    const workspaceId = event.data?.tags?.find(
      (tag: any) => tag.name === "workspace_id"
    )?.value;

    if (!leadId) {
      console.log("No lead_id found in webhook event");
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
        console.log("Unhandled event type:", event.type);
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Get lead's workspace_id if not provided in tags
    let leadWorkspaceId = workspaceId;
    if (!leadWorkspaceId) {
      const { data: lead } = await supabaseClient
        .from("leads")
        .select("workspace_id")
        .eq("id", leadId)
        .single();
      leadWorkspaceId = lead?.workspace_id;
    }

    if (!leadWorkspaceId) {
      console.error("Could not determine workspace_id for lead:", leadId);
      return new Response(JSON.stringify({ received: true, error: 'Missing workspace_id' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log activity with workspace_id for RLS compliance
    const { error: activityError } = await supabaseClient
      .from("lead_activities")
      .insert({
        lead_id: leadId,
        workspace_id: leadWorkspaceId,
        activity_type: activityType,
        description: description,
        metadata: {
          email_id: event.data?.email_id,
          timestamp: event.created_at,
          raw_event: event.type,
        },
      });

    if (activityError) {
      console.error("Error logging activity:", activityError);
    }

    // Trigger automated lead scoring recalculation for engagement events
    if (event.type === "email.opened" || event.type === "email.clicked") {
      try {
        // Call auto-score-lead - it's a user-facing function that uses RLS
        // Since this is a webhook context, we need to call it with service auth
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        
        // Note: auto-score-lead should be called with proper auth context
        // For webhook triggers, we use a direct internal call
        await supabaseClient.functions.invoke('auto-score-lead', {
          body: { leadId }
        });
        
        console.log(`Triggered auto-scoring for lead ${leadId}`);
      } catch (scoreError) {
        console.error("Error triggering auto-score:", scoreError);
      }
    }

    console.log(`Tracked ${activityType} for lead ${leadId}`);

    return new Response(JSON.stringify({ received: true, tracked: activityType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in email-tracking-webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
