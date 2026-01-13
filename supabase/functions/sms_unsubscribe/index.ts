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

    const body = (await req.json().catch(() => ({}))) as Partial<SmsUnsubscribeInput>;
    const tenant_id = mustString(body.tenant_id, "tenant_id");
    const phone = normalizePhone(mustString(body.phone, "phone"));
    const keyword = normalizeKeyword(mustString(body.keyword, "keyword"));

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
      const out: SmsUnsubscribeOutput = { unsubscribed: true };
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    const out: SmsUnsubscribeOutput = { unsubscribed: true };
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[sms_unsubscribe] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

