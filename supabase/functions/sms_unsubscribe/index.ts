import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireBasicAuth, basicAuthResponse } from "../_shared/basic-auth.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id, x-internal-secret",
};

type SmsUnsubscribeInput = {
  tenant_id: string;
  phone: string;
  keyword: string;
};

type SmsUnsubscribeOutput = {
  unsubscribed: true;
};

function mustString(v: unknown, name: string): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${name} is required`);
  return v.trim();
}

function normalizePhone(phone: string): string {
  return phone.trim();
}

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toUpperCase();
}

function isOptOutKeyword(k: string): boolean {
  return ["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(k);
}

function isFormUrlEncoded(req: Request): boolean {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  return ct.includes("application/x-www-form-urlencoded");
}

function twimlMessage(body: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Message>${body}</Message>\n</Response>\n`;
  return new Response(xml, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/xml; charset=utf-8",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Minimal verification pattern (copy of capture-screenshot):
    // Allow via: 1) Basic Auth, 2) Internal secret header, 3) Valid JWT
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedInternal = Deno.env.get("INTERNAL_FUNCTION_SECRET") || "";
    const hasValidInternalSecret = !!internalSecret && internalSecret === expectedInternal;

    // Twilio webhook can be configured with Basic Auth in the callback URL.
    const hasBasicAuth = requireBasicAuth(req, "UG_ADMIN_BASIC_USER", "UG_ADMIN_BASIC_PASS");

    // Allow authenticated app calls too.
    const hasAuthHeader = req.headers.get("Authorization")?.startsWith("Bearer ");

    if (!hasValidInternalSecret && !hasBasicAuth && !hasAuthHeader) {
      return basicAuthResponse("UbiGrowth SMS Unsubscribe", corsHeaders);
    }

    // If a Bearer token is present, verify it (do not refactor auth).
    if (hasAuthHeader && !hasValidInternalSecret && !hasBasicAuth) {
      const auth = await verifyAuth(req);
      if (auth.error || !auth.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Support Twilio webhooks (application/x-www-form-urlencoded) AND JSON (existing smoke harness).
    // Twilio typically sends: From, To, Body. We require tenant_id via querystring for MVP:
    // e.g. /sms_unsubscribe?tenant_id=<workspace_uuid>
    let tenant_id = "";
    let phone = "";
    let keyword = "";

    if (isFormUrlEncoded(req)) {
      const url = new URL(req.url);
      tenant_id = mustString(url.searchParams.get("tenant_id"), "tenant_id");

      const raw = await req.text();
      const params = new URLSearchParams(raw);
      phone = normalizePhone(mustString(params.get("From"), "From"));
      keyword = normalizeKeyword(mustString(params.get("Body"), "Body"));
    } else {
      const body = (await req.json().catch(() => ({}))) as Partial<SmsUnsubscribeInput>;
      tenant_id = mustString(body.tenant_id, "tenant_id");
      phone = normalizePhone(mustString(body.phone, "phone"));
      keyword = normalizeKeyword(mustString(body.keyword, "keyword"));
    }

    // Best-effort scoping: if workspace header exists, require match.
    const headerWorkspaceId = req.headers.get("x-workspace-id");
    if (headerWorkspaceId && headerWorkspaceId.trim() && headerWorkspaceId.trim() !== tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id must match x-workspace-id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isOptOutKeyword(keyword)) {
      // Not an unsubscribe keyword; do nothing but respond successfully (fastest viable).
      if (isFormUrlEncoded(req)) {
        // Acknowledge without sending a message.
        return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>\n`, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/xml; charset=utf-8" },
        });
      }

      const out: SmsUnsubscribeOutput = { unsubscribed: true };
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createServiceClient();
    await supabaseAdmin.from("opt_outs").upsert(
      {
        tenant_id,
        workspace_id: tenant_id,
        channel: "sms",
        phone,
      } as never,
      { onConflict: "tenant_id,channel,phone" }
    );

    if (isFormUrlEncoded(req)) {
      // Twilio webhook: respond with confirmation SMS via TwiML (no extra provider call).
      return twimlMessage("You’re unsubscribed. No more messages. Reply START to re-subscribe.");
    }

    const out: SmsUnsubscribeOutput = { unsubscribed: true };
    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[sms_unsubscribe] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";

    // For Twilio webhook callers, do not 500-loop; acknowledge with generic TwiML.
    // This prevents repeated webhook retries while we still log server-side errors.
    // (MVP: Twilio retry storms are worse than a missing confirmation message.)
    if (isFormUrlEncoded(req)) {
      return twimlMessage("OK");
    }

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

