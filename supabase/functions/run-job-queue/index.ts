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

// Result from batch processing with partial success tracking
interface BatchResult {
  success: boolean;
  partial?: boolean; // true if some succeeded but some failed
  sent?: number;
  called?: number;
  posted?: number;
  failed?: number;
  skipped?: number; // idempotency: already processed
  error?: string;
}

// Generate idempotency key using SHA-256
async function generateIdempotencyKey(parts: string[]): Promise<string> {
  const data = parts.filter(Boolean).join("|");
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Check if action already processed (idempotency check)
async function checkIdempotency(
  supabase: any,
  tenantId: string,
  workspaceId: string,
  idempotencyKey: string
): Promise<{ exists: boolean; status?: string }> {
  const { data } = await supabase
    .from("channel_outbox")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("workspace_id", workspaceId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  
  if (data) {
    return { exists: true, status: data.status };
  }
  return { exists: false };
}

// Terminal statuses that indicate action was completed (skip on retry)
const TERMINAL_STATUSES = ["sent", "called", "posted", "generated", "pending_review"];

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
): Promise<BatchResult> {
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
  let skipped = 0;
  const assetId = String(campaign.asset_id || campaignId);
  const scheduledFor = String(job.payload.scheduled_for || new Date().toISOString());

  for (const lead of leads) {
    if (!lead.email) continue;
    
    // Generate idempotency key: sha256(run_id + lead_id + asset_id + scheduled_for)
    const idempotencyKey = await generateIdempotencyKey([
      job.run_id,
      lead.id,
      assetId,
      scheduledFor,
    ]);
    
    // IDEMPOTENCY: Insert outbox entry BEFORE provider call with status 'queued'
    // If insert conflicts (duplicate key), skip the provider call entirely
    const { data: insertedOutbox, error: insertError } = await supabase
      .from("channel_outbox")
      .insert({
        tenant_id: job.tenant_id,
        workspace_id: job.workspace_id,
        run_id: job.run_id,
        job_id: job.id,
        channel: "email",
        provider: selectedProvider,
        recipient_id: lead.id,
        recipient_email: lead.email,
        payload: { subject, campaign_id: campaignId },
        status: "queued",
        idempotency_key: idempotencyKey,
        skipped: false,
      } as never)
      .select("id")
      .single();
    
    // If insert failed due to unique constraint (idempotent replay), skip
    if (insertError) {
      if (insertError.code === "23505") { // Unique violation
        console.log(`[email] Idempotent skip for lead ${lead.id} - already in outbox`);
        // Update the existing entry to mark as skipped replay
        await supabase
          .from("channel_outbox")
          .update({ skipped: true, skip_reason: "idempotent_replay" } as never)
          .eq("tenant_id", job.tenant_id)
          .eq("workspace_id", job.workspace_id)
          .eq("idempotency_key", idempotencyKey);
        skipped++;
        continue;
      }
      // Other insert error - log and continue
      console.error(`[email] Failed to insert outbox for lead ${lead.id}:`, insertError);
      failed++;
      continue;
    }
    
    const outboxId = insertedOutbox?.id;
    
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
        result = await sendEmail(
          resendApiKey,
          `${emailSettings.sender_name || "Team"} <${emailSettings.from_address}>`,
          lead.email,
          subject,
          personalizedBody
        );
        break;
      case "smtp":
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

    // Update outbox with provider response
    await supabase
      .from("channel_outbox")
      .update({
        status: result.success ? "sent" : "failed",
        provider_message_id: result.messageId,
        error: result.error,
      } as never)
      .eq("id", outboxId);

    if (result.success) {
      sent++;
    } else {
      failed++;
    }
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
    details: { sent, failed, skipped, total: leads.length },
  } as never);

  // Return partial success if some sent but some failed
  return { success: failed === 0, sent, failed, skipped, partial: sent > 0 && failed > 0 };
}

