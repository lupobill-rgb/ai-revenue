import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, unauthorizedResponse, createServiceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id",
};

type SmsSendInput = {
  tenant_id: string;
  campaign_id: string;
  recipient: {
    phone: string;
    lead_id: string;
  };
  sms_text: string;
};

type SmsSendOutput = {
  message_sid: string;
  status: "sent";
  provider: "twilio";
};

function mustString(v: unknown, name: string): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${name} is required`);
  return v.trim();
}

function normalizePhone(phone: string): string {
  return phone.trim();
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isSandboxMode(): boolean {
  const env = (Deno.env.get("SMS_PROVIDER_MODE") || "").toLowerCase().trim();
  if (env === "sandbox") return true;
  if (env === "live") return false;
  // Default: sandbox if Twilio creds are missing (CI-safe).
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  const tok = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const from = Deno.env.get("TWILIO_FROM_NUMBER") || "";
  return !(sid && tok && from);
}

async function callTwilioSend(args: { to: string; from: string; body: string }): Promise<{ sid: string; raw: any }> {
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const twilioFromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || "";

  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    throw new Error("Twilio credentials not configured (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER)");
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
  const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

  const response = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: args.to,
      From: args.from || twilioFromNumber,
      Body: args.body,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.message || `Twilio error: ${response.status}`);
  }
  if (!result?.sid) throw new Error("Twilio response missing sid");
  return { sid: String(result.sid), raw: result };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await verifyAuth(req);
    if (auth.error || !auth.user || !auth.supabaseClient) {
      return unauthorizedResponse(corsHeaders, auth.error || "Unauthorized");
    }

    const body = (await req.json().catch(() => ({}))) as Partial<SmsSendInput>;
    const tenant_id = mustString(body.tenant_id, "tenant_id");
    const campaign_id = mustString(body.campaign_id, "campaign_id");
    const lead_id = mustString(body.recipient?.lead_id, "recipient.lead_id");
    const phone = normalizePhone(mustString(body.recipient?.phone, "recipient.phone"));
    const sms_text = mustString(body.sms_text, "sms_text");

    const headerWorkspaceId = req.headers.get("x-workspace-id");
    if (headerWorkspaceId && headerWorkspaceId.trim() && headerWorkspaceId.trim() !== tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id must match x-workspace-id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createServiceClient();

    // Defensive: call sms_usage_guard first (orchestrator may have done it already).
    const guardResp = await supabaseAdmin.functions.invoke("sms_usage_guard", {
      body: { tenant_id, campaign_id, lead_id, phone },
    });

    if (guardResp.error) {
      return new Response(JSON.stringify({ error: `sms_usage_guard failed: ${guardResp.error.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const guard = guardResp.data as { allowed?: boolean; reason?: string | null };
    if (!guard?.allowed) {
      return new Response(JSON.stringify({ error: "blocked", reason: guard?.reason || "blocked" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency key: per (tenant, campaign, lead, sms_text, day)
    const day = new Date().toISOString().slice(0, 10);
    const idempotency_key = await sha256Hex([tenant_id, campaign_id, lead_id, phone, sms_text, day].join("|"));

    // IMPORTANT (kernel invariant): Only dispatcher/allowlist functions may write `channel_outbox`.
    // `sms_send` is a direct-send endpoint, so it logs to `message_logs` instead.
    const { data: existingLog } = await supabaseAdmin
      .from("message_logs")
      .select("provider_message_id, status")
      .eq("tenant_id", tenant_id)
      .eq("workspace_id", tenant_id)
      .eq("channel", "sms")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();

    if (existingLog?.provider_message_id && existingLog.status === "sent") {
      const out: SmsSendOutput = { message_sid: String(existingLog.provider_message_id), status: "sent", provider: "twilio" };
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Provider call (sandbox-safe default for CI).
    const sandbox = isSandboxMode();
    let messageSid = "";
    let providerResponse: any = null;

    try {
      if (sandbox) {
        messageSid = `sandbox-${Date.now()}-${idempotency_key.slice(0, 8)}`;
        providerResponse = { sandbox: true, message: "Simulated Twilio send", sid: messageSid };
      } else {
        const from = Deno.env.get("TWILIO_FROM_NUMBER") || "";
        const tw = await callTwilioSend({ to: phone, from, body: sms_text });
        messageSid = tw.sid;
        providerResponse = tw.raw;
      }

      // Log message (idempotent)
      await supabaseAdmin.from("message_logs").upsert(
        {
          tenant_id,
          workspace_id: tenant_id,
          channel: "sms",
          provider: "twilio",
          status: "sent",
          campaign_id,
          lead_id,
          recipient_phone: phone,
          message_text: sms_text,
          provider_message_id: messageSid,
          provider_response: providerResponse || {},
          idempotency_key,
        } as never,
        { onConflict: "tenant_id,channel,idempotency_key" }
      );

      // Usage event (billable unit)
      await supabaseAdmin.from("usage_events").insert({
        tenant_id,
        workspace_id: tenant_id,
        channel: "sms",
        units: 1,
        billable: true,
        campaign_id,
        lead_id,
        recipient_phone: phone,
        provider: "twilio",
        provider_message_id: messageSid,
        metadata: { sandbox },
      } as never);

      // Lead activity log (existing pattern used by worker)
      await supabaseAdmin.from("lead_activities").insert({
        lead_id,
        activity_type: "sms_sent",
        description: sandbox ? "SMS sent via Twilio (sandbox)" : "SMS sent via Twilio",
        metadata: { campaign_id, provider_message_id: messageSid, sandbox },
      } as never);

      const out: SmsSendOutput = { message_sid: messageSid, status: "sent", provider: "twilio" };
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[sms_send] Provider send failed:", msg);

      await supabaseAdmin.from("message_logs").upsert(
        {
          tenant_id,
          workspace_id: tenant_id,
          channel: "sms",
          provider: "twilio",
          status: "failed",
          campaign_id,
          lead_id,
          recipient_phone: phone,
          message_text: sms_text,
          provider_response: providerResponse || {},
          error: msg,
          idempotency_key,
        } as never,
        { onConflict: "tenant_id,channel,idempotency_key" }
      );

      return new Response(JSON.stringify({ error: msg }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("[sms_send] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

