import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper to send email via Resend API
async function sendResendEmail(apiKey: string, params: {
  from: string;
  to: string[];
  subject: string;
  html: string;
}): Promise<{ id?: string; error?: string }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const error = await response.text();
    return { error };
  }
  
  const data = await response.json();
  return { id: data.id };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Can be called via cron (internal) or manually (authenticated)
    const internalSecret = req.headers.get("x-internal-secret");
    const authHeader = req.headers.get("Authorization");
    const expectedSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    let supabase;
    let isCron = false;

    // Internal cron call - use service role
    if (internalSecret && internalSecret === expectedSecret) {
      supabase = createClient(supabaseUrl, supabaseServiceKey);
      isCron = true;
    } 
    // Authenticated user call
    else if (authHeader) {
      supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    console.log(`[outbound-dispatch] Starting dispatch run at ${now}, isCron: ${isCron}`);

    // 1. Get all active sequence runs where next_step_due_at <= now
    const { data: dueRuns, error: runsError } = await supabase
      .from("outbound_sequence_runs")
      .select(`
        id,
        tenant_id,
        sequence_id,
        prospect_id,
        last_step_sent,
        next_step_due_at
      `)
      .eq("status", "active")
      .lte("next_step_due_at", now);

    if (runsError) {
      console.error("Error fetching due runs:", runsError);
      throw new Error(`Failed to fetch due runs: ${runsError.message}`);
    }

    console.log(`[outbound-dispatch] Found ${dueRuns?.length || 0} due runs`);

    const results = {
      processed: 0,
      sent_email: 0,
      queued_linkedin: 0,
      errors: 0,
      details: [] as any[],
    };

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    for (const run of dueRuns || []) {
      try {
        // 2. Get the next step
        const nextStepOrder = (run.last_step_sent || 0) + 1;
        
        const { data: step, error: stepError } = await supabase
          .from("outbound_sequence_steps")
          .select(`
            id,
            step_type,
            message_template,
            metadata,
            delay_days,
            sequence_id
          `)
          .eq("sequence_id", run.sequence_id)
          .eq("step_order", nextStepOrder)
          .single();

        if (stepError || !step) {
          // No more steps - mark sequence as completed
          await supabase
            .from("outbound_sequence_runs")
            .update({ status: "completed" })
            .eq("id", run.id);
          
          console.log(`[outbound-dispatch] Run ${run.id} completed (no more steps)`);
          results.details.push({ run_id: run.id, status: "completed" });
          continue;
        }

        // 3. Get sequence channel and prospect info
        const { data: sequence } = await supabase
          .from("outbound_sequences")
          .select("channel, campaign_id")
          .eq("id", run.sequence_id)
          .single();

        const { data: prospect } = await supabase
          .from("prospects")
          .select("first_name, last_name, email, linkedin_url, company, title")
          .eq("id", run.prospect_id)
          .single();

        if (!prospect) {
          console.error(`[outbound-dispatch] Prospect ${run.prospect_id} not found`);
          results.errors++;
          continue;
        }

        const channel = sequence?.channel || "email";
        let messageText = step.message_template;

        // 4. Generate message if not pre-generated
        if (!messageText) {
          console.log(`[outbound-dispatch] Generating message for run ${run.id}, step ${step.id}`);
          
          // Get tenant_id from campaign
          const { data: campaign } = await supabase
            .from("outbound_campaigns")
            .select("tenant_id")
            .eq("id", sequence?.campaign_id)
            .single();

          // Call message-gen function
          const messageGenResponse = await fetch(`${supabaseUrl}/functions/v1/outbound-message-gen`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tenant_id: run.tenant_id,
              tenant_id: campaign?.tenant_id,
              prospect_profile: prospect,
              prospect_insights: {},
              step_context: {
                step_type: step.step_type,
                channel,
                sequence_position: nextStepOrder,
              },
              brand_voice: {
                tone: "smart, no-BS, helpful",
                length_preference: "short",
                avoid: ["hype", "buzzwords"],
              },
              call_to_action: "open to a quick chat?",
              step_id: step.id,
            }),
          });

          if (messageGenResponse.ok) {
            const msgResult = await messageGenResponse.json();
            messageText = msgResult.data?.message_text;
          }
        }

        if (!messageText) {
          console.error(`[outbound-dispatch] No message text for run ${run.id}`);
          results.errors++;
          continue;
        }

        // 5. Dispatch based on channel
        let eventMetadata: any = { step_type: step.step_type };

        if (channel === "email" && prospect.email) {
          if (resendApiKey) {
            try {
              const subjectLine = step.metadata?.subject_line || `Quick question, ${prospect.first_name}`;
              
              const emailResult = await sendResendEmail(resendApiKey, {
                from: "Outbound <outbound@resend.dev>", // TODO: Use tenant's configured from address
                to: [prospect.email],
                subject: subjectLine,
                html: `<p>${messageText.replace(/\n/g, "<br>")}</p>`,
              });

              if (emailResult.error) {
                throw new Error(emailResult.error);
              }

              eventMetadata.email_id = emailResult.id;
              eventMetadata.to = prospect.email;
              results.sent_email++;
              console.log(`[outbound-dispatch] Email sent to ${prospect.email}`);
            } catch (emailError) {
              console.error(`[outbound-dispatch] Email error:`, emailError);
              eventMetadata.error = String(emailError);
              results.errors++;
            }
          } else {
            console.log(`[outbound-dispatch] RESEND_API_KEY not configured, skipping email`);
            eventMetadata.skipped = "no_resend_key";
          }
        } else if (channel === "linkedin") {
          // Queue for manual send (LinkedIn automation requires third-party tools)
          eventMetadata.queued_for_manual = true;
          eventMetadata.linkedin_url = prospect.linkedin_url;
          eventMetadata.message_text = messageText;
          results.queued_linkedin++;
          console.log(`[outbound-dispatch] LinkedIn message queued for ${prospect.linkedin_url}`);
        }

        // 6. Insert message event
        await supabase.from("outbound_message_events").insert({
          tenant_id: run.tenant_id,
          sequence_run_id: run.id,
          step_id: step.id,
          event_type: channel === "linkedin" ? "queued" : "sent",
          channel,
          metadata: eventMetadata,
          occurred_at: now,
        });

        // 7. Calculate next step due time using cadence agent
        let nextDueAt = null;
        const { data: nextStep } = await supabase
          .from("outbound_sequence_steps")
          .select("delay_days")
          .eq("sequence_id", run.sequence_id)
          .eq("step_order", nextStepOrder + 1)
          .single();

        if (nextStep) {
          const cadenceResponse = await fetch(`${supabaseUrl}/functions/v1/outbound-cadence-timing`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tenant_id: run.tenant_id,
              tenant_id: run.tenant_id, // fallback
              last_event_at: now,
              channel,
              delay_days: nextStep.delay_days,
            }),
          });

          if (cadenceResponse.ok) {
            const cadenceResult = await cadenceResponse.json();
            nextDueAt = cadenceResult.data?.next_step_due_at;
          }
        }

        // 8. Update sequence run
        await supabase
          .from("outbound_sequence_runs")
          .update({
            last_step_sent: nextStepOrder,
            next_step_due_at: nextDueAt,
            status: nextDueAt ? "active" : "completed",
          })
          .eq("id", run.id);

        results.processed++;
        results.details.push({
          run_id: run.id,
          prospect: `${prospect.first_name} ${prospect.last_name}`,
          channel,
          step: nextStepOrder,
          status: "dispatched",
        });

      } catch (runError) {
        console.error(`[outbound-dispatch] Error processing run ${run.id}:`, runError);
        results.errors++;
        results.details.push({
          run_id: run.id,
          status: "error",
          error: String(runError),
        });
      }
    }

    console.log(`[outbound-dispatch] Completed. Processed: ${results.processed}, Emails: ${results.sent_email}, LinkedIn queued: ${results.queued_linkedin}, Errors: ${results.errors}`);

    return new Response(JSON.stringify({
      success: true,
      timestamp: now,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[outbound-dispatch] Fatal error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