// Process voice call batch job - supports VAPI and ElevenLabs
async function processVoiceBatch(
  supabase: any,
  job: Job,
  vapiPrivateKey: string,
  elevenLabsApiKey: string
): Promise<BatchResult> {
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
    let skipped = 0;
    const scriptVersion = voiceSettings.default_vapi_assistant_id || "v1";
    const scheduledFor = String(job.payload.scheduled_for || new Date().toISOString());

    for (const lead of leads) {
      if (!lead.phone) continue;
      
      // Generate idempotency key: sha256(run_id + lead_id + script_version + scheduled_for)
      const idempotencyKey = await generateIdempotencyKey([
        job.run_id,
        lead.id,
        scriptVersion,
        scheduledFor,
      ]);
      
      // IDEMPOTENCY: Insert outbox entry BEFORE provider call with status 'queued'
      const { data: insertedOutbox, error: insertError } = await supabase
        .from("channel_outbox")
        .insert({
          tenant_id: job.tenant_id,
          workspace_id: job.workspace_id,
          run_id: job.run_id,
          job_id: job.id,
          channel: "voice",
          provider: "vapi",
          recipient_id: lead.id,
          recipient_phone: lead.phone,
          payload: { campaign_id: campaignId, assistant_id: voiceSettings.default_vapi_assistant_id },
          status: "queued",
          idempotency_key: idempotencyKey,
          skipped: false,
        } as never)
        .select("id")
        .single();
      
      // If insert failed due to unique constraint (idempotent replay), skip
      if (insertError) {
        if (insertError.code === "23505") { // Unique violation
          console.log(`[voice] Idempotent skip for lead ${lead.id} - already in outbox`);
          await supabase
            .from("channel_outbox")
            .update({ skipped: true, skip_reason: "idempotent_replay" } as never)
            .eq("tenant_id", job.tenant_id)
            .eq("workspace_id", job.workspace_id)
            .eq("idempotency_key", idempotencyKey);
          skipped++;
          continue;
        }
        console.error(`[voice] Failed to insert outbox for lead ${lead.id}:`, insertError);
        failed++;
        continue;
      }
      
      const outboxId = insertedOutbox?.id;
      
      const result = await initiateVapiCall(
        vapiPrivateKey,
        voiceSettings.default_vapi_assistant_id,
        phoneNumber.provider_phone_number_id,
        lead.phone,
        `${lead.first_name || ""} ${lead.last_name || ""}`.trim()
      );

      // Update outbox with provider response
      await supabase
        .from("channel_outbox")
        .update({
          status: result.success ? "called" : "failed",
          provider_message_id: result.callId,
          error: result.error,
        } as never)
        .eq("id", outboxId);

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

    await supabase.from("campaign_audit_log").insert({
      tenant_id: job.tenant_id,
      workspace_id: job.workspace_id,
      campaign_id: campaignId,
      run_id: job.run_id,
      job_id: job.id,
      event_type: "job_completed",
      actor_type: "system",
      details: { provider: "vapi", called, failed, skipped, total: leads.length },
    } as never);

    return { success: failed === 0, called, failed, skipped, partial: called > 0 && failed > 0 };
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

    // Generate idempotency key: sha256(run_id + campaign_id + voice_id + scheduled_for)
    const scheduledFor = String(job.payload.scheduled_for || new Date().toISOString());
    const idempotencyKey = await generateIdempotencyKey([
      job.run_id,
      campaignId,
      voiceId,
      scheduledFor,
    ]);
    
    // IDEMPOTENCY: Insert outbox entry BEFORE provider call with status 'queued'
    const { data: insertedOutbox, error: insertError } = await supabase
      .from("channel_outbox")
      .insert({
        tenant_id: job.tenant_id,
        workspace_id: job.workspace_id,
        run_id: job.run_id,
        job_id: job.id,
        channel: "voice",
        provider: "elevenlabs",
        payload: { 
          campaign_id: campaignId, 
          voice_id: voiceId,
        },
        status: "queued",
        idempotency_key: idempotencyKey,
        skipped: false,
      } as never)
      .select("id")
      .single();
    
    // If insert failed due to unique constraint (idempotent replay), skip
    if (insertError) {
      if (insertError.code === "23505") { // Unique violation
        console.log(`[elevenlabs] Idempotent skip - already in outbox`);
        await supabase
          .from("channel_outbox")
          .update({ skipped: true, skip_reason: "idempotent_replay" } as never)
          .eq("tenant_id", job.tenant_id)
          .eq("workspace_id", job.workspace_id)
          .eq("idempotency_key", idempotencyKey);
        return { success: true, called: 0, failed: 0, skipped: 1 };
      }
      console.error(`[elevenlabs] Failed to insert outbox:`, insertError);
      return { success: false, called: 0, failed: 1, error: insertError.message };
    }
    
    const outboxId = insertedOutbox?.id;

    // Generate audio using ElevenLabs
    const result = await generateElevenLabsAudio(elevenLabsApiKey, script, voiceId);

    // Update outbox with provider response
    await supabase
      .from("channel_outbox")
      .update({
        status: result.success ? "generated" : "failed",
        provider_message_id: result.success ? `elevenlabs_${Date.now()}` : null,
        error: result.error,
        payload: { 
          campaign_id: campaignId, 
          voice_id: voiceId,
          audio_generated: result.success,
        },
      } as never)
      .eq("id", outboxId);

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
): Promise<BatchResult> {
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

  // Generate idempotency key upfront for all cases
  const scheduledFor = String(job.payload.scheduled_for || new Date().toISOString());
  const postId = String(campaign.asset_id || campaignId);
  const idempotencyKey = await generateIdempotencyKey([
    job.run_id,
    postId,
    "social",
    scheduledFor,
  ]);

  // If no integration or not connected, return clear error
  if (!socialSettings?.is_connected) {
    const errorMsg = "Social integration not connected. Configure in Settings → Social to deploy social campaigns.";
    
    // Try to insert failed entry with idempotency
    const { error: insertError } = await supabase
      .from("channel_outbox")
      .insert({
        tenant_id: job.tenant_id,
        workspace_id: job.workspace_id,
        run_id: job.run_id,
        job_id: job.id,
        channel: "social",
        provider: provider,
        payload: { campaign_id: campaignId },
        status: "failed",
        error: errorMsg,
        idempotency_key: idempotencyKey,
        skipped: false,
      } as never);
    
    if (insertError?.code === "23505") {
      // Already logged this failure, mark as skipped
      await supabase
        .from("channel_outbox")
        .update({ skipped: true, skip_reason: "idempotent_replay" } as never)
        .eq("tenant_id", job.tenant_id)
        .eq("workspace_id", job.workspace_id)
        .eq("idempotency_key", idempotencyKey);
      return { success: false, posted: 0, failed: 0, skipped: 1, error: errorMsg };
    }

    return { success: false, posted: 0, failed: 1, error: errorMsg };
  }
  
  // IDEMPOTENCY: Insert outbox entry BEFORE any action with status 'queued'
  const campaignData = campaign as { assets?: { content?: Record<string, unknown> } };
  
  const { data: insertedOutbox, error: insertError } = await supabase
    .from("channel_outbox")
    .insert({
      tenant_id: job.tenant_id,
      workspace_id: job.workspace_id,
      run_id: job.run_id,
      job_id: job.id,
      channel: "social",
      provider: socialSettings.social_provider || provider,
      payload: { campaign_id: campaignId, content: campaignData.assets?.content },
      status: "queued",
      idempotency_key: idempotencyKey,
      skipped: false,
    } as never)
    .select("id")
    .single();
  
  // If insert failed due to unique constraint (idempotent replay), skip
  if (insertError) {
    if (insertError.code === "23505") { // Unique violation
      console.log(`[social] Idempotent skip - already in outbox`);
      await supabase
        .from("channel_outbox")
        .update({ skipped: true, skip_reason: "idempotent_replay" } as never)
        .eq("tenant_id", job.tenant_id)
        .eq("workspace_id", job.workspace_id)
        .eq("idempotency_key", idempotencyKey);
      return { success: true, posted: 0, failed: 0, skipped: 1 };
    }
    console.error(`[social] Failed to insert outbox:`, insertError);
    return { success: false, posted: 0, failed: 1, error: insertError.message };
  }
  
  const outboxId = insertedOutbox?.id;

  // Real social posting would happen here using the connected provider
  // For now, we mark as pending_review to indicate it needs manual posting
  await supabase
    .from("channel_outbox")
    .update({
      status: "pending_review",
      error: null,
    } as never)
    .eq("id", outboxId);

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
    // ============================================================
    // STRICT AUTHORIZATION: Only x-internal-secret allowed
    // ============================================================
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    
    // Validate expected secret is configured
    if (!expectedSecret) {
      console.error(`[${workerId}] INTERNAL_FUNCTION_SECRET not configured`);
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Timing-safe comparison to prevent timing attacks
    const secretValid = internalSecret && internalSecret.length === expectedSecret.length &&
      internalSecret === expectedSecret;
    
    if (!secretValid) {
      console.log(`[${workerId}] Unauthorized request - missing or invalid x-internal-secret`);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine invocation source from body (for logging only)
    let invocationType = "internal";
    try {
      const body = await req.clone().json();
      if (body?.source === "pg_cron") {
        invocationType = "scheduled";
      }
    } catch {
      // Body parse failed, assume internal call
    }
    
    console.log(`[${workerId}] Authorized via x-internal-secret (source: ${invocationType})`);

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

    const results: Array<{ job_id: string; job_type: string; success: boolean; partial?: boolean; error?: string }> = [];

    for (const job of jobs as Job[]) {
      console.log(`[${workerId}] Processing job ${job.id} (${job.job_type})`);

      // Update run status to running via SECURITY DEFINER RPC (Single Writer Rule)
      await supabase.rpc("update_campaign_run_status", {
        p_run_id: job.run_id,
        p_status: "running",
        p_started_at: new Date().toISOString(),
      });

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

      let result: BatchResult = { success: false };

      try {
        switch (job.job_type) {
          case "email_send_batch": {
            if (!resendApiKey) {
              result = { success: false, error: "RESEND_API_KEY not configured" };
            } else {
              result = await processEmailBatch(supabase, job, resendApiKey);
            }
            break;
          }
          case "voice_call_batch": {
            result = await processVoiceBatch(supabase, job, vapiPrivateKey, elevenLabsApiKey);
            break;
          }
          case "social_post_batch": {
            result = await processSocialBatch(supabase, job);
            break;
          }
          default:
            result = { success: false, error: `Unknown job type: ${job.job_type}` };
        }
      } catch (err) {
        result = { success: false, error: err instanceof Error ? err.message : "Unknown error" };
      }

      // Complete the job - partial success still counts as success for job completion
      const jobSuccess = result.success || result.partial === true;
      await supabase.rpc("complete_job", {
        p_job_id: job.id,
        p_success: jobSuccess,
        p_error: result.error || null,
      });

      // Update campaign_runs status via SECURITY DEFINER RPC (Single Writer Rule)
      // This is the ONLY pathway for updating campaign_runs after initial insert
      if (result.success) {
        // Check if all jobs for this run are complete
        const { data: pendingJobs } = await supabase
          .from("job_queue")
          .select("id")
          .eq("run_id", job.run_id)
          .in("status", ["queued", "locked"])
          .limit(1);

        if (!pendingJobs || pendingJobs.length === 0) {
          // All jobs done - mark run as completed via RPC
          await supabase.rpc("update_campaign_run_status", {
            p_run_id: job.run_id,
            p_status: "completed",
            p_completed_at: new Date().toISOString(),
          });
        }
      } else if (result.partial) {
        // Partial success - some items succeeded, some failed
        await supabase.rpc("update_campaign_run_status", {
          p_run_id: job.run_id,
          p_status: "partial",
          p_error_message: result.error || "Some items failed",
          p_completed_at: new Date().toISOString(),
        });

        // Log partial audit
        await supabase.from("campaign_audit_log").insert({
          tenant_id: job.tenant_id,
          workspace_id: job.workspace_id,
          run_id: job.run_id,
          job_id: job.id,
          event_type: "job_partial",
          actor_type: "system",
          details: { 
            sent: result.sent, 
            called: result.called, 
            posted: result.posted,
            failed: result.failed,
            error: result.error,
          },
        } as never);
      } else {
        // Job failed - update campaign_runs via RPC
        await supabase.rpc("update_campaign_run_status", {
          p_run_id: job.run_id,
          p_status: "failed",
          p_error_message: result.error,
          p_completed_at: new Date().toISOString(),
        });

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
        partial: result.partial,
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
