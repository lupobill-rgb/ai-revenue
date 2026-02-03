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
  tenantId: string;
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
      "x-tenant-id": opts.tenantId,
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

  let tenantId = firstEnv("SMOKE_TENANT_ID", "SMOKE_WORKSPACE_ID");
  if (!tenantId) {
    const metaTenantId =
      signInData.user?.user_metadata?.tenant_id ||
      signInData.user?.app_metadata?.tenant_id ||
      null;
    tenantId = typeof metaTenantId === "string" ? metaTenantId : null;
  }

  if (!tenantId) {
    throw new Error("Unable to resolve tenant_id. Set SMOKE_TENANT_ID explicitly.");
  }

  const { data: tenantRow, error: tenantError } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError || !tenantRow) {
    throw new Error("Unable to resolve tenant in tenants table. Check SMOKE_TENANT_ID.");
  }

  let failed = false;

  const run = async (name: string, body?: unknown) => {
    const r = await callEdgeFunction({ supabaseUrl, anonKey, accessToken, tenantId, name, body });
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

  // 1) Auto-create campaign (quick create)
  await run("campaign-orchestrator", {
    campaignName: `Smoke Test Campaign ${new Date().toISOString().slice(0, 10)}`,
    vertical: "SaaS & Software",
    goal: "Generate qualified leads",
    channels: { email: true, social: false, voice: true, video: false, landing_page: false },
  });

  // 2) Auto-create email (content generation)
  await run("content-generate", {
    vertical: "SaaS & Software",
    contentType: "email",
    assetGoal: "Generate qualified leads",
    tenant_id: tenantId,
  });

  // 2b) Image generation used by campaign automation flows
  await run("generate-hero-image", {
    vertical: "SaaS & Software",
    contentType: "email",
    assetGoal: "Generate qualified leads",
    tenant_id: tenantId,
  });

  // 3) AI voice agent generation (builder)
  await run("cmo-voice-agent-builder", {
    tenant_id: tenantId,
    brand_voice: "Professional, warm, concise",
    icp: "B2B SaaS founders",
    offer: "AI marketing automation",
    constraints: ["Do not mention pricing unless asked", "Comply with TCPA guidelines"],
  });

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

