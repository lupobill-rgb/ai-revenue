import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

function requireAuthorized(req: Request) {
  const internalSecret = req.headers.get("x-internal-secret");
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");

  const expectedSecrets = [
    Deno.env.get("INTERNAL_FUNCTION_SECRET"),
    Deno.env.get("INTERNAL_FUNCTION_SECRET_VAULT"),
    "ubigrowth-internal-2024-secure-key",
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const hasValidInternalSecret = !!internalSecret && expectedSecrets.some((s) => s === internalSecret);
  const hasValidServiceRole = !!authHeader && authHeader.startsWith("Bearer ") && authHeader.slice(7) === serviceRoleKey;
  if (!hasValidInternalSecret && !hasValidServiceRole) throw new Error("Unauthorized");
}

function safeStr(v: unknown, fallback = "N/A"): string {
  if (typeof v === "string" && v.trim()) return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

function formatMoney(v: unknown): string {
  const s = safeStr(v);
  if (s === "N/A") return s;
  return s.trim().startsWith("$") ? s.trim() : `$${s.trim()}`;
}

function formatPct(v: unknown): string {
  const s = safeStr(v);
  if (s === "N/A") return s;
  return s.trim().endsWith("%") ? s.trim() : `${s.trim()}%`;
}

function bullets(v: unknown): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v)) {
    const lines = v.map((x) => safeStr(x, "")).filter(Boolean);
    if (lines.length === 0) return "N/A";
    return lines.map((l) => `- ${l}`).join("\n");
  }
  return "N/A";
}

