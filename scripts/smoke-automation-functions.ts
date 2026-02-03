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

  // Fetch tenant_id from the workspaces table
  const { data: workspaceDetails } = await supabase
    .from("workspaces")
    .select("tenant_id")
    .eq("id", workspaceId)
    .maybeSingle();
  const tenantId = workspaceDetails?.tenant_id;
  if (!tenantId) throw new Error("Unable to resolve tenant_id for workspace");

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

  // 1) Autopilot (AI Voice + AI Email)
  const autopilot = await run("ai-cmo-autopilot-build", {
    icp: "B2B SaaS founders with 10-50 employees",
    offer: "AI-powered marketing automation platform",
    channels: ["email", "voice"],
    desiredResult: "leads",
    tenant_id: tenantId,
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
    workspace_id: workspaceId,
    brand_voice: "Professional, warm, concise",
    icp: "B2B SaaS founders",
    offer: "AI marketing automation",
    constraints: ["Do not mention pricing unless asked", "Comply with TCPA guidelines"],
    tenant_id: tenantId,
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

