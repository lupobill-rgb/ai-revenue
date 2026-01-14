import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

type FailureEvent = {
  id: string;
  created_at: string;
  event_type: "execution_failed" | "verification_failed";
  message: string;
  details: Record<string, unknown>;
  workspace_id: string;
  ad_account_id: string;
  proposal_id: string | null;
};

function requireAuthorized(req: Request) {
  const internalSecret = req.headers.get("x-internal-secret");
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");

  const expectedSecrets = [
    Deno.env.get("INTERNAL_FUNCTION_SECRET"),
    Deno.env.get("INTERNAL_FUNCTION_SECRET_VAULT"),
    "ubigrowth-internal-2024-secure-key", // legacy compatibility
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  const hasValidInternalSecret = !!internalSecret && expectedSecrets.some((s) => s === internalSecret);
  const hasValidServiceRole = !!authHeader && authHeader.startsWith("Bearer ") && authHeader.slice(7) === serviceRoleKey;

  if (!hasValidInternalSecret && !hasValidServiceRole) {
    throw new Error("Unauthorized");
  }
}

function activityFeedLink(adAccountId: string, proposalId: string | null): string {
  const base =
    Deno.env.get("APP_URL") ||
    Deno.env.get("PUBLIC_SITE_URL") ||
    Deno.env.get("SITE_URL") ||
    "";

  // UI currently ignores these query params, but they are future-proof and harmless.
  const path = `/ads-operator?adAccountId=${encodeURIComponent(adAccountId)}${proposalId ? `&proposalId=${encodeURIComponent(proposalId)}` : ""}`;
  return base ? `${base}${path}` : path;
}

function emailBody(args: {
  accountName: string;
  proposalType: string;
  failureType: string;
  failureReason: string;
  reviewLink: string;
}): string {
  return [
    `Account: ${args.accountName}`,
    `Action: ${args.proposalType}`,
    `Status: ${args.failureType}`,
    `Reason: ${args.failureReason}`,
    `Review link: ${args.reviewLink}`,
  ].join("\n");
}

function slackText(args: {
  accountName: string;
  proposalType: string;
  failureType: string;
  failureReason: string;
  reviewLink: string;
}): string {
  return [
    "🚨 Google Ads Operator Alert",
    `Account: ${args.accountName}`,
    `Action: ${args.proposalType}`,
    `Status: ${args.failureType}`,
    `Reason: ${args.failureReason}`,
    `Review: ${args.reviewLink}`,
  ].join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    requireAuthorized(req);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // lookback 24h for unalerted failures

    // Fetch recent failure events
    const { data: events, error: eventsError } = await supabase
      .from("action_events")
      .select("id, created_at, event_type, message, details, workspace_id, ad_account_id, proposal_id")
      .in("event_type", ["execution_failed", "verification_failed"])
      .gte("created_at", windowStart.toISOString())
      .order("created_at", { ascending: true })
      .limit(200);

    if (eventsError) throw new Error(`Failed to fetch action_events: ${eventsError.message}`);

    const failureEvents = (events || []) as FailureEvent[];
    if (failureEvents.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_failures" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load already-sent ids (same window)
    const { data: sentRows, error: sentError } = await supabase
      .from("ads_operator_alerts_sent")
      .select("action_event_id")
      .gte("notified_at", windowStart.toISOString());
    if (sentError) throw new Error(`Failed to fetch alerts_sent: ${sentError.message}`);

    const sentSet = new Set((sentRows || []).map((r: any) => String(r.action_event_id)));
    const pending = failureEvents.filter((e) => !sentSet.has(e.id));

    if (pending.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "already_alerted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build user email map once
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw new Error(`Failed to list users: ${usersError.message}`);
    const userEmailById = new Map<string, string>();
    for (const u of users.users) {
      if (u.id && u.email) userEmailById.set(u.id, u.email);
    }

    const resendKey = Deno.env.get("RESEND_API_KEY") || "";
    const resend = resendKey ? new Resend(resendKey) : null;

    const slackWebhook =
      Deno.env.get("ADS_OPERATOR_SLACK_WEBHOOK_URL") ||
      Deno.env.get("SLACK_WEBHOOK_URL") ||
      Deno.env.get("OPS_WEBHOOK_URL") ||
      "";

    let sentCount = 0;
    const results: Array<{ eventId: string; email: { attempted: boolean; ok: boolean; error?: string }; slack: { attempted: boolean; ok: boolean; error?: string } }> = [];

    for (const ev of pending) {
      // Account name
      const { data: acct, error: acctError } = await supabase
        .from("ad_accounts")
        .select("name, customer_id")
        .eq("id", ev.ad_account_id)
        .maybeSingle();
      if (acctError) throw new Error(`Failed to load ad_account: ${acctError.message}`);

      const accountName = (acct?.name as string | null) || (acct?.customer_id as string | null) || ev.ad_account_id;

      // Proposal type (if available)
      let proposalType = "unknown";
      if (ev.proposal_id) {
        const { data: proposal, error: proposalError } = await supabase
          .from("action_proposals")
          .select("proposal_type")
          .eq("id", ev.proposal_id)
          .maybeSingle();
        if (!proposalError && proposal?.proposal_type) proposalType = String(proposal.proposal_type);
      }

      const failureType = ev.event_type;
      const failureReason = ev.message || "Unknown";
      const reviewLink = activityFeedLink(ev.ad_account_id, ev.proposal_id);

      // Recipients = workspace owner + members
      const { data: ws, error: wsError } = await supabase
        .from("workspaces")
        .select("owner_id")
        .eq("id", ev.workspace_id)
        .maybeSingle();
      if (wsError) throw new Error(`Failed to load workspace: ${wsError.message}`);

      const { data: members, error: membersError } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", ev.workspace_id);
      if (membersError) throw new Error(`Failed to load workspace_members: ${membersError.message}`);

      const userIds = new Set<string>();
      if (ws?.owner_id) userIds.add(String(ws.owner_id));
      for (const m of members || []) userIds.add(String((m as any).user_id));

      const emails = [...userIds].map((id) => userEmailById.get(id)).filter((e): e is string => !!e);

      const subject = "Action Failed — Review Required (Google Ads Operator)";
      const body = emailBody({
        accountName,
        proposalType,
        failureType,
        failureReason,
        reviewLink,
      });

      // Send email (one notification per failure; no retries)
      let emailOk = false;
      let emailErr: string | undefined;
      const emailAttempted = !!resend && emails.length > 0;
      if (emailAttempted) {
        try {
          const resp = await resend!.emails.send({
            from: "UbiGrowth AI <updates@ubigrowth.com>",
            to: emails,
            subject,
            html: `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap;">${body}</pre>`,
          });
          emailOk = !resp.error;
          emailErr = resp.error?.message;
        } catch (e: any) {
          emailOk = false;
          emailErr = e?.message || "Email send failed";
        }
      }

      // Slack (optional)
      let slackOk = false;
      let slackErr: string | undefined;
      const slackAttempted = !!slackWebhook;
      if (slackAttempted) {
        try {
          const resp = await fetch(slackWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: slackText({ accountName, proposalType, failureType, failureReason, reviewLink }) }),
          });
          slackOk = resp.ok;
          if (!resp.ok) slackErr = `Slack webhook failed (${resp.status})`;
        } catch (e: any) {
          slackOk = false;
          slackErr = e?.message || "Slack send failed";
        }
      }

      // Record alert attempt (even if delivery failed) to prevent automatic retries/suppression loops.
      const { error: insertError } = await supabase.from("ads_operator_alerts_sent").insert({
        action_event_id: ev.id,
        workspace_id: ev.workspace_id,
        ad_account_id: ev.ad_account_id,
        channels: {
          email: { attempted: emailAttempted, ok: emailOk, recipients: emails.length, error: emailErr },
          slack: { attempted: slackAttempted, ok: slackOk, error: slackErr },
        },
      });
      if (insertError) throw new Error(`Failed to record alert: ${insertError.message}`);

      sentCount++;
      results.push({
        eventId: ev.id,
        email: { attempted: emailAttempted, ok: emailOk, error: emailErr },
        slack: { attempted: slackAttempted, ok: slackOk, error: slackErr },
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

