import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_FUNCTION_SECRET");
const INTERNAL_SECRET_VAULT = Deno.env.get("INTERNAL_FUNCTION_SECRET_VAULT");
const CRON_SECRET = "cron-dispatch-secret-2024"; // Fallback for pg_cron calls
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

// ============================================
// TYPES
// ============================================

type CampaignConfig = {
  max_daily_sends_email: number;
  max_daily_sends_linkedin: number;
  business_hours_only: boolean;
  timezone: string;
  linkedin_delivery_mode: string;
};

type OutboundSequenceRun = {
  id: string;
  tenant_id: string;
  campaign_id: string;
  sequence_id: string;
  prospect_id: string;
  status: string;
  last_step_sent: number;
  next_step_due_at: string | null;
  config: CampaignConfig;
};

type EmailSettings = {
  tenant_id: string;
  sender_name: string;
  from_address: string;
  reply_to_address: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  updated_at: string | null;
};

type LinkedInSettings = {
  tenant_id: string;
  linkedin_profile_url: string;
  daily_connection_limit: number;
  daily_message_limit: number;
  updated_at: string | null;
};

type CalendarSettings = {
  tenant_id: string;
  calendar_provider: string;
  booking_url: string;
  updated_at: string | null;
};

type CRMWebhookSettings = {
  tenant_id: string;
  inbound_webhook_url: string | null;
  outbound_webhook_url: string | null;
  updated_at: string | null;
};

type TenantSettingsCache = {
  email: EmailSettings | null;
  linkedin: LinkedInSettings | null;
  calendar: CalendarSettings | null;
  crm: CRMWebhookSettings | null;
};

const DEFAULT_CONFIG: CampaignConfig = {
  max_daily_sends_email: 200,
  max_daily_sends_linkedin: 40,
  business_hours_only: true,
  timezone: "America/Chicago",
  linkedin_delivery_mode: "manual_queue",
};

const FORBIDDEN_WORKSPACE_KEYS = new Set(["tenant_id", "tenantId", "tenant"]);

function hasForbiddenWorkspaceKeys(value: unknown): boolean {
  if (!value) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(hasForbiddenWorkspaceKeys);
  }

  if (typeof value !== "object") {
    return false;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_WORKSPACE_KEYS.has(key)) {
      return true;
    }
    if (hasForbiddenWorkspaceKeys(nested)) {
      return true;
    }
  }

  return false;
}

// ============================================
// SETTINGS HELPERS (with per-invocation caching)
// ============================================

const settingsCache: Record<string, TenantSettingsCache> = {};

async function getEmailSettings(tenantId: string): Promise<EmailSettings | null> {
  if (settingsCache[tenantId]?.email !== undefined) {
    return settingsCache[tenantId].email;
  }
  
  const { data, error } = await supabase
    .from("ai_settings_email")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  
  if (error) {
    console.error(`[dispatch] Error fetching email settings for ${tenantId}:`, error);
  }
  
  if (!settingsCache[tenantId]) {
    settingsCache[tenantId] = { email: null, linkedin: null, calendar: null, crm: null };
  }
  settingsCache[tenantId].email = data;
  return data;
}

async function getLinkedInSettings(tenantId: string): Promise<LinkedInSettings | null> {
  if (settingsCache[tenantId]?.linkedin !== undefined) {
    return settingsCache[tenantId].linkedin;
  }
  
  const { data, error } = await supabase
    .from("ai_settings_linkedin")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  
  if (error) {
    console.error(`[dispatch] Error fetching LinkedIn settings for ${tenantId}:`, error);
  }
  
  if (!settingsCache[tenantId]) {
    settingsCache[tenantId] = { email: null, linkedin: null, calendar: null, crm: null };
  }
  settingsCache[tenantId].linkedin = data;
  return data;
}

async function getCalendarSettings(tenantId: string): Promise<CalendarSettings | null> {
  if (settingsCache[tenantId]?.calendar !== undefined) {
    return settingsCache[tenantId].calendar;
  }
  
  const { data, error } = await supabase
    .from("ai_settings_calendar")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  
  if (error) {
    console.error(`[dispatch] Error fetching calendar settings for ${tenantId}:`, error);
  }
  
  if (!settingsCache[tenantId]) {
    settingsCache[tenantId] = { email: null, linkedin: null, calendar: null, crm: null };
  }
  settingsCache[tenantId].calendar = data;
  return data;
}

