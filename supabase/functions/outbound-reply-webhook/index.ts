import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Inbound email reply payload (from email parsing service)
interface InboundReplyPayload {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  in_reply_to?: string; // Original email ID
  references?: string[];
  received_at?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: InboundReplyPayload = await req.json();
    console.log(`[outbound-reply-webhook] Received reply from: ${payload.from}`);

    const senderEmail = payload.from?.toLowerCase();
    
    if (!senderEmail) {
      return new Response(JSON.stringify({ error: "Missing sender email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find prospect by email
    const { data: prospect, error: prospectError } = await supabase
      .from("prospects")
      .select("id, tenant_id, first_name, last_name")
      .ilike("email", senderEmail)
      .single();

    if (prospectError || !prospect) {
      console.log(`[outbound-reply-webhook] No prospect found for email: ${senderEmail}`);
      return new Response(JSON.stringify({ status: "no_prospect" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find active sequence run for this prospect
    const { data: sequenceRun, error: runError } = await supabase
      .from("outbound_sequence_runs")
      .select("id, sequence_id, last_step_sent")
      .eq("prospect_id", prospect.id)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (runError || !sequenceRun) {
      console.log(`[outbound-reply-webhook] No active sequence run for prospect: ${prospect.id}`);
      return new Response(JSON.stringify({ status: "no_active_run" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the last sent step
    const { data: lastStep } = await supabase
      .from("outbound_sequence_steps")
      .select("id")
      .eq("sequence_id", sequenceRun.sequence_id)
      .eq("step_order", sequenceRun.last_step_sent)
      .single();

    // Log reply event
    const { error: eventError } = await supabase.from("outbound_message_events").insert({
      tenant_id: prospect.tenant_id,
      sequence_run_id: sequenceRun.id,
      step_id: lastStep?.id,
      event_type: "replied",
      channel: "email",
      metadata: {
        from: payload.from,
        subject: payload.subject,
        text_preview: payload.text?.substring(0, 500),
        in_reply_to: payload.in_reply_to,
      },
      occurred_at: payload.received_at || new Date().toISOString(),
    });

    if (eventError) {
      console.error("[outbound-reply-webhook] Error inserting reply event:", eventError);
      throw eventError;
    }

    // Pause sequence on reply (prospect engaged)
    await supabase
      .from("outbound_sequence_runs")
      .update({ status: "paused" })
      .eq("id", sequenceRun.id);

    console.log(`[outbound-reply-webhook] Reply logged for ${prospect.first_name} ${prospect.last_name}, sequence paused`);

    // Optionally trigger reply suggestion agent
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let replySuggestion = null;

    if (LOVABLE_API_KEY && payload.text) {
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { 
                role: "system", 
                content: "You are a sales reply assistant. Given a prospect's reply, suggest a brief, helpful response. Keep it conversational and focused on next steps. Return JSON: { \"suggested_reply\": \"...\", \"sentiment\": \"positive|neutral|negative\", \"next_action\": \"book_call|send_info|follow_up|close\" }" 
              },
              { 
                role: "user", 
                content: `Prospect ${prospect.first_name} replied:\n\n${payload.text}\n\nSuggest a response.` 
              },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            replySuggestion = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
          } catch (e) {
            replySuggestion = { suggested_reply: content };
          }
        }
      } catch (aiError) {
        console.error("[outbound-reply-webhook] AI suggestion error:", aiError);
      }
    }

    return new Response(JSON.stringify({ 
      status: "ok",
      prospect_id: prospect.id,
      sequence_run_id: sequenceRun.id,
      action: "sequence_paused",
      reply_suggestion: replySuggestion,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[outbound-reply-webhook] Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
