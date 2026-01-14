import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

type SmokeResult = {
  name: string;
  status: number;
  ok: boolean;
  bodyText: string;
  buildHeader: string | null;
};

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function firstEnv(...names: string[]): string | null {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return null;
}

function inferSupabaseUrlFromConfigToml(): string | null {
  try {
    const p = "supabase/config.toml";
    if (!fs.existsSync(p)) return null;
    const txt = fs.readFileSync(p, "utf8");
    const m = txt.match(/project_id\s*=\s*"([a-z0-9]+)"/i);
    const projectId = m?.[1];
    if (!projectId) return null;
    return `https://${projectId}.supabase.co`;
  } catch {
    return null;
  }
}

function truncate(s: string, max = 1400) {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…(truncated)";
}

function isJwtLikeKey(key: string) {
  const parts = key.split(".");
  return parts.length === 3 && key.startsWith("eyJ");
}

async function callEdgeFunction(opts: {
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  workspaceId: string;
  name: string;
  body?: unknown;
}): Promise<SmokeResult> {
  const url = `${opts.supabaseUrl.replace(/\/+$/, "")}/functions/v1/${opts.name}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      apikey: opts.anonKey,
      "Content-Type": "application/json",
      "x-workspace-id": opts.workspaceId,
    },
    body: JSON.stringify(opts.body ?? {}),
  });

  const bodyText = await resp.text().catch(() => "");
  const buildHeader = resp.headers.get("x-ai-revenue-build");
  return { name: opts.name, status: resp.status, ok: resp.ok, bodyText, buildHeader };
}

async function main() {
  const supabaseUrl = firstEnv("SUPABASE_URL", "VITE_SUPABASE_URL") || inferSupabaseUrlFromConfigToml();
  const anonKey = firstEnv("SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing env: SUPABASE_ANON_KEY/VITE_SUPABASE_PUBLISHABLE_KEY (and SUPABASE_URL if config.toml is absent)");
  }
  if (!isJwtLikeKey(anonKey)) {
    throw new Error(
      "Invalid API key: expected Supabase anon/public JWT key (starts with 'eyJ...') from Project Settings → API → Project API keys. " +
        "The short 'sb_publishable_...' key will be rejected by supabase-js here."
    );
  }

  const email = requiredEnv("SMOKE_EMAIL");
  const password = requiredEnv("SMOKE_PASSWORD");

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signInData.session?.access_token) {
    throw new Error(`Auth failed: ${signInError?.message || "no session"}`);
  }

  const accessToken = signInData.session.access_token;
  const userId = signInData.user?.id;
  if (!userId) throw new Error("Auth failed: missing user id");

  let workspaceId = process.env.SMOKE_WORKSPACE_ID || null;
  if (!workspaceId) {
    const { data: ownedWs } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    workspaceId = ownedWs?.id || null;
  }

  if (!workspaceId) {
    const { data: memberWs } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ workspace_id: string }>();
    workspaceId = memberWs?.workspace_id || null;
  }

  if (!workspaceId) {
    throw new Error("Unable to resolve workspace. Set SMOKE_WORKSPACE_ID explicitly.");
  }

  let failed = false;

  const run = async (name: string, body?: unknown) => {
    const r = await callEdgeFunction({ supabaseUrl, anonKey, accessToken, workspaceId, name, body });
    const line = `${r.ok ? "PASS" : "FAIL"} ${r.name} -> ${r.status}`;
    const details = truncate(r.bodyText || "");
    console.log(line);
    if (!r.ok) {
      failed = true;
      console.log(`  x-ai-revenue-build: ${r.buildHeader || "<missing>"}`);
    }
    console.log(details ? `  ${details.replace(/\n/g, "\n  ")}` : "  (empty body)");
    console.log("");
    return r;
  };

  // Helper Supabase client with user JWT (for RLS SELECT verification)
  const authed = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  // ============================================================
  // DAY 1 SMS SMOKES (merge-blocking)
  // Notes:
  // - CI should run without Twilio creds; sms_send defaults to sandbox mode when TWILIO_* are missing.
  // - These are contract-level checks for the new `sms_*` Edge Functions.
  // ============================================================

  // Use a deterministic synthetic campaign id for smoke purposes (does not need to exist in DB for our tables).
  // Assumption: campaign_id is treated as an opaque UUID string for the new additive tables.
  const smokeCampaignId = "00000000-0000-0000-0000-000000000001";
  const smokeLeadId = userId; // Fastest viable: use authed user id as a stand-in UUID for lead_id.
  const smokePhone = "+15550001001";

  // sms_generate.smoke: asserts <=160 chars + contains opt-out.
  const smsGen = await run("sms_generate", {
    tenant_id: workspaceId,
    campaign_id: smokeCampaignId,
    audience_context: {
      persona: "Busy founder",
      offer: "AI-Revenue helps you book more qualified demos without hiring SDRs",
      cta: "Reply YES to get a quick overview",
    },
    constraints: { max_chars: 160, include_opt_out: true },
  });

  try {
    const parsed = JSON.parse(smsGen.bodyText || "{}");
    const smsText = String(parsed.sms_text || "");
    const charCount = Number(parsed.char_count || 0);
    const contains = !!parsed.contains_opt_out;
    if (!smsText || smsText.length > 160 || charCount > 160 || !contains) {
      throw new Error(`sms_generate contract failed: len=${smsText.length}, char_count=${charCount}, contains_opt_out=${contains}`);
    }
  } catch (e) {
    failed = true;
    console.error(`FAIL sms_generate.smoke -> ${(e as Error).message}`);
  }

  // Verify SMS asset stored (campaign_assets)
  try {
    const { data, error } = await authed
      .from("campaign_assets")
      .select("id")
      .eq("tenant_id", workspaceId)
      .eq("campaign_id", smokeCampaignId)
      .eq("type", "sms")
      .limit(1);
    if (error || !data || data.length === 0) {
      throw new Error(`campaign_assets missing sms asset: ${error?.message || "no rows"}`);
    }
  } catch (e) {
    failed = true;
    console.error(`FAIL sms_asset_store.smoke -> ${(e as Error).message}`);
  }

  // sms_unsubscribe.smoke: simulate STOP -> opt_out persisted.
  const smsUnsub = await run("sms_unsubscribe", {
    tenant_id: workspaceId,
    phone: smokePhone,
    keyword: "STOP",
  });

  if (!smsUnsub.ok) {
    failed = true;
  }

  // Verify opt_out persisted
  try {
    const { data, error } = await authed
      .from("opt_outs")
      .select("id")
      .eq("tenant_id", workspaceId)
      .eq("channel", "sms")
      .eq("phone", smokePhone)
      .limit(1);
    if (error || !data || data.length === 0) {
      throw new Error(`opt_outs missing row: ${error?.message || "no rows"}`);
    }
  } catch (e) {
    failed = true;
    console.error(`FAIL sms_unsubscribe_persist.smoke -> ${(e as Error).message}`);
  }

  // sms_cap.smoke: opted-out should block usage guard.
  const cap = await run("sms_usage_guard", {
    tenant_id: workspaceId,
    campaign_id: smokeCampaignId,
    lead_id: smokeLeadId,
    phone: smokePhone,
  });

  try {
    const parsed = JSON.parse(cap.bodyText || "{}");
    if (parsed.allowed !== false || parsed.reason !== "opted_out") {
      throw new Error(`sms_usage_guard expected opted_out block, got allowed=${parsed.allowed}, reason=${parsed.reason}`);
    }
  } catch (e) {
    failed = true;
    console.error(`FAIL sms_cap.smoke -> ${(e as Error).message}`);
  }

  // sms_send.smoke: sandbox Twilio send + logs created.
  const smsSend = await run("sms_send", {
    tenant_id: workspaceId,
    campaign_id: smokeCampaignId,
    recipient: { phone: "+15550001002", lead_id: smokeLeadId },
    sms_text: "Quick note: want the 2-minute overview? Reply YES. Reply STOP to opt out",
  });

  try {
    const parsed = JSON.parse(smsSend.bodyText || "{}");
    if (parsed.provider !== "twilio" || parsed.status !== "sent" || !parsed.message_sid) {
      throw new Error(`sms_send bad response shape: ${smsSend.bodyText}`);
    }
  } catch (e) {
    failed = true;
    console.error(`FAIL sms_send.smoke -> ${(e as Error).message}`);
  }

  // Verify logs + usage created
  try {
    const parsed = JSON.parse(smsSend.bodyText || "{}");
    const sid = String(parsed.message_sid || "");
    const { data: logs, error: logErr } = await authed
      .from("message_logs")
      .select("id")
      .eq("tenant_id", workspaceId)
      .eq("channel", "sms")
      .eq("provider_message_id", sid)
      .limit(1);
    if (logErr || !logs || logs.length === 0) {
      throw new Error(`message_logs missing row: ${logErr?.message || "no rows"}`);
    }

    const { data: usage, error: usageErr } = await authed
      .from("usage_events")
      .select("id")
      .eq("tenant_id", workspaceId)
      .eq("channel", "sms")
      .eq("campaign_id", smokeCampaignId)
      .limit(1);
    if (usageErr || !usage || usage.length === 0) {
      throw new Error(`usage_events missing row: ${usageErr?.message || "no rows"}`);
    }
  } catch (e) {
    failed = true;
    console.error(`FAIL sms_logs_usage.smoke -> ${(e as Error).message}`);
  }

  // sms_cap_check.smoke: asserts response shape
  const capCheck = await run("sms_cap_check", { tenant_id: workspaceId });
  try {
    const parsed = JSON.parse(capCheck.bodyText || "{}");
    if (typeof parsed.allowed !== "boolean" || typeof parsed.remaining !== "number") {
      throw new Error(`sms_cap_check bad shape: ${capCheck.bodyText}`);
    }
  } catch (e) {
    failed = true;
    console.error(`FAIL sms_cap_check.smoke -> ${(e as Error).message}`);
  }

  // sms_event_log.smoke: writes a non-billable usage_events row (immutable event log)
  const smokeEventProviderId = `smoke-event-${Date.now()}`;
  const evt = await run("sms_event_log", {
    tenant_id: workspaceId,
    campaign_id: smokeCampaignId,
    lead_id: smokeLeadId,
    recipient_phone: "+15550001003",
    event_type: "other",
    status: "queued",
    provider: "twilio",
    provider_message_id: smokeEventProviderId,
    cost_estimate: 0.007,
    metadata: { smoke: true },
  });
  if (!evt.ok) failed = true;

  try {
    const { data, error } = await authed
      .from("usage_events")
      .select("id")
      .eq("tenant_id", workspaceId)
      .eq("channel", "sms")
      .eq("provider_message_id", smokeEventProviderId)
      .limit(1);
    if (error || !data || data.length === 0) {
      throw new Error(`sms_event_log did not persist usage_events row: ${error?.message || "no rows"}`);
    }
  } catch (e) {
    failed = true;
    console.error(`FAIL sms_event_log_persist.smoke -> ${(e as Error).message}`);
  }

  // ============================================================
  // DAY 2 SOCIAL (LinkedIn) SMOKES (merge-blocking)
  // ============================================================

  const socialGen = await run("social_generate_linkedin", {
    tenant_id: workspaceId,
    campaign_id: smokeCampaignId,
    topic: "How to reduce no-shows",
    audience: "B2B founders",
    offer: "We automate follow-ups that increase show rate",
    cta: "Comment 'PLAYBOOK' and I’ll DM it",
    constraints: { max_chars: 3000, include_hashtags: true },
  });

  try {
    const parsed = JSON.parse(socialGen.bodyText || "{}");
    if (!parsed.hook || !parsed.body || !parsed.post_text || !Array.isArray(parsed.hashtags)) {
      throw new Error(`social_generate_linkedin bad shape: ${socialGen.bodyText}`);
    }
  } catch (e) {
    failed = true;
    console.error(`FAIL social_generate.smoke -> ${(e as Error).message}`);
  }

  // Verify social asset stored and capture its id
  let socialAssetId: string | null = null;
  try {
    const { data, error } = await authed
      .from("campaign_assets")
      .select("id")
      .eq("tenant_id", workspaceId)
      .eq("campaign_id", smokeCampaignId)
      .eq("type", "social_linkedin")
      .order("created_at", { ascending: false })
      .limit(1);
    socialAssetId = data?.[0]?.id || null;
    if (error || !socialAssetId) throw new Error(error?.message || "no rows");
  } catch (e) {
    failed = true;
    console.error(`FAIL social_asset_store.smoke -> ${(e as Error).message}`);
  }

  const socialApproval = socialAssetId
    ? await run("social_submit_for_approval", {
        tenant_id: workspaceId,
        campaign_id: smokeCampaignId,
        asset_id: socialAssetId,
        channel: "social_linkedin",
      })
    : null;

  let socialApprovalId: string | null = null;
  if (!socialApproval || !socialApproval.ok) {
    failed = true;
  } else {
    try {
      const parsed = JSON.parse(socialApproval.bodyText || "{}");
      socialApprovalId = String(parsed.approval_id || "");
      if (!socialApprovalId || parsed.status !== "pending") {
        throw new Error(`social_submit_for_approval bad shape: ${socialApproval.bodyText}`);
      }
    } catch (e) {
      failed = true;
      console.error(`FAIL social_approval.smoke -> ${(e as Error).message}`);
    }
  }

  // Verify approval record stored
  if (socialApprovalId) {
    try {
      const { data, error } = await authed
        .from("approvals")
        .select("id,status")
        .eq("id", socialApprovalId)
        .limit(1);
      if (error || !data || data.length === 0 || data[0].status !== "pending") {
        throw new Error(`approvals missing pending row: ${error?.message || "no rows"}`);
      }
    } catch (e) {
      failed = true;
      console.error(`FAIL social_approval_persist.smoke -> ${(e as Error).message}`);
    }
  }

  // social_publish_guard.smoke: must fail if not approved (expected)
  if (socialApprovalId) {
    const pub = await run("social_publish_linkedin_manual", {
      tenant_id: workspaceId,
      campaign_id: smokeCampaignId,
      approval_id: socialApprovalId,
    });
    if (pub.ok) {
      failed = true;
      console.error("FAIL social_publish_guard.smoke -> expected non-OK when not approved");
    }
  }

  // ============================================================
  // DAY 3-4 LANDING PAGES SMOKES (merge-blocking)
  // ============================================================

  const landingGen = await run("landing_page_generate", {
    tenant_id: workspaceId,
    campaign_id: smokeCampaignId,
    brand: { name: "AI-Revenue" },
    offer: "A simple system to turn inbound interest into booked calls",
    audience: "B2B teams",
    cta: { primary: "Get the playbook" },
    constraints: { tone: "direct", sections: ["hero", "benefits", "cta"] },
  });

  let landingAssetId: string | null = null;
  try {
    const parsed = JSON.parse(landingGen.bodyText || "{}");
    landingAssetId = String(parsed.asset_id || "");
    const page = parsed.page || {};
    if (!landingAssetId || !page.title || !page.hero_headline || !Array.isArray(page.benefits) || page.benefits.length < 3) {
      throw new Error(`landing_page_generate bad shape: ${landingGen.bodyText}`);
    }
  } catch (e) {
    failed = true;
    console.error(`FAIL landing_generate.smoke -> ${(e as Error).message}`);
  }

  // Verify landing asset stored
  if (landingAssetId) {
    try {
      const { data, error } = await authed
        .from("campaign_assets")
        .select("id")
        .eq("id", landingAssetId)
        .eq("tenant_id", workspaceId)
        .eq("campaign_id", smokeCampaignId)
        .eq("type", "landing_page")
        .limit(1);
      if (error || !data || data.length === 0) throw new Error(error?.message || "no rows");
    } catch (e) {
      failed = true;
      console.error(`FAIL landing_asset_store.smoke -> ${(e as Error).message}`);
    }
  }

  const landingApproval = landingAssetId
    ? await run("landing_page_submit_for_approval", {
        tenant_id: workspaceId,
        campaign_id: smokeCampaignId,
        asset_id: landingAssetId,
        channel: "landing_page",
      })
    : null;

  let landingApprovalId: string | null = null;
  if (!landingApproval || !landingApproval.ok) {
    failed = true;
  } else {
    try {
      const parsed = JSON.parse(landingApproval.bodyText || "{}");
      landingApprovalId = String(parsed.approval_id || "");
      if (!landingApprovalId || parsed.status !== "pending") {
        throw new Error(`landing_page_submit_for_approval bad shape: ${landingApproval.bodyText}`);
      }
    } catch (e) {
      failed = true;
      console.error(`FAIL landing_approval.smoke -> ${(e as Error).message}`);
    }
  }

  // Publish guard: must block when not approved
  if (landingApprovalId) {
    const pub = await run("landing_page_publish_vercel", {
      tenant_id: workspaceId,
      campaign_id: smokeCampaignId,
      approval_id: landingApprovalId,
      slug: "smoke-test-landing",
    });
    if (pub.ok) {
      failed = true;
      console.error("FAIL landing_publish_guard.smoke -> expected non-OK when not approved");
    }
  }

  // 1) Autopilot (AI Voice + AI Email)
  const autopilot = await run("ai-cmo-autopilot-build", {
    icp: "B2B SaaS founders with 10-50 employees",
    offer: "AI-powered marketing automation platform",
    channels: ["email", "voice"],
    desiredResult: "leads",
    workspaceId,
  });

  let autopilotCampaignId: string | null = null;
  try {
    const raw = (autopilot.bodyText || "").trim();
    // Sometimes proxies prepend/append whitespace; keep parsing resilient.
    const jsonCandidate =
      raw.startsWith("{") && raw.endsWith("}")
        ? raw
        : (() => {
            const start = raw.indexOf("{");
            const end = raw.lastIndexOf("}");
            return start !== -1 && end !== -1 && end > start ? raw.slice(start, end + 1) : raw;
          })();
    const parsed = jsonCandidate ? JSON.parse(jsonCandidate) : null;
    autopilotCampaignId = parsed?.campaignId || parsed?.campaign_id || null;
  } catch {
    // ignore
  }

  // 2) Auto-create campaign (quick create)
  await run("campaign-orchestrator", {
    campaignName: `Smoke Test Campaign ${new Date().toISOString().slice(0, 10)}`,
    vertical: "SaaS & Software",
    goal: "Generate qualified leads",
    channels: { email: true, social: false, voice: true, video: false, landing_page: false },
  });

  // 3) Auto-create email (content generation)
  await run("content-generate", {
    vertical: "SaaS & Software",
    contentType: "email",
    assetGoal: "Generate qualified leads",
    workspaceId,
  });

  // 3b) Image generation used by campaign automation flows
  await run("generate-hero-image", {
    vertical: "SaaS & Software",
    contentType: "email",
    assetGoal: "Generate qualified leads",
    workspaceId,
  });

  // 4) AI voice agent generation (builder)
  await run("cmo-voice-agent-builder", {
    tenant_id: workspaceId,
    workspace_id: workspaceId,
    brand_voice: "Professional, warm, concise",
    icp: "B2B SaaS founders",
    offer: "AI marketing automation",
    constraints: ["Do not mention pricing unless asked", "Comply with TCPA guidelines"],
  });

  // 5) Autopilot toggle (requires campaign id)
  if (autopilotCampaignId) {
    await run("ai-cmo-toggle-autopilot", {
      campaign_id: autopilotCampaignId,
      campaignId: autopilotCampaignId,
      enabled: true,
    });
  } else {
    console.log("SKIP ai-cmo-toggle-autopilot -> missing campaignId from autopilot response");
    failed = true;
  }

  if (failed) {
    console.error("❌ Automation smoke harness FAILED");
    process.exitCode = 1;
  } else {
    console.log("✅ Automation smoke harness PASSED");
  }
}

main().catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exitCode = 1;
});

