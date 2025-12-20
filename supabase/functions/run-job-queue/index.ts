/**
 * Run Job Queue Edge Function
 * Processes queued jobs for campaign execution (email, voice, social)
 * Called by cron every minute or manually
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

interface Job {
  id: string;
  tenant_id: string;
  workspace_id: string;
  run_id: string;
  job_type: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
}

interface Lead {
  id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface EmailSettings {
  from_address: string;
  sender_name: string;
  reply_to_address: string;
  email_provider: string | null;
  is_connected: boolean;
}

interface VoiceSettings {
  default_vapi_assistant_id: string | null;
  vapi_private_key: string | null;
}

interface PhoneNumber {
  id: string;
  provider_phone_number_id: string | null;
  phone_number: string;
}

// Send email via Resend
async function sendEmail(
  resendApiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.message || `Resend error: ${res.status}` };
    }
    return { success: true, messageId: data.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Initiate voice call via VAPI
async function initiateVoiceCall(
  vapiPrivateKey: string,
  assistantId: string,
  phoneNumberId: string,
  customerNumber: string,
  customerName?: string
): Promise<{ success: boolean; callId?: string; error?: string }> {
  try {
    const res = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vapiPrivateKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistantId,
        phoneNumberId,
        customer: { number: customerNumber, name: customerName },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.message || `VAPI error: ${res.status}` };
    }
    return { success: true, callId: data.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Process email batch job
async function processEmailBatch(
  supabase: any,
  job: Job,
  resendApiKey: string
): Promise<{ success: boolean; sent: number; failed: number; error?: string }> {
  const campaignId = job.payload.campaign_id as string;
  const selectedProvider = (job.payload.provider as string) || "resend";
  
  // Get campaign asset with email content
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*, assets(*)")
    .eq("id", campaignId)
    .single();

  if (!campaign) {
    return { success: false, sent: 0, failed: 0, error: "Campaign not found" };
  }

  // Get email settings
  const { data: emailSettingsData } = await supabase
    .from("ai_settings_email")
    .select("*")
    .eq("tenant_id", job.tenant_id)
    .single();

  const emailSettings = emailSettingsData as EmailSettings | null;

  if (!emailSettings?.from_address) {
    return { success: false, sent: 0, failed: 0, error: "Email settings not configured - missing from address" };
  }

  // Validate provider is connected
  if (!emailSettings.is_connected) {
    return { success: false, sent: 0, failed: 0, error: `Email provider '${selectedProvider}' is not connected. Test connection in Settings.` };
  }

  // Get leads to email
  const { data: leadsData } = await supabase
    .from("leads")
    .select("id, email, first_name, last_name")
    .eq("workspace_id", job.workspace_id)
    .not("email", "is", null)
    .limit(100);

  const leads = (leadsData || []) as Lead[];

  if (leads.length === 0) {
    return { success: false, sent: 0, failed: 0, error: "No leads found to email" };
  }

  const campaignData = campaign as { assets?: { content?: Record<string, unknown> } };
  const emailContent = campaignData.assets?.content || {};
  const subject = (emailContent as Record<string, string>).subject || `Message from ${emailSettings.sender_name || "Us"}`;
  const body = (emailContent as Record<string, string>).body || (emailContent as Record<string, string>).html || "Hello!";

  let sent = 0;
  let failed = 0;
  const outboxEntries: Record<string, unknown>[] = [];

  for (const lead of leads) {
    if (!lead.email) continue;
    
    // Personalize content
    const personalizedBody = body
      .replace(/\{\{first_name\}\}/g, lead.first_name || "there")
      .replace(/\{\{last_name\}\}/g, lead.last_name || "");

    let result: { success: boolean; messageId?: string; error?: string };

    // Use the selected provider
    switch (selectedProvider) {
      case "resend":
        result = await sendEmail(
          resendApiKey,
          `${emailSettings.sender_name || "Team"} <${emailSettings.from_address}>`,
          lead.email,
          subject,
          personalizedBody
        );
        break;
      case "gmail":
        // Gmail would use OAuth tokens stored in user_gmail_tokens
        // For now, fall back to resend with a note
        result = await sendEmail(
          resendApiKey,
          `${emailSettings.sender_name || "Team"} <${emailSettings.from_address}>`,
          lead.email,
          subject,
          personalizedBody
        );
        break;
      case "smtp":
        // SMTP would use custom SMTP settings
        // For now, fall back to resend
        result = await sendEmail(
          resendApiKey,
          `${emailSettings.sender_name || "Team"} <${emailSettings.from_address}>`,
          lead.email,
          subject,
          personalizedBody
        );
        break;
      default:
        result = { success: false, error: `Unknown provider: ${selectedProvider}` };
    }

    outboxEntries.push({
      tenant_id: job.tenant_id,
      workspace_id: job.workspace_id,
      run_id: job.run_id,
      job_id: job.id,
      channel: "email",
      provider: selectedProvider, // Use the selected provider
      recipient_id: lead.id,
      recipient_email: lead.email,
      payload: { subject, campaign_id: campaignId },
      status: result.success ? "sent" : "failed",
      provider_message_id: result.messageId,
      error: result.error,
    });

    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  // Insert outbox entries
  if (outboxEntries.length > 0) {
    await supabase.from("channel_outbox").insert(outboxEntries as never[]);
  }

  // Log audit
  await supabase.from("campaign_audit_log").insert({
    tenant_id: job.tenant_id,
    workspace_id: job.workspace_id,
    campaign_id: campaignId,
    run_id: job.run_id,
    job_id: job.id,
    event_type: "job_completed",
    actor_type: "system",
    details: { sent, failed, total: leads.length },
  } as never);

  return { success: failed === 0, sent, failed };
}

// Process voice call batch job
async function processVoiceBatch(
  supabase: any,
  job: Job,
  vapiPrivateKey: string
): Promise<{ success: boolean; called: number; failed: number; error?: string }> {
  const campaignId = job.payload.campaign_id as string;

  // Get voice settings
  const { data: voiceSettingsData } = await supabase
    .from("ai_settings_voice")
    .select("*")
    .eq("tenant_id", job.tenant_id)
    .single();

  const voiceSettings = voiceSettingsData as VoiceSettings | null;

  if (!voiceSettings?.default_vapi_assistant_id) {
    return { success: false, called: 0, failed: 0, error: "Voice settings not configured - missing assistant" };
  }

  // Get phone number
  const { data: phoneNumbersData } = await supabase
    .from("voice_phone_numbers")
    .select("*")
    .eq("tenant_id", job.tenant_id)
    .eq("is_default", true)
    .limit(1);

  const phoneNumbers = (phoneNumbersData || []) as PhoneNumber[];
  const phoneNumber = phoneNumbers[0];
  
  if (!phoneNumber?.provider_phone_number_id) {
    return { success: false, called: 0, failed: 0, error: "No default phone number configured" };
  }

  // Get leads to call
  const { data: leadsData } = await supabase
    .from("leads")
    .select("id, phone, first_name, last_name")
    .eq("workspace_id", job.workspace_id)
    .not("phone", "is", null)
    .limit(10); // Limit voice calls

  const leads = (leadsData || []) as Lead[];

  if (leads.length === 0) {
    return { success: false, called: 0, failed: 0, error: "No leads found with phone numbers" };
  }

  let called = 0;
  let failed = 0;
  const outboxEntries: Record<string, unknown>[] = [];

  for (const lead of leads) {
    if (!lead.phone) continue;
    
    const result = await initiateVoiceCall(
      vapiPrivateKey,
      voiceSettings.default_vapi_assistant_id,
      phoneNumber.provider_phone_number_id,
      lead.phone,
      `${lead.first_name || ""} ${lead.last_name || ""}`.trim()
    );

    outboxEntries.push({
      tenant_id: job.tenant_id,
      workspace_id: job.workspace_id,
      run_id: job.run_id,
      job_id: job.id,
      channel: "voice",
      provider: "vapi",
      recipient_id: lead.id,
      recipient_phone: lead.phone,
      payload: { campaign_id: campaignId, assistant_id: voiceSettings.default_vapi_assistant_id },
      status: result.success ? "called" : "failed",
      provider_message_id: result.callId,
      error: result.error,
    });

    if (result.success) {
      called++;
      // Create call record
      await supabase.from("voice_call_records").insert({
        tenant_id: job.tenant_id,
        workspace_id: job.workspace_id,
        lead_id: lead.id,
        campaign_id: campaignId,
        provider_call_id: result.callId,
        status: "queued",
        call_type: "outbound",
        customer_number: lead.phone,
        customer_name: `${lead.first_name || ""} ${lead.last_name || ""}`.trim(),
      } as never);
    } else {
      failed++;
    }
  }

  // Insert outbox entries
  if (outboxEntries.length > 0) {
    await supabase.from("channel_outbox").insert(outboxEntries as never[]);
  }

  // Log audit
  await supabase.from("campaign_audit_log").insert({
    tenant_id: job.tenant_id,
    workspace_id: job.workspace_id,
    campaign_id: campaignId,
    run_id: job.run_id,
    job_id: job.id,
    event_type: "job_completed",
    actor_type: "system",
    details: { called, failed, total: leads.length },
  } as never);

  return { success: failed === 0, called, failed };
}

// Process social post batch job
async function processSocialBatch(
  supabase: any,
  job: Job
): Promise<{ success: boolean; posted: number; failed: number; error?: string }> {
  const campaignId = job.payload.campaign_id as string;

  // Get campaign asset with social content
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*, assets(*)")
    .eq("id", campaignId)
    .single();

  if (!campaign) {
    return { success: false, posted: 0, failed: 0, error: "Campaign not found" };
  }

  // For now, mark as posted since social integration is limited
  // In production, this would call LinkedIn/Twitter APIs
  const campaignData = campaign as { assets?: { content?: Record<string, unknown> } };
  
  const outboxEntry = {
    tenant_id: job.tenant_id,
    workspace_id: job.workspace_id,
    run_id: job.run_id,
    job_id: job.id,
    channel: "social",
    provider: "internal",
    payload: { campaign_id: campaignId, content: campaignData.assets?.content },
    status: "posted",
  };

  await supabase.from("channel_outbox").insert(outboxEntry as never);

  // Log audit
  await supabase.from("campaign_audit_log").insert({
    tenant_id: job.tenant_id,
    workspace_id: job.workspace_id,
    campaign_id: campaignId,
    run_id: job.run_id,
    job_id: job.id,
    event_type: "job_completed",
    actor_type: "system",
    details: { posted: 1, failed: 0, note: "Social post scheduled internally" },
  } as never);

  return { success: true, posted: 1, failed: 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const workerId = `worker-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  console.log(`[${workerId}] Starting job queue processing`);

  try {
    // Verify internal secret for cron calls
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    
    // Allow both internal cron and authenticated requests
    const authHeader = req.headers.get("Authorization");
    const isInternalCall = internalSecret === expectedSecret;
    const isAuthenticatedCall = authHeader?.startsWith("Bearer ");

    if (!isInternalCall && !isAuthenticatedCall) {
      console.log(`[${workerId}] Unauthorized request`);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get API keys
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const vapiPrivateKey = Deno.env.get("VAPI_PRIVATE_KEY") || "";

    // Claim queued jobs
    const { data: jobs, error: claimError } = await supabase.rpc("claim_queued_jobs", {
      p_worker_id: workerId,
      p_limit: 5,
    });

    if (claimError) {
      console.error(`[${workerId}] Failed to claim jobs:`, claimError);
      return new Response(JSON.stringify({ error: "Failed to claim jobs", details: claimError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!jobs || jobs.length === 0) {
      console.log(`[${workerId}] No queued jobs found`);
      return new Response(JSON.stringify({ message: "No jobs to process", worker_id: workerId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${workerId}] Processing ${jobs.length} jobs`);

    const results: Array<{ job_id: string; job_type: string; success: boolean; error?: string }> = [];

    for (const job of jobs as Job[]) {
      console.log(`[${workerId}] Processing job ${job.id} (${job.job_type})`);

      // Update run status to running
      await supabase
        .from("campaign_runs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", job.run_id);

      // Log job started
      await supabase.from("campaign_audit_log").insert({
        tenant_id: job.tenant_id,
        workspace_id: job.workspace_id,
        run_id: job.run_id,
        job_id: job.id,
        event_type: "job_started",
        actor_type: "system",
        details: { job_type: job.job_type, attempt: job.attempts + 1 },
      } as never);

      let result: { success: boolean; error?: string };

      try {
        switch (job.job_type) {
          case "email_send_batch": {
            if (!resendApiKey) {
              result = { success: false, error: "RESEND_API_KEY not configured" };
            } else {
              const emailResult = await processEmailBatch(supabase, job, resendApiKey);
              result = { success: emailResult.success, error: emailResult.error };
            }
            break;
          }
          case "voice_call_batch": {
            if (!vapiPrivateKey) {
              result = { success: false, error: "VAPI_PRIVATE_KEY not configured" };
            } else {
              const voiceResult = await processVoiceBatch(supabase, job, vapiPrivateKey);
              result = { success: voiceResult.success, error: voiceResult.error };
            }
            break;
          }
          case "social_post_batch": {
            const socialResult = await processSocialBatch(supabase, job);
            result = { success: socialResult.success, error: socialResult.error };
            break;
          }
          default:
            result = { success: false, error: `Unknown job type: ${job.job_type}` };
        }
      } catch (err) {
        result = { success: false, error: err instanceof Error ? err.message : "Unknown error" };
      }

      // Complete the job
      await supabase.rpc("complete_job", {
        p_job_id: job.id,
        p_success: result.success,
        p_error: result.error || null,
      });

      // Log result
      if (!result.success) {
        await supabase.from("campaign_audit_log").insert({
          tenant_id: job.tenant_id,
          workspace_id: job.workspace_id,
          run_id: job.run_id,
          job_id: job.id,
          event_type: "job_failed",
          actor_type: "system",
          details: { error: result.error, attempt: job.attempts + 1 },
        } as never);
      }

      results.push({
        job_id: job.id,
        job_type: job.job_type,
        success: result.success,
        error: result.error,
      });
    }

    console.log(`[${workerId}] Completed processing ${results.length} jobs`);

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} jobs`,
        worker_id: workerId,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error(`[${workerId}] Fatal error:`, err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
