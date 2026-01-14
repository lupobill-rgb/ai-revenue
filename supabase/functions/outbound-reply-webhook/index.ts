import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySvixSignature } from "../_shared/svix-verify.ts";
import { openaiChatCompletionsRaw } from "../_shared/providers/openai.ts";

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

// Forward reply to configured email using Resend API
async function forwardReplyEmail(
  toEmail: string,
  fromName: string,
  originalFrom: string,
  subject: string,
  textContent: string
): Promise<boolean> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.log("[outbound-reply-webhook] No RESEND_API_KEY configured, skipping forward");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CRM Notifications <noreply@updates.ubigrowth.ai>",
        to: [toEmail],
        subject: `[Reply Received] ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1DA4FF;">New Reply from ${fromName}</h2>
            <p><strong>From:</strong> ${originalFrom}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;" />
            <div style="background: #f9f9f9; padding: 15px; border-radius: 5px;">
              <pre style="white-space: pre-wrap; font-family: inherit;">${textContent}</pre>
            </div>
            <hr style="border: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">This reply was automatically forwarded from your CRM.</p>
          </div>
        `,
      }),
    });

    if (response.ok) {
      console.log(`[outbound-reply-webhook] Reply forwarded to ${toEmail}`);
      return true;
    } else {
      const errorData = await response.text();
      console.error(`[outbound-reply-webhook] Failed to forward reply: ${errorData}`);
      return false;
    }
  } catch (error) {
    console.error("[outbound-reply-webhook] Error forwarding reply:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();
    
    // Verify Svix/Resend webhook signature
    const isValid = await verifySvixSignature({
      req,
      rawBody,
      secretEnv: "RESEND_WEBHOOK_SECRET",
    });

    if (!isValid) {
      console.error("[outbound-reply-webhook] Invalid webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawPayload = JSON.parse(rawBody);
    
    // Handle Resend standard webhook format (wrapped in type/data)
    // vs direct Resend Inbound format
    let payload: InboundReplyPayload;
    
    if (rawPayload.type && rawPayload.data) {
      // Standard Resend webhook - check if it's an inbound email
      if (rawPayload.type !== "email.received") {
        // Not an inbound email, ignore (these should go to email-webhook)
        console.log(`[outbound-reply-webhook] Ignoring event type: ${rawPayload.type}`);
        return new Response(JSON.stringify({ status: "ignored", type: rawPayload.type }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Extract from Resend Inbound format
      payload = {
        from: rawPayload.data.from,
        to: Array.isArray(rawPayload.data.to) ? rawPayload.data.to[0] : rawPayload.data.to,
        subject: rawPayload.data.subject,
        text: rawPayload.data.text,
        html: rawPayload.data.html,
        received_at: rawPayload.data.created_at,
      };
    } else {
      // Direct format (legacy)
      payload = rawPayload;
    }
    
    console.log(`[outbound-reply-webhook] Received reply from: ${payload.from}`);

    const senderEmail = payload.from?.toLowerCase();
    
    if (!senderEmail) {
      console.log("[outbound-reply-webhook] No sender email in payload, ignoring");
      return new Response(JSON.stringify({ status: "no_sender" }), {
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

    // Get tenant's email settings to find forward address
    const { data: emailSettings } = await supabase
      .from("ai_settings_email")
      .select("reply_to_address")
      .eq("tenant_id", prospect.tenant_id)
      .single();

    const forwardToEmail = emailSettings?.reply_to_address;

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
      
      // Still forward the reply even if no active sequence
      if (forwardToEmail && payload.text) {
        await forwardReplyEmail(
          forwardToEmail,
          `${prospect.first_name} ${prospect.last_name}`,
          payload.from,
          payload.subject || "No subject",
          payload.text
        );
      }
      
      return new Response(JSON.stringify({ status: "no_active_run", forwarded: !!forwardToEmail }), {
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

    // Forward reply to configured email address
    let forwarded = false;
    if (forwardToEmail && payload.text) {
      forwarded = await forwardReplyEmail(
        forwardToEmail,
        `${prospect.first_name} ${prospect.last_name}`,
        payload.from,
        payload.subject || "No subject",
        payload.text
      );
    }

    // Optionally trigger reply suggestion agent
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
    let replySuggestion = null;

    if (OPENAI_API_KEY && payload.text) {
      try {
        const aiResponse = await openaiChatCompletionsRaw(
          {
            model,
            messages: [
              {
                role: "system",
                content:
                  "You are a sales reply assistant. Given a prospect's reply, suggest a brief, helpful response. Keep it conversational and focused on next steps. Return JSON: { \"suggested_reply\": \"...\", \"sentiment\": \"positive|neutral|negative\", \"next_action\": \"book_call|send_info|follow_up|close\" }",
              },
              {
                role: "user",
                content: `Prospect ${prospect.first_name} replied:\n\n${payload.text}\n\nSuggest a response.`,
              },
            ],
          },
          OPENAI_API_KEY,
        );

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
      forwarded,
      forward_to: forwardToEmail,
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
