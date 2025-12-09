import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

// Resend webhook events we care about
type ResendEventType = "email.sent" | "email.delivered" | "email.opened" | "email.clicked" | "email.bounced" | "email.complained";

interface ResendWebhookPayload {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook payload
    const payload: ResendWebhookPayload = await req.json();
    console.log(`[outbound-email-webhook] Received event: ${payload.type}`, payload.data?.email_id);

    // Map Resend event types to our event types
    const eventTypeMap: Record<string, string> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.opened": "opened",
      "email.clicked": "clicked",
      "email.bounced": "bounced",
      "email.complained": "complained",
    };

    const eventType = eventTypeMap[payload.type];
    if (!eventType) {
      console.log(`[outbound-email-webhook] Ignoring event type: ${payload.type}`);
      return new Response(JSON.stringify({ status: "ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailId = payload.data?.email_id;
    const recipientEmail = payload.data?.to?.[0];

    if (!emailId && !recipientEmail) {
      return new Response(JSON.stringify({ error: "Missing email_id or recipient" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the original message event by email_id in metadata
    const { data: existingEvents, error: findError } = await supabase
      .from("outbound_message_events")
      .select("id, tenant_id, sequence_run_id, step_id, metadata")
      .eq("event_type", "sent")
      .eq("channel", "email");

    if (findError) {
      console.error("[outbound-email-webhook] Error finding events:", findError);
    }

    // Find matching event by email_id in metadata
    const matchingEvent = existingEvents?.find((e: any) => 
      e.metadata?.email_id === emailId || e.metadata?.to === recipientEmail
    );

    if (!matchingEvent) {
      console.log(`[outbound-email-webhook] No matching outbound event found for email: ${emailId || recipientEmail}`);
      return new Response(JSON.stringify({ status: "no_match" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert new event
    const { error: insertError } = await supabase.from("outbound_message_events").insert({
      tenant_id: matchingEvent.tenant_id,
      sequence_run_id: matchingEvent.sequence_run_id,
      step_id: matchingEvent.step_id,
      event_type: eventType,
      channel: "email",
      metadata: {
        email_id: emailId,
        original_event_id: matchingEvent.id,
        resend_payload: payload,
      },
      occurred_at: payload.created_at || new Date().toISOString(),
    });

    if (insertError) {
      console.error("[outbound-email-webhook] Error inserting event:", insertError);
      throw insertError;
    }

    console.log(`[outbound-email-webhook] Logged ${eventType} event for sequence_run ${matchingEvent.sequence_run_id}`);

    return new Response(JSON.stringify({ 
      status: "ok",
      event_type: eventType,
      sequence_run_id: matchingEvent.sequence_run_id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[outbound-email-webhook] Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
