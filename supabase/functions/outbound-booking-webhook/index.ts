import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Calendar booking payload (from Calendly, Cal.com, etc.)
interface BookingPayload {
  event_type: "booking.created" | "booking.canceled" | "booking.rescheduled";
  invitee_email: string;
  invitee_name?: string;
  event_name?: string;
  scheduled_at?: string;
  duration_minutes?: number;
  meeting_url?: string;
  calendar_event_id?: string;
  source?: string; // "calendly", "cal.com", etc.
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: BookingPayload = await req.json();
    console.log(`[outbound-booking-webhook] Received ${payload.event_type} for: ${payload.invitee_email}`);

    const inviteeEmail = payload.invitee_email?.toLowerCase();
    
    if (!inviteeEmail) {
      return new Response(JSON.stringify({ error: "Missing invitee_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find prospect by email
    const { data: prospect, error: prospectError } = await supabase
      .from("prospects")
      .select("id, tenant_id, first_name, last_name")
      .ilike("email", inviteeEmail)
      .single();

    if (prospectError || !prospect) {
      console.log(`[outbound-booking-webhook] No prospect found for email: ${inviteeEmail}`);
      return new Response(JSON.stringify({ status: "no_prospect" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find any sequence run for this prospect (active or paused)
    const { data: sequenceRun, error: runError } = await supabase
      .from("outbound_sequence_runs")
      .select("id, sequence_id, last_step_sent, status")
      .eq("prospect_id", prospect.id)
      .in("status", ["active", "paused"])
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (runError || !sequenceRun) {
      console.log(`[outbound-booking-webhook] No sequence run for prospect: ${prospect.id}`);
      // Still log the booking even without a sequence
    }

    // Get the last sent step if we have a sequence run
    let lastStepId = null;
    if (sequenceRun) {
      const { data: lastStep } = await supabase
        .from("outbound_sequence_steps")
        .select("id")
        .eq("sequence_id", sequenceRun.sequence_id)
        .eq("step_order", sequenceRun.last_step_sent)
        .single();
      lastStepId = lastStep?.id;
    }

    // Map booking events
    const eventTypeMap: Record<string, string> = {
      "booking.created": "booked",
      "booking.canceled": "booking_canceled",
      "booking.rescheduled": "booking_rescheduled",
    };
    const eventType = eventTypeMap[payload.event_type] || "booked";

    // Log booking event
    if (sequenceRun) {
      const { error: eventError } = await supabase.from("outbound_message_events").insert({
        tenant_id: prospect.tenant_id,
        sequence_run_id: sequenceRun.id,
        step_id: lastStepId,
        event_type: eventType,
        channel: "calendar",
        metadata: {
          invitee_email: payload.invitee_email,
          invitee_name: payload.invitee_name,
          event_name: payload.event_name,
          scheduled_at: payload.scheduled_at,
          duration_minutes: payload.duration_minutes,
          meeting_url: payload.meeting_url,
          calendar_event_id: payload.calendar_event_id,
          source: payload.source,
        },
        occurred_at: new Date().toISOString(),
      });

      if (eventError) {
        console.error("[outbound-booking-webhook] Error inserting booking event:", eventError);
        throw eventError;
      }

      // Mark sequence as completed on successful booking
      if (payload.event_type === "booking.created") {
        await supabase
          .from("outbound_sequence_runs")
          .update({ status: "completed" })
          .eq("id", sequenceRun.id);

        console.log(`[outbound-booking-webhook] Booking logged, sequence ${sequenceRun.id} marked completed`);
      }
    }

    // Update prospect score to max (they booked!)
    if (payload.event_type === "booking.created") {
      await supabase.from("prospect_scores").upsert({
        tenant_id: prospect.tenant_id,
        prospect_id: prospect.id,
        score: 100,
        band: "hot",
        rationale: `Booked meeting: ${payload.event_name || "Call"}`,
        last_scored_at: new Date().toISOString(),
      }, { onConflict: "prospect_id" });
    }

    return new Response(JSON.stringify({ 
      status: "ok",
      prospect_id: prospect.id,
      sequence_run_id: sequenceRun?.id,
      event_type: eventType,
      action: payload.event_type === "booking.created" ? "sequence_completed" : "event_logged",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[outbound-booking-webhook] Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