async function getCrmWebhookSettings(tenantId: string): Promise<CRMWebhookSettings | null> {
  if (settingsCache[tenantId]?.crm !== undefined) {
    return settingsCache[tenantId].crm;
  }
  
  const { data, error } = await supabase
    .from("ai_settings_crm_webhooks")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  
  if (error) {
    console.error(`[dispatch] Error fetching CRM webhook settings for ${tenantId}:`, error);
  }
  
  if (!settingsCache[tenantId]) {
    settingsCache[tenantId] = { email: null, linkedin: null, calendar: null, crm: null };
  }
  settingsCache[tenantId].crm = data;
  return data;
}

async function countTodayLinkedInSends(tenantId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("outbound_message_events")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("channel", "linkedin")
    .eq("event_type", "sent")
    .gte("created_at", todayStart.toISOString());

  if (error) {
    console.error("[dispatch] Error counting LinkedIn sends:", error);
    return 0;
  }

  return count || 0;
}

// ============================================
// CRM WEBHOOK DELIVERY (non-blocking)
// ============================================

async function sendCrmWebhook(params: {
  webhookUrl: string;
  event: string;
  tenant_id: string;
  prospect_id: string;
  campaign_id: string;
  sequence_id: string;
  sequence_run_id: string;
  step_id: string;
  channel: string;
  metadata?: Record<string, unknown>;
}) {
  const { webhookUrl, event, tenant_id, prospect_id, campaign_id, sequence_id, sequence_run_id, step_id, channel, metadata } = params;

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    tenant_id,
    prospect_id,
    campaign_id,
    sequence_id,
    sequence_run_id,
    step_id,
    channel,
    ...metadata,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) {
      console.warn(`[dispatch] CRM webhook failed (${res.status}): ${webhookUrl}`);
    } else {
      console.log(`[dispatch] CRM webhook sent: ${event} -> ${webhookUrl}`);
    }
  } catch (err) {
    console.warn(`[dispatch] CRM webhook error: ${err}`);
  }
}

// ============================================
// CORE HELPERS
// ============================================

