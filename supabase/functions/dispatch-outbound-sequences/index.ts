import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_FUNCTION_SECRET");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

type OutboundSequenceRun = {
  id: string;
  tenant_id: string;
  workspace_id: string;
  campaign_id: string;
  sequence_id: string;
  prospect_id: string;
  status: string;
  last_step_sent: number;
  next_step_due_at: string | null;
};

async function getDueRuns(): Promise<OutboundSequenceRun[]> {
  // Join through sequences -> campaigns to get workspace_id
  const { data, error } = await supabase
    .from("outbound_sequence_runs")
    .select(`
      *,
      outbound_sequences!inner(
        campaign_id,
        outbound_campaigns!inner(
          workspace_id
        )
      )
    `)
    .eq("status", "active")
    .lte("next_step_due_at", new Date().toISOString())
    .limit(100);

  if (error) {
    console.error("[dispatch] Error fetching runs:", error);
    return [];
  }

  // Map to include workspace_id from joined data
  return (data || []).map((run: any) => ({
    ...run,
    workspace_id: run.outbound_sequences?.outbound_campaigns?.workspace_id,
    campaign_id: run.outbound_sequences?.campaign_id,
  })) as OutboundSequenceRun[];
}

async function getNextStep(run: OutboundSequenceRun) {
  const nextOrder = (run.last_step_sent || 0) + 1;

  const { data, error } = await supabase
    .from("outbound_sequence_steps")
    .select("*")
    .eq("sequence_id", run.sequence_id)
    .eq("step_order", nextOrder)
    .maybeSingle();

  if (error) {
    console.error("[dispatch] Error fetching next step:", error, run.id);
    return null;
  }

  return data;
}

async function getProspect(prospectId: string) {
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", prospectId)
    .maybeSingle();

  if (error || !data) {
    console.error("[dispatch] Error fetching prospect:", error);
    return null;
  }

  return data;
}

async function getProspectInsights(prospectId: string) {
  const { data, error } = await supabase
    .from("prospect_scores")
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0];
}

async function getBrandContext(workspaceId: string) {
  const { data } = await supabase
    .from("cmo_brand_profiles")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return data;
}

async function callOutboundCopyAgent(params: {
  tenant_id: string;
  prospect: any;
  insights: any;
  step: any;
  brand: any;
}) {
  const { prospect, insights, step, brand } = params;

  const systemPrompt = `You are the Outbound Message Generator for the UbiGrowth AI CMO Outbound OS.
You write short, punchy, non-generic outbound messages that sound like a sharp, no-nonsense SDR or founder.

Rules:
- Always personalize using the prospect_profile and prospect_insights.
- Refer to real signals (promotion, growth, posts) only if they are present.
- Avoid buzzwords and hype ('game-changing', 'cutting-edge', etc.).
- Keep messages tight: 40–120 words for email, 25–80 words for LinkedIn.
- Match tone_recommendation where provided (e.g., 'direct', 'casual', 'metric-oriented').
- Use a single, clear call-to-action (CTA). Do not list multiple CTAs.
- Output MUST be valid JSON with exactly these fields: message_text, subject_line, variant_tag, reasoning_summary`;

  const userInput = {
    prospect_profile: {
      first_name: prospect.first_name,
      last_name: prospect.last_name,
      title: prospect.title,
      company: prospect.company,
      industry: prospect.industry,
      location: prospect.location,
      linkedin_url: prospect.linkedin_url,
    },
    prospect_insights: insights
      ? {
          buying_intent_score: insights.score,
          intent_band: insights.intent_band || "warm",
          key_signals: insights.key_signals || [],
          hypothesized_pain_points: insights.pain_points || [],
          recommended_angle: insights.recommended_angle || "",
          tone_recommendation: insights.tone_recommendation || "professional",
        }
      : {
          buying_intent_score: 50,
          intent_band: "warm",
          key_signals: [],
          hypothesized_pain_points: [],
          recommended_angle: "",
          tone_recommendation: "professional",
        },
    step_context: {
      step_type: step.step_type,
      channel: step.channel || "email",
      sequence_position: step.step_order,
      previous_message_summary: "",
      call_to_action:
        step.metadata?.call_to_action ||
        "Open to a quick 15-minute call to see if this fits?",
    },
    brand_voice: {
      tone: brand?.brand_tone || "direct, helpful, no fluff",
      length_preference: step.channel === "linkedin" ? "short" : "medium",
      avoid: ["buzzwords", "hype", "game-changing", "cutting-edge"],
      product_name: brand?.brand_name || "AI CMO Outbound OS",
      value_prop:
        brand?.unique_value_proposition ||
        "turns outbound into a system that reliably books meetings without adding headcount",
    },
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userInput) },
      ],
      temperature: 0.45,
      max_tokens: 700,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[dispatch] AI call failed:", errText);
    throw new Error("AI call failed");
  }

  const json = await res.json();
  const rawContent = json.choices?.[0]?.message?.content || "";

  // Parse JSON from response (handle markdown code blocks)
  try {
    const jsonMatch =
      rawContent.match(/```json\n?([\s\S]*?)\n?```/) ||
      rawContent.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : rawContent;
    return JSON.parse(jsonStr);
  } catch (parseErr) {
    console.error("[dispatch] Failed to parse AI response:", rawContent);
    throw new Error("Failed to parse AI response");
  }
}

