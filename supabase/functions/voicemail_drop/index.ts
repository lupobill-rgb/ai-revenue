import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { verifyAuth, createServiceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type VoicemailDropResponse = {
  status: "accepted" | "failed";
  audio_fetch_status: number;
  job_id: null;
};

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json200(body: VoicemailDropResponse): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(phone: string): string {
  return phone.trim();
}

async function fetchAudioStatus(audioUrl: string): Promise<number> {
  // Prefer HEAD; fall back to GET if HEAD is not allowed.
  try {
    const head = await fetch(audioUrl, { method: "HEAD" });
    return head.status;
  } catch {
    // ignore
  }
  try {
    const get = await fetch(audioUrl, { method: "GET" });
    return get.status;
  } catch {
    return 0;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { user, error: authError, supabaseClient } = await verifyAuth(req);
  // Return stable shape; do not emit { error: ... }.
  if (authError || !user || !supabaseClient) {
    return json200({ status: "failed", audio_fetch_status: 0, job_id: null });
  }

  let phone = "";
  let audioUrl = "";
  let workspaceId = "";
  try {
    const body = await req.json();
    phone = typeof body?.phone === "string" ? body.phone : "";
    audioUrl = typeof body?.audioUrl === "string" ? body.audioUrl : "";
    workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : "";
  } catch {
    return json200({ status: "failed", audio_fetch_status: 0, job_id: null });
  }

  phone = normalizePhone(phone);
  audioUrl = audioUrl.trim();

  if (!workspaceId || !phone) {
    return json200({ status: "failed", audio_fetch_status: 0, job_id: null });
  }

  // Ensure caller has access to the workspace (RLS-enforced check).
  const { data: ws } = await supabaseClient
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!ws?.id) {
    return json200({ status: "failed", audio_fetch_status: 0, job_id: null });
  }

  // If not provided, use a known-good public audio sample.
  if (!audioUrl) {
    audioUrl = "https://demo.twilio.com/docs/classic.mp3";
  }

  const audioFetchStatus = await fetchAudioStatus(audioUrl);

  const serviceClient = createServiceClient();
  const logMessage = async (entry: { status: "accepted" | "failed"; reason: string | null }) => {
    try {
      await serviceClient.from("message_logs").insert({
        workspace_id: workspaceId,
        tenant_id: workspaceId,
        channel: "voicemail",
        to_phone: phone,
        status: entry.status,
        reason: entry.reason,
        provider_message_id: null,
        created_at: new Date().toISOString(),
      } as never);
    } catch {
      // Best effort
    }
  };
  const idempotencyKey = await sha256Hex(
    `${workspaceId}|voicemail_drop|${phone}|${audioUrl}|${Date.now()}|${crypto.randomUUID()}`
  );

  // Always log a row.
  const baseOutboxInsert: Record<string, unknown> = {
    tenant_id: workspaceId,
    workspace_id: workspaceId,
    channel: "voicemail",
    provider: "twilio",
    recipient_phone: phone,
    payload: { to: phone, audio_url: audioUrl, audio_fetch_status: audioFetchStatus },
    idempotency_key: idempotencyKey,
    skipped: false,
  };

  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const twilioFromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || "";

  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    await serviceClient.from("channel_outbox").insert({
      ...baseOutboxInsert,
      status: "failed",
      error: "twilio_not_configured",
    } as never);
    await logMessage({ status: "failed", reason: "twilio_not_configured" });

    return json200({ status: "failed", audio_fetch_status: audioFetchStatus, job_id: null });
  }

  // Insert queued outbox row first.
  const { data: insertedOutbox, error: insertError } = await serviceClient
    .from("channel_outbox")
    .insert({
      ...baseOutboxInsert,
      status: "queued",
    } as never)
    .select("id")
    .single();

  if (insertError || !insertedOutbox?.id) {
    await logMessage({ status: "failed", reason: "log_insert_failed" });
    return json200({ status: "failed", audio_fetch_status: audioFetchStatus, job_id: null });
  }

  const outboxId = insertedOutbox.id as string;

  // Minimal "voicemail drop" implementation: place a call that plays the audio URL.
  // Uses Twimlets to avoid hosting TwiML.
  const twiml = `<Response><Play>${audioUrl}</Play></Response>`;
  const twimlUrl = `https://twimlets.com/echo?Twiml=${encodeURIComponent(twiml)}`;

  try {
    const callsUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`;
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const response = await fetch(callsUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: twilioFromNumber,
        Url: twimlUrl,
      }),
    });

    const resultText = await response.text();
    let result: any = {};
    try {
      result = JSON.parse(resultText);
    } catch {
      result = { raw: resultText };
    }

    if (!response.ok) {
      const errorMsg = result?.message || `twilio_error_${response.status}`;
      await serviceClient.from("channel_outbox").update({
        status: "failed",
        error: errorMsg,
        provider_response: result,
      } as never).eq("id", outboxId);

      await logMessage({ status: "failed", reason: "provider_error" });
      return json200({ status: "failed", audio_fetch_status: audioFetchStatus, job_id: null });
    }

    const callSid = typeof result?.sid === "string" ? result.sid : null;
    await serviceClient.from("channel_outbox").update({
      status: "called",
      provider_message_id: callSid,
      provider_response: result,
      error: null,
    } as never).eq("id", outboxId);

    await logMessage({ status: "accepted", reason: null });
    return json200({ status: "accepted", audio_fetch_status: audioFetchStatus, job_id: null });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "unknown_error";
    await serviceClient.from("channel_outbox").update({
      status: "failed",
      error: errorMsg,
    } as never).eq("id", outboxId);

    await logMessage({ status: "failed", reason: "provider_error" });
    return json200({ status: "failed", audio_fetch_status: audioFetchStatus, job_id: null });
  }
});

