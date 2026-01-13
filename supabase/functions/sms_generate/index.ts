import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, unauthorizedResponse, createServiceClient } from "../_shared/auth.ts";
import { openaiChat } from "../_shared/providers/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id",
};

type SmsGenerateInput = {
  tenant_id: string;
  campaign_id: string;
  audience_context: {
    persona: string;
    offer: string;
    cta: string;
  };
  constraints: {
    max_chars: number;
    include_opt_out: boolean;
  };
};

type SmsGenerateOutput = {
  sms_text: string;
  char_count: number;
  contains_opt_out: boolean;
};

const OPT_OUT_PHRASE = "Reply STOP to opt out";

function mustString(v: unknown, name: string): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${name} is required`);
  return v.trim();
}

function mustNumber(v: unknown, name: string): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
  return n;
}

function normalizeSmsText(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function containsOptOut(text: string): boolean {
  return text.toLowerCase().includes(OPT_OUT_PHRASE.toLowerCase());
}

async function generateOnce(args: {
  persona: string;
  offer: string;
  cta: string;
  maxChars: number;
  includeOptOut: boolean;
  isCompressionPass: boolean;
}): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const model = Deno.env.get("OPENAI_SMS_MODEL") || "gpt-4o-mini";

  const system = `You write TCPA-safe, compliant outbound SMS.
Rules:
- Output ONLY the SMS message text, no quotes.
- Max ${args.maxChars} characters.
- Be clear and non-spammy.
- No emojis.
- No URLs unless absolutely necessary.
- Single message only.`;

  const user = args.isCompressionPass
    ? `Shorten the message below to <= ${args.maxChars} chars without losing the offer + CTA. Keep it natural.
If include_opt_out is true, it MUST include exactly: "${OPT_OUT_PHRASE}".

MESSAGE:
${args.offer}`
    : `Write 1 outbound SMS for this persona:
- Persona: ${args.persona}
- Offer: ${args.offer}
- CTA: ${args.cta}

Constraints:
- Max ${args.maxChars} characters.
- ${args.includeOptOut ? `MUST include opt-out exactly: "${OPT_OUT_PHRASE}".` : "No opt-out line required."}
`;

  const out = await openaiChat({
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.4,
    maxTokens: 160,
    timeoutMs: 20_000,
  });

  return normalizeSmsText(out.text);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await verifyAuth(req);
    if (auth.error || !auth.user || !auth.supabaseClient) {
      return unauthorizedResponse(corsHeaders, auth.error || "Unauthorized");
    }

    const body = (await req.json().catch(() => ({}))) as Partial<SmsGenerateInput>;
    const tenant_id = mustString(body.tenant_id, "tenant_id");
    const campaign_id = mustString(body.campaign_id, "campaign_id");

    const headerWorkspaceId = req.headers.get("x-workspace-id");
    if (headerWorkspaceId && headerWorkspaceId.trim() && headerWorkspaceId.trim() !== tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id must match x-workspace-id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const persona = mustString(body.audience_context?.persona, "audience_context.persona");
    const offer = mustString(body.audience_context?.offer, "audience_context.offer");
    const cta = mustString(body.audience_context?.cta, "audience_context.cta");

    const maxChars = Math.min(500, Math.max(40, mustNumber(body.constraints?.max_chars, "constraints.max_chars")));
    const includeOptOut = !!body.constraints?.include_opt_out;

    // First attempt
    let sms_text = await generateOnce({ persona, offer, cta, maxChars, includeOptOut, isCompressionPass: false });

    // Ensure opt-out phrase when required
    if (includeOptOut && !containsOptOut(sms_text)) {
      // Append if possible; otherwise force a compression pass that must include it.
      const appended = normalizeSmsText(`${sms_text}${sms_text.endsWith(".") ? "" : "."} ${OPT_OUT_PHRASE}`);
      sms_text = appended.length <= maxChars ? appended : sms_text;
    }

    // Single retry max if too long or missing required opt-out
    if (sms_text.length > maxChars || (includeOptOut && !containsOptOut(sms_text))) {
      const basis = includeOptOut ? `${sms_text}\n\n${OPT_OUT_PHRASE}` : sms_text;
      sms_text = await generateOnce({
        persona,
        offer: basis,
        cta,
        maxChars,
        includeOptOut,
        isCompressionPass: true,
      });
    }

    sms_text = normalizeSmsText(sms_text);

    // Final hard enforcement (no extra retries).
    if (includeOptOut && !containsOptOut(sms_text)) {
      // Fastest viable path: enforce exact phrase by appending and trimming if needed.
      // Assumption: trimming from the end is acceptable for MVP as long as opt-out remains.
      const forced = normalizeSmsText(`${sms_text}${sms_text.endsWith(".") ? "" : "."} ${OPT_OUT_PHRASE}`);
      sms_text = forced.length <= maxChars ? forced : normalizeSmsText((forced.slice(0, maxChars)).trimEnd());
    }
    if (sms_text.length > maxChars) {
      sms_text = normalizeSmsText(sms_text.slice(0, maxChars).trimEnd());
    }

    const output: SmsGenerateOutput = {
      sms_text,
      char_count: sms_text.length,
      contains_opt_out: containsOptOut(sms_text),
    };

    // Persist as campaign asset (per contract).
    const supabaseAdmin = createServiceClient();
    const { data: assetRow, error: insertErr } = await supabaseAdmin
      .from("campaign_assets")
      .insert({
        tenant_id,
        workspace_id: tenant_id,
        campaign_id,
        type: "sms",
        content: {
          sms_text: output.sms_text,
          char_count: output.char_count,
          contains_opt_out: output.contains_opt_out,
          constraints: { max_chars: maxChars, include_opt_out: includeOptOut },
          generated_at: new Date().toISOString(),
        },
      } as never)
      .select("id")
      .single();

    if (insertErr) {
      console.error("[sms_generate] Failed to store campaign_assets:", insertErr);
    }

    // IMPORTANT: Response contract must remain exactly { sms_text, char_count, contains_opt_out }.
    // We store the generated SMS in `campaign_assets` but do not return its id.
    return new Response(JSON.stringify(output), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[sms_generate] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