async function logMessageEvent(params: {
  tenant_id: string;
  sequence_run_id: string;
  step_id: string;
  channel: string;
  event_type: string;
  message_text?: string;
  subject_line?: string;
  metadata?: Record<string, unknown>;
}) {
  const { tenant_id, sequence_run_id, step_id, channel, event_type, message_text, subject_line, metadata } = params;

  const { error } = await supabase.from("outbound_message_events").insert({
    tenant_id,
    sequence_run_id,
    step_id,
    channel,
    event_type,
    message_text,
    subject_line,
    metadata: metadata || {},
  });

  if (error) {
    console.error("[dispatch] Error inserting message event:", error);
  }
}

async function updateRunAfterSend(params: { run: OutboundSequenceRun; step: any }) {
  const { run, step } = params;

  // Check if there's a next step
  const nextStepOrder = step.step_order + 1;
  const { data: nextStep } = await supabase
    .from("outbound_sequence_steps")
    .select("delay_days")
    .eq("sequence_id", run.sequence_id)
    .eq("step_order", nextStepOrder)
    .maybeSingle();

  const delayDays = nextStep?.delay_days ?? 1;
  const nextDue = nextStep
    ? new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { error } = await supabase
    .from("outbound_sequence_runs")
    .update({
      last_step_sent: step.step_order,
      next_step_due_at: nextDue,
      status: nextDue ? "active" : "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  if (error) {
    console.error("[dispatch] Error updating sequence run:", error);
  }
}

async function dispatchEmail(params: {
  to: string;
  subject: string;
  body: string;
  tenant_id: string;
  prospect_name: string;
  from_email?: string;
  reply_to?: string;
}) {
  console.log(`[dispatch] Sending email to ${params.to}: ${params.subject}`);
  
  try {
    const emailResponse = await resend.emails.send({
      from: params.from_email || "UbiGrowth AI CMO <noreply@updates.ubigrowth.ai>",
      to: [params.to],
      subject: params.subject,
      reply_to: params.reply_to || "team@ubigrowth.ai",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${params.body.split('\n').map(line => `<p style="margin: 0 0 16px 0; line-height: 1.6; color: #333;">${line}</p>`).join('')}
        </div>
      `,
      text: params.body,
    });

    console.log(`[dispatch] Email sent successfully:`, emailResponse);
    return { success: true, id: emailResponse.data?.id };
  } catch (error) {
    console.error(`[dispatch] Email send failed:`, error);
    return { success: false, error };
  }
}

async function queueLinkedInTask(params: {
  prospect: any;
  message_text: string;
  tenant_id: string;
  sequence_run_id: string;
  step_id: string;
}) {
  const { prospect, message_text, tenant_id, sequence_run_id, step_id } = params;

  const { error } = await supabase.from("linkedin_tasks").insert({
    tenant_id,
    prospect_id: prospect.id,
    sequence_run_id,
    step_id,
    linkedin_url: prospect.linkedin_url,
    message_text,
  });

  if (error) {
    console.error("[dispatch] Error inserting linkedin task:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify internal secret for cron calls
  const internalSecret = req.headers.get("x-internal-secret");
  if (internalSecret !== INTERNAL_SECRET) {
    console.error("[dispatch] Unauthorized: Invalid internal secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("[dispatch] Starting dispatch cycle...");

    const runs = await getDueRuns();
    if (!runs.length) {
      console.log("[dispatch] No due sequences found");
      return new Response(
        JSON.stringify({ status: "ok", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[dispatch] Found ${runs.length} due sequence runs`);

    let processed = 0;
    let errors = 0;

    for (const run of runs) {
      try {
        const step = await getNextStep(run);
        if (!step) {
          // No more steps - mark as completed
          await supabase
            .from("outbound_sequence_runs")
            .update({ status: "completed", updated_at: new Date().toISOString() })
            .eq("id", run.id);
          console.log(`[dispatch] Run ${run.id} completed - no more steps`);
          continue;
        }

        const prospect = await getProspect(run.prospect_id);
        if (!prospect) {
          console.warn(`[dispatch] Prospect not found for run ${run.id}`);
          continue;
        }

        const insights = await getProspectInsights(run.prospect_id);
        const brand = await getBrandContext(run.workspace_id);

        const outbound = await callOutboundCopyAgent({
          tenant_id: run.tenant_id,
          prospect,
          insights,
          step,
          brand,
        });

        const channel = step.channel || "email";

        if (channel === "email") {
          if (!prospect.email) {
            console.warn(`[dispatch] Prospect ${prospect.id} missing email, skipping`);
            continue;
          }

          await dispatchEmail({
            to: prospect.email,
            subject: outbound.subject_line || "Quick idea",
            body: outbound.message_text,
            tenant_id: run.tenant_id,
            prospect_name: `${prospect.first_name} ${prospect.last_name}`,
          });

          await logMessageEvent({
            tenant_id: run.tenant_id,
            sequence_run_id: run.id,
            step_id: step.id,
            channel: "email",
            event_type: "sent",
            message_text: outbound.message_text,
            subject_line: outbound.subject_line,
            metadata: {
              variant_tag: outbound.variant_tag,
              reasoning: outbound.reasoning_summary,
              prospect_id: prospect.id,
            },
          });
        } else if (channel === "linkedin") {
          await queueLinkedInTask({
            prospect,
            message_text: outbound.message_text,
            tenant_id: run.tenant_id,
            sequence_run_id: run.id,
            step_id: step.id,
          });

          await logMessageEvent({
            tenant_id: run.tenant_id,
            sequence_run_id: run.id,
            step_id: step.id,
            channel: "linkedin",
            event_type: "pending",
            message_text: outbound.message_text,
            subject_line: outbound.subject_line,
            metadata: {
              variant_tag: outbound.variant_tag,
              reasoning: outbound.reasoning_summary,
              prospect_id: prospect.id,
              linkedin_url: prospect.linkedin_url,
            },
          });
        }

        await updateRunAfterSend({ run, step });
        processed++;
        console.log(`[dispatch] Processed run ${run.id}, step ${step.step_order}`);
      } catch (runErr) {
        console.error(`[dispatch] Error processing run ${run.id}:`, runErr);
        errors++;
      }
    }

    console.log(`[dispatch] Completed: ${processed} processed, ${errors} errors`);

    return new Response(
      JSON.stringify({ status: "ok", processed, errors, total: runs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[dispatch] Fatal error:", e);
    return new Response(
      JSON.stringify({ status: "error", message: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
