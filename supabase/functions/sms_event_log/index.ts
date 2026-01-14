import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, unauthorizedResponse, createServiceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id",
};

type SmsEventLogInput = {
  tenant_id: string;
  campaign_id?: string | null;
  lead_id?: string | null;
  recipient_phone?: string | null;
  event_type: "queued" | "sent" | "failed" | "blocked" | "opt_out" | "other";
  status?: "queued" | "sent" | "failed" | "blocked" | null;
  provider?: "twilio" | string | null;
  provider_message_id?: string | null;
  cost_estimate?: number | null;
  metadata?: Record<string, unknown> | null;
};

type SmsEventLogOutput = { ok: true };

function mustString(v: unknown, name: string): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${name} is required`);
  return v.trim();
}

function optionalString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function optionalNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await verifyAuth(req);
    if (auth.error || !auth.user || !auth.supabaseClient) {
      return unauthorizedResponse(corsHeaders, auth.error || "Unauthorized");
    }

    const body = (await req.json().catch(() => ({}))) as Partial<SmsEventLogInput>;
    const tenant_id = mustString(body.tenant_id, "tenant_id");
    const event_type = mustString(body.event_type, "event_type") as SmsEventLogInput["event_type"];

    // Best-effort scoping: if workspace header exists, require match.
    const headerWorkspaceId = req.headers.get("x-workspace-id");
    if (headerWorkspaceId && headerWorkspaceId.trim() && headerWorkspaceId.trim() !== tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id must match x-workspace-id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createServiceClient();

    // We log as an immutable row in usage_events (non-billable by default to avoid double charging).
    // Billing is enforced in `sms_send` via billable=true units=1 rows.
    await supabaseAdmin.from("usage_events").insert({
      tenant_id,
      workspace_id: tenant_id,
      channel: "sms",
      units: 0,
      billable: false,
      campaign_id: optionalString(body.campaign_id),
      lead_id: optionalString(body.lead_id),
      recipient_phone: optionalString(body.recipient_phone),
      provider: optionalString(body.provider) || "twilio",
      provider_message_id: optionalString(body.provider_message_id),
      metadata: {
        event_type,
        status: optionalString(body.status),
        cost_estimate: optionalNumber(body.cost_estimate),
        ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}),
      },
    } as never);

    const out: SmsEventLogOutput = { ok: true };
    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[sms_event_log] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