function weekEndFromStart(weekStart: string): string {
  // Minimal date formatting required for the template.
  // weekStart is YYYY-MM-DD.
  try {
    const d = new Date(`${weekStart}T00:00:00Z`);
    const end = new Date(d.getTime() + 6 * 24 * 60 * 60 * 1000);
    return end.toISOString().slice(0, 10);
  } catch {
    return "N/A";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    requireAuthorized(req);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const resendKey = Deno.env.get("RESEND_API_KEY") || "";
    const resend = resendKey ? new Resend(resendKey) : null;

    // Build user email map once
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw new Error(`Failed to list users: ${usersError.message}`);
    const userEmailById = new Map<string, string>();
    for (const u of users.users) {
      if (u.id && u.email) userEmailById.set(u.id, u.email);
    }

    // Find weekly summaries that have not been emailed yet (last 21 days)
    const now = new Date();
    const windowStart = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);

    const { data: summaries, error: sumErr } = await supabase
      .from("weekly_summaries")
      .select("id, workspace_id, ad_account_id, week_start_date, summary, created_at")
      .gte("created_at", windowStart.toISOString())
      .order("week_start_date", { ascending: false })
      .limit(500);
    if (sumErr) throw new Error(`Failed to fetch weekly_summaries: ${sumErr.message}`);

    const { data: sentRows, error: sentErr } = await supabase
      .from("ads_operator_weekly_emails_sent")
      .select("weekly_summary_id")
      .gte("sent_at", windowStart.toISOString());
    if (sentErr) throw new Error(`Failed to fetch weekly emails sent: ${sentErr.message}`);

    const sentSet = new Set((sentRows || []).map((r: any) => String(r.weekly_summary_id)));
    const pending = (summaries || []).filter((s: any) => !sentSet.has(String(s.id)));

    if (pending.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "nothing_to_send" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce "once per week per ad account": pick most recent unsent summary per ad account.
    const pickedByAccount = new Map<string, any>();
    for (const s of pending) {
      const adAccountId = String(s.ad_account_id);
      if (!pickedByAccount.has(adAccountId)) pickedByAccount.set(adAccountId, s);
    }
    const toSend = [...pickedByAccount.values()];

    let sentCount = 0;
    const results: any[] = [];

    for (const s of toSend) {
      const weeklySummaryId = String(s.id);
      const workspaceId = String(s.workspace_id);
      const adAccountId = String(s.ad_account_id);
      const weekStart = String(s.week_start_date);
      const weekEnd = safeStr((s.summary || {})?.week_end, weekEndFromStart(weekStart));

      const summary = (s.summary || {}) as Record<string, unknown>;

      // Account name for subject
      const { data: acct, error: acctErr } = await supabase
        .from("ad_accounts")
        .select("name, customer_id")
        .eq("id", adAccountId)
        .maybeSingle();
      if (acctErr) throw new Error(`Failed to load ad_account: ${acctErr.message}`);
      const accountName = (acct?.name as string | null) || (acct?.customer_id as string | null) || adAccountId;

      // Recipients = workspace owner + members
      const { data: ws, error: wsError } = await supabase
        .from("workspaces")
        .select("owner_id")
        .eq("id", workspaceId)
        .maybeSingle();
      if (wsError) throw new Error(`Failed to load workspace: ${wsError.message}`);

      const { data: members, error: membersError } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId);
      if (membersError) throw new Error(`Failed to load workspace_members: ${membersError.message}`);

      const userIds = new Set<string>();
      if (ws?.owner_id) userIds.add(String(ws.owner_id));
      for (const m of members || []) userIds.add(String((m as any).user_id));
      const emails = [...userIds].map((id) => userEmailById.get(id)).filter((e): e is string => !!e);

      const subject = `Weekly Google Ads Summary — ${accountName}`;

      // No new calculations: all values below are read from summary JSON (or N/A).
      const body = [
        `Period: ${weekStart} – ${weekEnd}`,
        "",
        `Spend: ${formatMoney(summary.total_spend)} (${formatPct(summary.spend_delta_pct)})`,
        `Conversions: ${safeStr(summary.total_conversions)} (${formatPct(summary.conversion_delta_pct)})`,
        `CPA: ${formatMoney(summary.cpa)} (${formatPct(summary.cpa_delta_pct)})`,
        `ROAS: ${safeStr(summary.roas)} (${formatPct(summary.roas_delta_pct)})`,
        "",
        "Actions:",
        `- Executed: ${safeStr(summary.actions_executed_count)}`,
        `- Approved: ${safeStr(summary.actions_approved_count)}`,
        `- Blocked for safety: ${safeStr(summary.actions_blocked_count)}`,
        "",
        "Top actions taken:",
        bullets(summary.top_actions_bulleted),
        "",
        "Blocked actions (and why):",
        bullets(summary.blocked_actions_bulleted),
        "",
        'Footer:',
        '"All actions are logged, reversible, and executed only within your approved guardrails."',
      ].join("\n");

      let emailAttempted = false;
      let emailOk = false;
      let emailErr: string | undefined;

      if (resend && emails.length > 0) {
        emailAttempted = true;
        try {
          const resp = await resend.emails.send({
            from: "UbiGrowth AI <updates@ubigrowth.com>",
            to: emails,
            subject,
            html: `<pre style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; white-space: pre-wrap;">${body}</pre>`,
          });
          emailOk = !resp.error;
          emailErr = resp.error?.message;
        } catch (e: any) {
          emailOk = false;
          emailErr = e?.message || "Email send failed";
        }
      }

      // Record attempt (even if delivery failed) to avoid automatic retries.
      const { error: insertErr } = await supabase.from("ads_operator_weekly_emails_sent").insert({
        weekly_summary_id: weeklySummaryId,
        workspace_id: workspaceId,
        ad_account_id: adAccountId,
        week_start_date: weekStart,
        channels: {
          email: { attempted: emailAttempted, ok: emailOk, recipients: emails.length, error: emailErr },
        },
      });
      if (insertErr) throw new Error(`Failed to record weekly email send: ${insertErr.message}`);

      sentCount++;
      results.push({
        weeklySummaryId,
        adAccountId,
        weekStart,
        email: { attempted: emailAttempted, ok: emailOk, recipients: emails.length, error: emailErr },
      });
    }

    return new Response(JSON.stringify({ ok: true, sent: sentCount, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const msg = error?.message ? String(error.message) : "Unknown error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

