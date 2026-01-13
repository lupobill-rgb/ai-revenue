import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, unauthorizedResponse, createServiceClient } from "../_shared/auth.ts";
import { openaiChat } from "../_shared/providers/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id",
};

type LandingPageGenerateInput = {
  tenant_id: string;
  campaign_id: string;
  brand: { name: string };
  offer: string;
  audience: string;
  cta: { primary: string };
  constraints: { tone: "direct"; sections: Array<"hero" | "benefits" | "cta"> };
};

type LandingPageGenerateOutput = {
  page: {
    title: string;
    hero_headline: string;
    hero_subheadline: string;
    benefits: [string, string, string];
    cta_text: string;
  };
  asset_id: string;
};

function mustString(v: unknown, name: string): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${name} is required`);
  return v.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await verifyAuth(req);
    if (auth.error || !auth.user || !auth.supabaseClient) {
      return unauthorizedResponse(corsHeaders, auth.error || "Unauthorized");
    }

    const body = (await req.json().catch(() => ({}))) as Partial<LandingPageGenerateInput>;
    const tenant_id = mustString(body.tenant_id, "tenant_id");
    const campaign_id = mustString(body.campaign_id, "campaign_id");

    const headerWorkspaceId = req.headers.get("x-workspace-id");
    if (headerWorkspaceId && headerWorkspaceId.trim() && headerWorkspaceId.trim() !== tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id must match x-workspace-id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const brandName = mustString(body.brand?.name, "brand.name");
    const offer = mustString(body.offer, "offer");
    const audience = mustString(body.audience, "audience");
    const ctaPrimary = mustString(body.cta?.primary, "cta.primary");

    const apiKey = Deno.env.get("OPENAI_API_KEY") || "";
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
    const model = Deno.env.get("OPENAI_LANDING_MODEL") || "gpt-4o-mini";

    const system = `You write high-converting landing page copy.
Output MUST be valid JSON with exactly this shape:
{
  "title": "string",
  "hero_headline": "string",
  "hero_subheadline": "string",
  "benefits": ["string","string","string"],
  "cta_text": "string"
}
Rules:
- Tone: direct, clear, no hype.
- Keep benefits concrete and short.
- No emojis.`;

    const user = JSON.stringify({
      brand: { name: brandName },
      offer,
      audience,
      cta: { primary: ctaPrimary },
      constraints: body.constraints || { tone: "direct", sections: ["hero", "benefits", "cta"] },
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

    let parsed: any;
    try {
      const m = llm.text.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : JSON.parse(llm.text);
    } catch {
      throw new Error("Failed to parse OpenAI JSON output");
    }

    const page = {
      title: mustString(parsed.title, "page.title"),
      hero_headline: mustString(parsed.hero_headline, "page.hero_headline"),
      hero_subheadline: mustString(parsed.hero_subheadline, "page.hero_subheadline"),
      benefits: [
        mustString(parsed.benefits?.[0], "page.benefits[0]"),
        mustString(parsed.benefits?.[1], "page.benefits[1]"),
        mustString(parsed.benefits?.[2], "page.benefits[2]"),
      ] as [string, string, string],
      cta_text: mustString(parsed.cta_text, "page.cta_text"),
    };

    const supabaseAdmin = createServiceClient();
    const { data: asset, error: insErr } = await supabaseAdmin
      .from("campaign_assets")
      .insert({
        tenant_id,
        workspace_id: tenant_id,
        campaign_id,
        type: "landing_page",
        content: {
          page,
          placeholders: {
            lead_capture: { fields: ["name", "email", "phone_optional"] },
            calendar_embed: { placeholder: true },
          },
          generated_at: new Date().toISOString(),
        },
      } as never)
      .select("id")
      .single();

    if (insErr || !asset?.id) throw new Error(insErr?.message || "Failed to store campaign_assets");

    const out: LandingPageGenerateOutput = { page, asset_id: asset.id };
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[landing_page_generate] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

