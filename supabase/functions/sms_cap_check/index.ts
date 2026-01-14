import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, unauthorizedResponse, createServiceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id",
};

type SmsCapCheckInput = {
  tenant_id: string;
};

type SmsCapCheckOutput = {
  allowed: boolean;
  remaining: number;
};

function mustString(v: unknown, name: string): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${name} is required`);
  return v.trim();
}

function parseCap(envName: string, fallback: number): number {
  const raw = Deno.env.get(envName);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function dayRangeUtc(now = new Date()): { startIso: string; endIso: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await verifyAuth(req);
    if (auth.error || !auth.user || !auth.supabaseClient) {
      return unauthorizedResponse(corsHeaders, auth.error || "Unauthorized");
    }

    const body = (await req.json().catch(() => ({}))) as Partial<SmsCapCheckInput>;
    const tenant_id = mustString(body.tenant_id, "tenant_id");

    // Best-effort scoping: if workspace header exists, require match.
    const headerWorkspaceId = req.headers.get("x-workspace-id");
    if (headerWorkspaceId && headerWorkspaceId.trim() && headerWorkspaceId.trim() !== tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id must match x-workspace-id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default cap is intentionally high; override in function env.
    const tenantDailyCap = parseCap("SMS_TENANT_DAILY_CAP", 1000);
    const { startIso, endIso } = dayRangeUtc();

    const supabaseAdmin = createServiceClient();
    const { count: usedToday } = await supabaseAdmin
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .eq("workspace_id", tenant_id)
      .eq("channel", "sms")
      .eq("billable", true)
      .gte("created_at", startIso)
      .lt("created_at", endIso);

    const used = usedToday ?? 0;
    const remaining = Math.max(0, tenantDailyCap - used);
    const out: SmsCapCheckOutput = {
      allowed: used < tenantDailyCap,
      remaining,
    };

    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[sms_cap_check] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

