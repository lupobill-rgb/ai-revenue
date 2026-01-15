import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { verifyAuth, createServiceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SmsSendResponse = {
  status: "accepted" | "blocked" | "failed";
  reason: string | null;
  message_id: string | null;
};

function normalizePhone(phone: string): string {
  return phone.trim();
}

serve(async (req) => {
  const buildHeaderValue = Deno.env.get("AI_REVENUE_BUILD") ?? "dev";
  const responseHeaders = { ...corsHeaders, "x-ai-revenue-build": buildHeaderValue };

  if (req.method === "OPTIONS") return new Response(null, { headers: responseHeaders });

  const { user, error: authError, supabaseClient } = await verifyAuth(req);
  // Launch contract: ALWAYS 200 and NEVER { error: ... }
  if (authError || !user || !supabaseClient) {
    return new Response(
      JSON.stringify({ status: "failed", reason: "unauthorized", message_id: null } satisfies SmsSendResponse),
      { status: 200, headers: { ...responseHeaders, "Content-Type": "application/json" } }
    );
  }

  let phone = "";
  let message = "";
  let workspaceId = "";
  try {
    const body = await req.json();
    phone = typeof body?.phone === "string" ? body.phone : "";
    message = typeof body?.message === "string" ? body.message : "";
    workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : "";
  } catch {
    // Can't reliably log without a workspace; return stable shape.
    return new Response(
      JSON.stringify({ status: "failed", reason: "invalid_json", message_id: null } satisfies SmsSendResponse),
      { status: 200, headers: { ...responseHeaders, "Content-Type": "application/json" } }
    );
  }

  phone = normalizePhone(phone);
  message = message.trim();

  if (!workspaceId) {
    return new Response(
      JSON.stringify({ status: "failed", reason: "workspace_required", message_id: null } satisfies SmsSendResponse),
      { status: 200, headers: { ...responseHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!phone) {
    return new Response(
      JSON.stringify({ status: "failed", reason: "phone_required", message_id: null } satisfies SmsSendResponse),
      { status: 200, headers: { ...responseHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!message) {
    return new Response(
      JSON.stringify({ status: "failed", reason: "message_required", message_id: null } satisfies SmsSendResponse),
      { status: 200, headers: { ...responseHeaders, "Content-Type": "application/json" } }
    );
  }

  // Ensure caller has access to the workspace (RLS-enforced check).
  const { data: ws } = await supabaseClient
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!ws?.id) {
    // Still return stable shape; avoid leaking workspace existence.
    return new Response(
      JSON.stringify({ status: "failed", reason: "workspace_access_denied", message_id: null } satisfies SmsSendResponse),
      { status: 200, headers: { ...responseHeaders, "Content-Type": "application/json" } }
    );
  }

  const serviceClient = createServiceClient();
  const logMessage = async (entry: {
    status: "accepted" | "blocked" | "failed";
    reason: string | null;
    provider_message_id: string | null;
  }) => {
    try {
      await serviceClient.from("message_logs").insert({
        workspace_id: workspaceId,
        tenant_id: workspaceId,
        channel: "sms",
        to_phone: phone,
        status: entry.status,
        reason: entry.reason,
        provider_message_id: entry.provider_message_id,
        created_at: new Date().toISOString(),
      } as never);
    } catch {
      // Best effort; response contract must still succeed.
    }
  };

  // Simple recipient frequency block: if any SMS outbox row exists for this phone in last 60s.
  let isRecipientFreqBlocked = false;
  try {
    const { data: last } = await serviceClient
      .from("message_logs")
      .select("created_at")
      .eq("workspace_id", workspaceId)
      .eq("channel", "sms")
      .eq("to_phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (last?.created_at) {
      const ageMs = Date.now() - new Date(last.created_at as string).getTime();
      if (ageMs >= 0 && ageMs < 60_000) isRecipientFreqBlocked = true;
    }
  } catch {
    // If the block check fails, fail open (do not block).
  }

  if (isRecipientFreqBlocked) {
    await logMessage({ status: "blocked", reason: "recipient_freq", provider_message_id: null });
    return new Response(
      JSON.stringify({ status: "blocked", reason: "recipient_freq", message_id: null } satisfies SmsSendResponse),
      { status: 200, headers: { ...responseHeaders, "Content-Type": "application/json" } }
    );
  }

  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const twilioFromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || "";

  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    await logMessage({ status: "failed", reason: "twilio_not_configured", provider_message_id: null });
    return new Response(
      JSON.stringify({ status: "failed", reason: "twilio_not_configured", message_id: null } satisfies SmsSendResponse),
      { status: 200, headers: { ...responseHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: twilioFromNumber,
        Body: message,
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
      await logMessage({ status: "failed", reason: "provider_error", provider_message_id: null });
      return new Response(
        JSON.stringify({ status: "failed", reason: "provider_error", message_id: null } satisfies SmsSendResponse),
        { status: 200, headers: { ...responseHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageId = typeof result?.sid === "string" ? result.sid : null;
    await logMessage({ status: "accepted", reason: null, provider_message_id: messageId });
    return new Response(
      JSON.stringify({ status: "accepted", reason: null, message_id: messageId } satisfies SmsSendResponse),
      { status: 200, headers: { ...responseHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    await logMessage({ status: "failed", reason: "provider_error", provider_message_id: null });
    return new Response(
      JSON.stringify({ status: "failed", reason: "provider_error", message_id: null } satisfies SmsSendResponse),
      { status: 200, headers: { ...responseHeaders, "Content-Type": "application/json" } }
    );
  }
});