async function getDueRuns(tenantId: string): Promise<OutboundSequenceRun[]> {
  const { data, error } = await supabase
    .from("outbound_sequence_runs")
    .select(`
      *,
      outbound_sequences!inner(
        campaign_id,
        outbound_campaigns!inner(
          config
        )
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .lte("next_step_due_at", new Date().toISOString())
    .limit(100);

  if (error) {
    console.error("[dispatch] Error fetching runs:", error);
    return [];
  }

  return (data || []).map((run: any) => ({
    ...run,
    campaign_id: run.outbound_sequences?.campaign_id,
    config: { ...DEFAULT_CONFIG, ...(run.outbound_sequences?.outbound_campaigns?.config || {}) },
  })) as OutboundSequenceRun[];
}

async function getDailySendCount(tenantId: string, channel: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("outbound_message_events")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("channel", channel)
    .eq("event_type", "sent")
    .gte("created_at", todayStart.toISOString());

  if (error) {
    console.error("[dispatch] Error counting daily sends:", error);
    return 0;
  }

  return count || 0;
}

function isWithinBusinessHours(timezone: string): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
      weekday: "short",
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === "hour")?.value || "12");
    const weekday = parts.find(p => p.type === "weekday")?.value || "Mon";

    if (weekday === "Sat" || weekday === "Sun") {
      return false;
    }

    return hour >= 8 && hour < 18;
  } catch {
    return true;
  }
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

async function getBrandContext(tenantId: string) {
  const { data } = await supabase
    .from("cmo_brand_profiles")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return data;
}

// ============================================
// AI AGENT CALL
// ============================================

async function callOutboundCopyAgent(params: {
  tenant_id: string;
  prospect: any;
  insights: any;
  step: any;
  brand: any;
  calendarSettings?: CalendarSettings | null;
}) {
  const { prospect, insights, step, brand, calendarSettings } = params;

  // Build CTA based on step type
  let callToAction = step.metadata?.call_to_action || "Open to a quick 15-minute call to see if this fits?";
  
  // For booking steps, weave in the booking URL if available
  if (step.step_type === "booking" && calendarSettings?.booking_url) {
    callToAction = `Book a time that works for you: ${calendarSettings.booking_url}`;
  }

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
      call_to_action: callToAction,
      // Include calendar context for booking steps
      ...(step.step_type === "booking" && calendarSettings
        ? {
            calendar_provider: calendarSettings.calendar_provider,
            booking_url: calendarSettings.booking_url,
          }
        : {}),
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

// ============================================
// MESSAGE LOGGING
// ============================================

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

  const { data, error } = await supabase.from("outbound_message_events").insert({
    tenant_id,
    sequence_run_id,
    step_id,
    channel,
    event_type,
    message_text,
    subject_line,
    metadata: metadata || {},
  }).select().maybeSingle();

  if (error) {
    console.error("[dispatch] Error inserting message event:", error);
  }

  return data;
}

async function updateRunAfterSend(params: { run: OutboundSequenceRun; step: any }) {
  const { run, step } = params;

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

// ============================================
// EMAIL DISPATCH
// ============================================

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

// ============================================
// LINKEDIN TASK QUEUE
// ============================================

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

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify internal secret for cron calls
  // Accept: x-internal-secret header OR Authorization Bearer with service role key
  const internalSecret = req.headers.get("x-internal-secret");
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.replace("Bearer ", "");
  
  const validSecrets = [INTERNAL_SECRET, INTERNAL_SECRET_VAULT, CRON_SECRET].filter(Boolean);
  const isValidInternalSecret = validSecrets.includes(internalSecret || "");
  const isServiceRole = bearerToken === SUPABASE_SERVICE_ROLE_KEY;
  
  if (!isValidInternalSecret && !isServiceRole) {
    console.error("[dispatch] Unauthorized: Invalid internal secret or service role");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  console.log(`[dispatch] Authorized via ${isServiceRole ? 'service_role' : 'internal_secret'}`);

  try {
    console.log("[dispatch] Starting dispatch cycle...");

    const rawBody = await req.text();
    if (!rawBody) {
      return new Response(
        JSON.stringify({ error: "TENANT_ONLY_VIOLATION", message: "tenant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error("[dispatch] Invalid JSON body:", parseErr);
      return new Response(
        JSON.stringify({ error: "INVALID_JSON", message: "Request body must be valid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (hasForbiddenWorkspaceKeys(body)) {
      return new Response(
        JSON.stringify({ error: "TENANT_ONLY_VIOLATION", message: "tenant fields are not allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).tenant_id
      : undefined;
    if (typeof tenantId !== "string" || tenantId.trim() === "") {
      return new Response(
        JSON.stringify({ error: "TENANT_ONLY_VIOLATION", message: "tenant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const runs = await getDueRuns(tenantId);
    if (!runs.length) {
      console.log("[dispatch] No due sequences found");
      return new Response(
        JSON.stringify({ status: "ok", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[dispatch] Found ${runs.length} due sequence runs`);

    // Track daily send counts per tenant (memoized)
    const dailyCounts: Record<string, { email: number; linkedin: number }> = {};

    let processed = 0;
    let errors = 0;
    let skippedCaps = 0;
    let skippedBusinessHours = 0;
    let skippedMissingSettings = 0;

    for (const run of runs) {
      try {
        const config = { ...run.config };

        // Check business hours if enabled
        if (config.business_hours_only && !isWithinBusinessHours(config.timezone)) {
          console.log(`[dispatch] Skipping run ${run.id} - outside business hours`);
          skippedBusinessHours++;
          continue;
        }

        const step = await getNextStep(run);
        if (!step) {
          await supabase
            .from("outbound_sequence_runs")
            .update({ status: "completed", updated_at: new Date().toISOString() })
            .eq("id", run.id);
          console.log(`[dispatch] Run ${run.id} completed - no more steps`);
          continue;
        }

        const channel = step.channel || "email";

        // Load settings for this tenant (cached per invocation)
        const [emailSettings, linkedinSettings, calendarSettings, crmSettings] = await Promise.all([
          getEmailSettings(run.tenant_id),
          getLinkedInSettings(run.tenant_id),
          getCalendarSettings(run.tenant_id),
          getCrmWebhookSettings(run.tenant_id),
        ]);

        // Initialize daily counts for tenant if not cached
        if (!dailyCounts[run.tenant_id]) {
          const emailCount = await getDailySendCount(run.tenant_id, "email");
          const linkedinCount = await countTodayLinkedInSends(run.tenant_id);
          dailyCounts[run.tenant_id] = { email: emailCount, linkedin: linkedinCount };
        }

        // =====================
        // EMAIL CHANNEL CHECKS
        // =====================
        if (channel === "email") {
          // Check required email settings
          if (!emailSettings?.sender_name || !emailSettings?.from_address || !emailSettings?.reply_to_address) {
            console.warn(`[dispatch] Skipping run ${run.id} - missing email settings (sender_name, from_address, or reply_to_address) for tenant ${run.tenant_id}`);
            skippedMissingSettings++;
            continue;
          }

          // Check daily email cap
          if (dailyCounts[run.tenant_id].email >= config.max_daily_sends_email) {
            console.log(`[dispatch] Skipping run ${run.id} - daily email cap reached (${config.max_daily_sends_email})`);
            skippedCaps++;
            continue;
          }
        }

        // =====================
        // LINKEDIN CHANNEL CHECKS
        // =====================
        if (channel === "linkedin") {
          // Check linkedin_profile_url
          if (!linkedinSettings?.linkedin_profile_url) {
            console.warn(`[dispatch] Skipping run ${run.id} - missing linkedin_profile_url for tenant ${run.tenant_id}`);
            skippedMissingSettings++;
            continue;
          }

          // Override config with tenant LinkedIn limits
          const totalLinkedInLimit = (linkedinSettings.daily_connection_limit || 20) + (linkedinSettings.daily_message_limit || 50);
          config.max_daily_sends_linkedin = totalLinkedInLimit;

          // Check daily LinkedIn cap
          if (dailyCounts[run.tenant_id].linkedin >= config.max_daily_sends_linkedin) {
            console.log(`[dispatch] Skipping run ${run.id} - daily LinkedIn cap reached (${config.max_daily_sends_linkedin})`);
            skippedCaps++;
            continue;
          }
        }

        const prospect = await getProspect(run.prospect_id);
        if (!prospect) {
          console.warn(`[dispatch] Prospect not found for run ${run.id}`);
          continue;
        }

        const insights = await getProspectInsights(run.prospect_id);
        const brand = await getBrandContext(run.tenant_id);

        // Call AI agent with calendar context for booking steps
        const outbound = await callOutboundCopyAgent({
          tenant_id: run.tenant_id,
          prospect,
          insights,
          step,
          brand,
          calendarSettings: step.step_type === "booking" ? calendarSettings : null,
        });

        // =====================
        // DISPATCH EMAIL
        // =====================
        if (channel === "email") {
          if (!prospect.email) {
            console.warn("[dispatch] Prospect missing email, skipping", prospect.id);
          } else {
            const fromEmail = `${emailSettings!.sender_name} <${emailSettings!.from_address}>`;
            
            await dispatchEmail({
              to: prospect.email,
              subject: outbound.subject_line || "Quick idea",
              body: outbound.message_text,
              tenant_id: run.tenant_id,
              prospect_name: `${prospect.first_name} ${prospect.last_name}`,
              from_email: fromEmail,
              reply_to: emailSettings!.reply_to_address,
            });
            dailyCounts[run.tenant_id].email++;
          }
        }

        // =====================
        // DISPATCH LINKEDIN
        // =====================
        if (channel === "linkedin") {
          await queueLinkedInTask({
            prospect,
            message_text: outbound.message_text,
            tenant_id: run.tenant_id,
            sequence_run_id: run.id,
            step_id: step.id,
          });
          dailyCounts[run.tenant_id].linkedin++;
        }

        // =====================
        // LOG MESSAGE EVENT
        // =====================
        const eventData = await logMessageEvent({
          tenant_id: run.tenant_id,
          sequence_run_id: run.id,
          step_id: step.id,
          channel: channel,
          event_type: "sent",
          message_text: outbound.message_text,
          subject_line: outbound.subject_line,
          metadata: {
            variant_tag: outbound.variant_tag,
            prospect_id: prospect.id,
          },
        });

        // =====================
        // CRM WEBHOOK (non-blocking)
        // =====================
        if (crmSettings?.outbound_webhook_url) {
          // Fire and forget - don't await
          sendCrmWebhook({
            webhookUrl: crmSettings.outbound_webhook_url,
            event: `${channel}.sent`,
            tenant_id: run.tenant_id,
            prospect_id: prospect.id,
            campaign_id: run.campaign_id,
            sequence_id: run.sequence_id,
            sequence_run_id: run.id,
            step_id: step.id,
            channel,
            metadata: {
              message_event_id: eventData?.id,
              variant_tag: outbound.variant_tag,
              subject_line: outbound.subject_line,
            },
          }).catch((err) => console.warn("[dispatch] CRM webhook background error:", err));
        }

        await updateRunAfterSend({ run, step });
        processed++;
        console.log(`[dispatch] Processed run ${run.id}, step ${step.step_order}, channel ${channel}`);
      } catch (runErr) {
        console.error(`[dispatch] Error processing run ${run.id}:`, runErr);
        errors++;
      }
    }

    console.log(`[dispatch] Completed: ${processed} processed, ${errors} errors, ${skippedCaps} skipped (caps), ${skippedBusinessHours} skipped (business hours), ${skippedMissingSettings} skipped (missing settings)`);

    return new Response(
      JSON.stringify({ 
        status: "ok", 
        processed, 
        errors, 
        skippedCaps,
        skippedBusinessHours,
        skippedMissingSettings,
        total: runs.length 
      }),
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
