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
  voice_provider: string | null;
  default_vapi_assistant_id: string | null;
  vapi_private_key: string | null;
  default_elevenlabs_voice_id: string | null;
  elevenlabs_api_key: string | null;
  is_connected: boolean | null;
}

interface PhoneNumber {
  id: string;
  provider_phone_number_id: string | null;
  phone_number: string;
}

interface QueueStats {
  queued: number;
  locked: number;
  completed: number;
  failed: number;
  dead: number;
}

// Log job queue tick for audit trail
async function logJobQueueTick(
  supabase: any,
  workerId: string,
  invocationType: string,
  stats: QueueStats,
  processedCount: number,
  error: string | null
): Promise<void> {
  try {
    await supabase.from("campaign_audit_log").insert({
      tenant_id: "00000000-0000-0000-0000-000000000000", // System-level audit
      workspace_id: "00000000-0000-0000-0000-000000000000",
      event_type: "job_queue_tick",
      actor_type: "scheduler",
      details: {
        worker_id: workerId,
        invocation_type: invocationType,
        timestamp: new Date().toISOString(),
        queue_stats: stats,
        jobs_processed: processedCount,
        error: error,
      },
    } as never);
  } catch (logError) {
    console.error(`[${workerId}] Failed to log job queue tick:`, logError);
  }
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
async function initiateVapiCall(
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

// Generate voice message via ElevenLabs TTS
async function generateElevenLabsAudio(
  elevenLabsApiKey: string,
  text: string,
  voiceId: string
): Promise<{ success: boolean; audioBase64?: string; error?: string }> {
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          output_format: "mp3_44100_128",
        }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return { success: false, error: errorData.detail?.message || `ElevenLabs error: ${res.status}` };
    }

    const audioBuffer = await res.arrayBuffer();
    // Convert to base64 for storage
    const uint8Array = new Uint8Array(audioBuffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const audioBase64 = btoa(binary);
    
    return { success: true, audioBase64 };
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

// Process voice call batch job - supports VAPI and ElevenLabs
async function processVoiceBatch(
  supabase: any,
  job: Job,
  vapiPrivateKey: string,
  elevenLabsApiKey: string
): Promise<{ success: boolean; called: number; failed: number; error?: string }> {
  const campaignId = job.payload.campaign_id as string;
  const provider = (job.payload.provider as string) || "vapi";

  // Get voice settings
  const { data: voiceSettingsData } = await supabase
    .from("ai_settings_voice")
    .select("*")
    .eq("tenant_id", job.tenant_id)
    .single();

  const voiceSettings = voiceSettingsData as VoiceSettings | null;

  // Validate provider-specific requirements
  if (provider === "vapi") {
    if (!voiceSettings?.default_vapi_assistant_id) {
      return { success: false, called: 0, failed: 0, error: "VAPI not configured - missing assistant ID. Configure in Settings → Voice." };
    }
    if (!vapiPrivateKey) {
      return { success: false, called: 0, failed: 0, error: "VAPI_PRIVATE_KEY not configured" };
    }

    // Get phone number for VAPI calls
    const { data: phoneNumbersData } = await supabase
      .from("voice_phone_numbers")
      .select("*")
      .eq("tenant_id", job.tenant_id)
      .eq("is_default", true)
      .limit(1);

    const phoneNumbers = (phoneNumbersData || []) as PhoneNumber[];
    const phoneNumber = phoneNumbers[0];
    
    if (!phoneNumber?.provider_phone_number_id) {
      return { success: false, called: 0, failed: 0, error: "No default phone number configured for VAPI" };
    }

    // Get leads to call
    const { data: leadsData } = await supabase
      .from("leads")
      .select("id, phone, first_name, last_name")
      .eq("workspace_id", job.workspace_id)
      .not("phone", "is", null)
      .limit(10);

    const leads = (leadsData || []) as Lead[];

    if (leads.length === 0) {
      return { success: false, called: 0, failed: 0, error: "No leads found with phone numbers" };
    }

    let called = 0;
    let failed = 0;
    const outboxEntries: Record<string, unknown>[] = [];

    for (const lead of leads) {
      if (!lead.phone) continue;
      
      const result = await initiateVapiCall(
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

    if (outboxEntries.length > 0) {
      await supabase.from("channel_outbox").insert(outboxEntries as never[]);
    }

    await supabase.from("campaign_audit_log").insert({
      tenant_id: job.tenant_id,
      workspace_id: job.workspace_id,
      campaign_id: campaignId,
      run_id: job.run_id,
      job_id: job.id,
      event_type: "job_completed",
      actor_type: "system",
      details: { provider: "vapi", called, failed, total: leads.length },
    } as never);

    return { success: failed === 0, called, failed };
  } 
  
  // ElevenLabs TTS provider
  if (provider === "elevenlabs") {
    if (!elevenLabsApiKey) {
      return { success: false, called: 0, failed: 0, error: "ELEVENLABS_API_KEY not configured" };
    }

    const voiceId = voiceSettings?.default_elevenlabs_voice_id || "JBFqnCBsd6RMkjVDRZzb"; // Default: George

    // Get campaign asset with voice script
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("*, assets(*)")
      .eq("id", campaignId)
      .single();

    if (!campaign) {
      return { success: false, called: 0, failed: 0, error: "Campaign not found" };
    }

    const campaignData = campaign as { assets?: { content?: Record<string, unknown> } };
    const script = (campaignData.assets?.content as Record<string, string>)?.script || 
                   (campaignData.assets?.content as Record<string, string>)?.body ||
                   "Hello, this is an automated message.";

    // Generate audio using ElevenLabs
    const result = await generateElevenLabsAudio(elevenLabsApiKey, script, voiceId);

    const outboxEntry = {
      tenant_id: job.tenant_id,
      workspace_id: job.workspace_id,
      run_id: job.run_id,
      job_id: job.id,
      channel: "voice",
      provider: "elevenlabs",
      payload: { 
        campaign_id: campaignId, 
        voice_id: voiceId,
        audio_generated: result.success,
      },
      status: result.success ? "generated" : "failed",
      provider_message_id: result.success ? `elevenlabs_${Date.now()}` : null,
      error: result.error,
    };

    await supabase.from("channel_outbox").insert(outboxEntry as never);

    await supabase.from("campaign_audit_log").insert({
      tenant_id: job.tenant_id,
      workspace_id: job.workspace_id,
      campaign_id: campaignId,
      run_id: job.run_id,
      job_id: job.id,
      event_type: "job_completed",
      actor_type: "system",
      details: { 
        provider: "elevenlabs", 
        audio_generated: result.success, 
        voice_id: voiceId,
        error: result.error,
      },
    } as never);

    return { 
      success: result.success, 
      called: result.success ? 1 : 0, 
      failed: result.success ? 0 : 1,
      error: result.error,
    };
  }

  return { success: false, called: 0, failed: 0, error: `Unknown voice provider: ${provider}` };
}

// Process social post batch job
async function processSocialBatch(
  supabase: any,
  job: Job
): Promise<{ success: boolean; posted: number; failed: number; error?: string }> {
  const campaignId = job.payload.campaign_id as string;
  const provider = (job.payload.provider as string) || "internal";

  // Get campaign asset with social content
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*, assets(*)")
    .eq("id", campaignId)
    .single();

  if (!campaign) {
    return { success: false, posted: 0, failed: 0, error: "Campaign not found" };
  }

  // Check if social integration is connected
  const { data: socialSettings } = await supabase
    .from("ai_settings_social")
    .select("*")
    .eq("tenant_id", job.tenant_id)
    .single();

  // If no integration or not connected, return clear error
  if (!socialSettings?.is_connected) {
    const errorMsg = "Social integration not connected. Configure in Settings → Social to deploy social campaigns.";
    
    await supabase.from("channel_outbox").insert({
      tenant_id: job.tenant_id,
      workspace_id: job.workspace_id,
      run_id: job.run_id,
      job_id: job.id,
      channel: "social",
      provider: provider,
      payload: { campaign_id: campaignId },
      status: "failed",
      error: errorMsg,
    } as never);

    return { success: false, posted: 0, failed: 1, error: errorMsg };
  }

  // Real social posting would happen here using the connected provider
  // For now, we mark as pending_review to indicate it needs manual posting
  const campaignData = campaign as { assets?: { content?: Record<string, unknown> } };
  
  const outboxEntry = {
    tenant_id: job.tenant_id,
    workspace_id: job.workspace_id,
    run_id: job.run_id,
    job_id: job.id,
    channel: "social",
    provider: socialSettings.social_provider || provider,
    payload: { campaign_id: campaignId, content: campaignData.assets?.content },
    status: "pending_review",
    error: null,
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
    details: { 
      posted: 1, 
      failed: 0, 
      note: `Social post queued for ${socialSettings.social_provider || "manual"} review`,
      provider: socialSettings.social_provider,
    },
  } as never);

  return { success: true, posted: 1, failed: 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const workerId = `worker-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const runStartTime = new Date().toISOString();
  console.log(`[${workerId}] Starting job queue processing at ${runStartTime}`);

  try {
    // Check if this is a scheduled invocation (Supabase passes specific headers)
    const isScheduledCall = req.headers.get("x-supabase-cron") === "true";
    
    // Verify internal secret for manual/API calls
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    
    // Allow scheduled calls, internal secret calls, or authenticated requests
    const authHeader = req.headers.get("Authorization");
    const isInternalCall = internalSecret && internalSecret === expectedSecret;
    const isAuthenticatedCall = authHeader?.startsWith("Bearer ");

    if (!isScheduledCall && !isInternalCall && !isAuthenticatedCall) {
      console.log(`[${workerId}] Unauthorized request - rejecting`);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invocationType = isScheduledCall ? "scheduled" : isInternalCall ? "internal" : "authenticated";
    console.log(`[${workerId}] Authorized via: ${invocationType}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get API keys
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const vapiPrivateKey = Deno.env.get("VAPI_PRIVATE_KEY") || "";
    const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY") || "";

    // Get job queue stats before processing
    const { data: queueStats } = await supabase
      .from("job_queue")
      .select("status")
      .in("status", ["queued", "locked", "completed", "failed", "dead"]);
    
    const statusCounts = {
      queued: 0,
      locked: 0,
      completed: 0,
      failed: 0,
      dead: 0,
    };
    
    for (const job of queueStats || []) {
      const status = job.status as keyof typeof statusCounts;
      if (status in statusCounts) {
        statusCounts[status]++;
      }
    }

    // Claim queued jobs
    const { data: jobs, error: claimError } = await supabase.rpc("claim_queued_jobs", {
      p_worker_id: workerId,
      p_limit: 5,
    });

    if (claimError) {
      console.error(`[${workerId}] Failed to claim jobs:`, claimError);
      
      // Log the tick even on error
      await logJobQueueTick(supabase, workerId, invocationType, statusCounts, 0, claimError.message);
      
      return new Response(JSON.stringify({ error: "Failed to claim jobs", details: claimError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claimedCount = jobs?.length || 0;

    if (!jobs || jobs.length === 0) {
      console.log(`[${workerId}] No queued jobs found`);
      
      // Log the tick with no jobs
      await logJobQueueTick(supabase, workerId, invocationType, statusCounts, 0, null);
      
      return new Response(JSON.stringify({ 
        message: "No jobs to process", 
        worker_id: workerId,
        queue_stats: statusCounts,
      }), {
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
            const voiceResult = await processVoiceBatch(supabase, job, vapiPrivateKey, elevenLabsApiKey);
            result = { success: voiceResult.success, error: voiceResult.error };
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

      // Update campaign_runs status based on job result
      if (result.success) {
        // Check if all jobs for this run are complete
        const { data: pendingJobs } = await supabase
          .from("job_queue")
          .select("id")
          .eq("run_id", job.run_id)
          .in("status", ["queued", "locked"])
          .limit(1);

        if (!pendingJobs || pendingJobs.length === 0) {
          // All jobs done - mark run as completed
          await supabase
            .from("campaign_runs")
            .update({ 
              status: "completed", 
              completed_at: new Date().toISOString() 
            })
            .eq("id", job.run_id);
        }
      } else {
        // Job failed - update campaign_runs with error
        await supabase
          .from("campaign_runs")
          .update({ 
            status: "failed", 
            error_message: result.error,
            completed_at: new Date().toISOString()
          })
          .eq("id", job.run_id);

        // Log failure audit
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

    // Log the tick with results
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    statusCounts.completed += successCount;
    statusCounts.failed += failCount;
    await logJobQueueTick(supabase, workerId, invocationType, statusCounts, results.length, null);

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} jobs`,
        worker_id: workerId,
        queue_stats: statusCounts,
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
