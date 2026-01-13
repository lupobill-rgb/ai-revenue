import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, unauthorizedResponse, createServiceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id",
};

type SmsUsageGuardInput = {
  tenant_id: string;
  campaign_id: string;
  lead_id: string;
  phone: string;
};

type SmsUsageGuardOutput = {
  allowed: boolean;
  reason: "opted_out" | "tenant_cap" | "campaign_cap" | "recipient_freq" | null;
  remaining_today: number;
};

function mustString(v: unknown, name: string): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${name} is required`);
  return v.trim();
}

function normalizePhone(phone: string): string {
  // Minimal normalization: trim whitespace; assume E.164 provided (per contract).
  return phone.trim();
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

    const body = (await req.json().catch(() => ({}))) as Partial<SmsUsageGuardInput>;
    const tenant_id = mustString(body.tenant_id, "tenant_id");
    const campaign_id = mustString(body.campaign_id, "campaign_id");
    const lead_id = mustString(body.lead_id, "lead_id");
    const phone = normalizePhone(mustString(body.phone, "phone"));

    // Guardrail: ensure caller is operating within the request workspace context (best-effort, no refactor).
    const headerWorkspaceId = req.headers.get("x-workspace-id");
    if (headerWorkspaceId && headerWorkspaceId.trim() && headerWorkspaceId.trim() !== tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id must match x-workspace-id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createServiceClient();

    // 1) Opt-out gate
    const { data: optOut } = await supabaseAdmin
      .from("opt_outs")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("workspace_id", tenant_id)
      .eq("channel", "sms")
      .eq("phone", phone)
      .maybeSingle();

    if (optOut?.id) {
      const out: SmsUsageGuardOutput = { allowed: false, reason: "opted_out", remaining_today: 0 };
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Minimal caps (override via env; safest defaults kept high).
    const tenantDailyCap = parseCap("SMS_TENANT_DAILY_CAP", 1000);
    const campaignCap = parseCap("SMS_CAMPAIGN_CAP", 10000);

    const { startIso, endIso } = dayRangeUtc();

    // 2) Tenant daily cap (counts billable usage events)
    const { count: usedToday } = await supabaseAdmin
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .eq("workspace_id", tenant_id)
      .eq("channel", "sms")
      .gte("created_at", startIso)
      .lt("created_at", endIso);

    const used = usedToday ?? 0;
    const remaining_today = Math.max(0, tenantDailyCap - used);
    if (used >= tenantDailyCap) {
      const out: SmsUsageGuardOutput = { allowed: false, reason: "tenant_cap", remaining_today: 0 };
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3) Campaign cap (all-time billable usage events)
    const { count: usedByCampaign } = await supabaseAdmin
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .eq("workspace_id", tenant_id)
      .eq("channel", "sms")
      .eq("campaign_id", campaign_id);

    if ((usedByCampaign ?? 0) >= campaignCap) {
      const out: SmsUsageGuardOutput = { allowed: false, reason: "campaign_cap", remaining_today };
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4) Recipient frequency (24h, per campaign)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("usage_events")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("workspace_id", tenant_id)
      .eq("channel", "sms")
      .eq("campaign_id", campaign_id)
      .eq("recipient_phone", phone)
      .gte("created_at", since)
      .limit(1);

    if (recent && recent.length > 0) {
      const out: SmsUsageGuardOutput = { allowed: false, reason: "recipient_freq", remaining_today };
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const out: SmsUsageGuardOutput = { allowed: true, reason: null, remaining_today };
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[sms_usage_guard] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

