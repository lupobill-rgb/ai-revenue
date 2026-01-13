import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, unauthorizedResponse, createServiceClient } from "../_shared/auth.ts";
import { openaiChat } from "../_shared/providers/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id",
};

type SocialGenerateLinkedInInput = {
  tenant_id: string;
  campaign_id: string;
  topic: string;
  audience: string;
  offer: string;
  cta: string;
  constraints: {
    max_chars: number;
    include_hashtags: boolean;
  };
};

type SocialGenerateLinkedInOutput = {
  hook: string;
  body: string;
  hashtags: string[];
  post_text: string;
};

function mustString(v: unknown, name: string): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${name} is required`);
  return v.trim();
}

function mustNumber(v: unknown, name: string): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
  return n;
}

function normalizeLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function ensureHashtag(tag: string): string {
  const t = tag.trim();
  if (!t) return "";
  return t.startsWith("#") ? t : `#${t.replace(/^#/, "")}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await verifyAuth(req);
    if (auth.error || !auth.user || !auth.supabaseClient) {
      return unauthorizedResponse(corsHeaders, auth.error || "Unauthorized");
    }

    const body = (await req.json().catch(() => ({}))) as Partial<SocialGenerateLinkedInInput>;
    const tenant_id = mustString(body.tenant_id, "tenant_id");
    const campaign_id = mustString(body.campaign_id, "campaign_id");

    const headerWorkspaceId = req.headers.get("x-workspace-id");
    if (headerWorkspaceId && headerWorkspaceId.trim() && headerWorkspaceId.trim() !== tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id must match x-workspace-id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const topic = mustString(body.topic, "topic");
    const audience = mustString(body.audience, "audience");
    const offer = mustString(body.offer, "offer");
    const cta = mustString(body.cta, "cta");
    const maxChars = Math.min(3000, Math.max(300, mustNumber(body.constraints?.max_chars, "constraints.max_chars")));
    const includeHashtags = !!body.constraints?.include_hashtags;

    const apiKey = Deno.env.get("OPENAI_API_KEY") || "";
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
    const model = Deno.env.get("OPENAI_SOCIAL_MODEL") || "gpt-4o-mini";

    const system = `You write high-quality LinkedIn posts.
Rules:
- Non-spammy, no hype, no emojis.
- Output MUST be valid JSON with exactly: hook, body, hashtags (array of strings).
- hook: <= 140 chars, one punchy line.
- body: 3-8 short lines, readable on mobile.
- hashtags: 3-6 items, each starts with '#', no spaces in tags.
- Total post (hook+body+hashtags) <= ${maxChars} chars.`;

    const user = JSON.stringify({
      topic,
      audience,
      offer,
      cta,
      constraints: { max_chars: maxChars, include_hashtags: includeHashtags },
    });

    const llm = await openaiChat({
      apiKey,
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.5,
      maxTokens: 900,
      timeoutMs: 25_000,
    });

    let parsed: any = null;
    try {
      const m = llm.text.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : JSON.parse(llm.text);
    } catch {
      parsed = null;
    }

    const hook = normalizeLine(String(parsed?.hook || "").slice(0, 200));
    const bodyText = String(parsed?.body || "").replace(/\r\n/g, "\n").trim();
    const hashtagsRaw = Array.isArray(parsed?.hashtags) ? parsed.hashtags : [];
    const hashtags = includeHashtags
      ? hashtagsRaw.map((t: any) => ensureHashtag(String(t))).filter(Boolean).slice(0, 8)
      : [];

    const post_text = [hook, bodyText, hashtags.join(" ")].filter((s) => s && String(s).trim()).join("\n\n");

    const output: SocialGenerateLinkedInOutput = {
      hook,
      body: bodyText,
      hashtags,
      post_text,
    };

    // Persist to campaign_assets (per contract).
    const supabaseAdmin = createServiceClient();
    const { error: insertErr } = await supabaseAdmin.from("campaign_assets").insert({
      tenant_id,
      workspace_id: tenant_id,
      campaign_id,
      type: "social_linkedin",
      content: {
        ...output,
        constraints: { max_chars: maxChars, include_hashtags: includeHashtags },
        generated_at: new Date().toISOString(),
      },
    } as never);

    if (insertErr) {
      console.error("[social_generate_linkedin] Failed to store campaign_assets:", insertErr);
    }

    return new Response(JSON.stringify(output), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[social_generate_linkedin] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

