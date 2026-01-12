/**
 * Centralized multi-LLM router for Edge Functions.
 *
 * Goals:
 * - Single interface (`runLLM`) for all text completions (optionally streaming)
 * - Centralized routing policy (capability -> provider/model + fallbacks)
 * - Provider adapters hidden behind `_shared/providers/*`
 * - No provider leakage in product code
 */
import { openaiChat, openaiChatStream, openaiImageGenerate } from "./providers/openai.ts";
import { createHash } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

// OpenAI-only baseline: do not route to other providers.
export type LLMProvider = "openai";
export type LLMRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface LLMRouteTarget {
  provider: LLMProvider;
  model: string;
}

export interface LLMRoute {
  primary: LLMRouteTarget;
  fallbacks: LLMRouteTarget[];
}

export interface RunLLMInput {
  tenantId: string;
  capability: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /**
   * When true, returns a pass-through SSE stream `Response`.
   * Fallback is attempted only before a successful stream starts.
   */
  stream?: boolean;
}

export type RunLLMResult =
  | {
    kind: "text";
    provider: LLMProvider;
    model: string;
    text: string;
    usage?: LLMUsage;
    latencyMs: number;
  }
  | {
    kind: "stream";
    provider: LLMProvider;
    model: string;
    response: Response;
    latencyMs: number;
  };

export interface RunImageInput {
  tenantId: string;
  capability: string; // e.g., "image.generate"
  prompt: string;
  size?: string;
  timeoutMs?: number;
}

export interface RunImageResult {
  provider: LLMProvider;
  model: string;
  /**
   * Either an OpenAI `b64_json` or a URL, depending on provider support.
   * The caller can decide how to store it.
   */
  b64?: string;
  url?: string;
  latencyMs: number;
}

class RouterError extends Error {
  provider?: LLMProvider;
  model?: string;
  retryable: boolean;
  status?: number;

  constructor(message: string, opts?: { provider?: LLMProvider; model?: string; retryable?: boolean; status?: number }) {
    super(message);
    this.name = "RouterError";
    this.provider = opts?.provider;
    this.model = opts?.model;
    this.retryable = opts?.retryable ?? false;
    this.status = opts?.status;
  }
}

function nowMs(): number {
  return Date.now();
}

function sseFromText(text: string): Response {
  // Emit a single OpenAI-compatible delta + DONE so existing frontend stream parsers work.
  const encoder = new TextEncoder();
  const payload = JSON.stringify({ choices: [{ delta: { content: text } }] });
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}

function stableHash(input: string): string {
  const digest = createHash("sha256").update(input).digest();
  return encodeHex(digest);
}

function envJson<T>(name: string): T | null {
  const raw = Deno.env.get(name);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`[llmRouter] Invalid JSON in ${name}`);
    return null;
  }
}

type TenantAllowlist = Record<string, { providers?: LLMProvider[]; models?: Record<LLMProvider, string[]> }>;

function isProviderAllowed(tenantId: string, provider: LLMProvider, model: string): boolean {
  const allowlist = envJson<TenantAllowlist>("LLM_TENANT_ALLOWLIST_JSON");
  if (!allowlist) return true;

  const entry = allowlist[tenantId];
  if (!entry) return true;

  if (entry.providers && !entry.providers.includes(provider)) return false;
  if (entry.models?.[provider] && !entry.models[provider]!.includes(model)) return false;
  return true;
}

type RoutesConfig = {
  default: Record<string, LLMRoute>;
  tenants?: Record<string, Record<string, LLMRoute>>;
};

function defaultRoutes(): Record<string, LLMRoute> {
  // IMPORTANT: This is an MVP fallback. Override via `LLM_ROUTES_JSON`.
  return {
    "ai.chat": { primary: { provider: "openai", model: "gpt-4o-mini" }, fallbacks: [] },
    "content.generate": { primary: { provider: "openai", model: "gpt-4o-mini" }, fallbacks: [] },
    "leads.analyze": { primary: { provider: "openai", model: "gpt-4o-mini" }, fallbacks: [] },
    "image.generate": { primary: { provider: "openai", model: "gpt-image-1" }, fallbacks: [] },
  };
}

function resolveRoute(tenantId: string, capability: string): LLMRoute {
  const cfg = envJson<RoutesConfig>("LLM_ROUTES_JSON");
  const tenant = cfg?.tenants?.[tenantId]?.[capability];
  if (tenant) return tenant;

  const global = cfg?.default?.[capability];
  if (global) return global;

  const fallback = defaultRoutes()[capability];
  if (fallback) return fallback;

  // Default fallback: safe, cheap-ish chat model.
  return { primary: { provider: "openai", model: "gpt-4o-mini" }, fallbacks: [] };
}

function providerKeyAvailable(provider: LLMProvider): boolean {
  if (provider === "openai") return !!Deno.env.get("OPENAI_API_KEY");
  return false;
}

function classifyError(err: unknown, provider: LLMProvider, model: string): RouterError {
  if (err instanceof RouterError) return err;
  if (err instanceof Error) {
    // Heuristic: treat timeouts/network as retryable.
    const msg = err.message || "LLM call failed";
    const retryable = /timeout|timed out|network|fetch/i.test(msg);
    return new RouterError(msg, { provider, model, retryable });
  }
  return new RouterError("LLM call failed", { provider, model, retryable: true });
}

function logCall(fields: Record<string, unknown>) {
  // Keep this simple + grep-friendly.
  console.log(`[llmRouter] ${JSON.stringify(fields)}`);
}

export async function runLLM(input: RunLLMInput): Promise<RunLLMResult> {
  const start = nowMs();
  const route = resolveRoute(input.tenantId, input.capability);
  const chain = [route.primary, ...(route.fallbacks || [])];

  const requestId = stableHash(`${input.tenantId}:${input.capability}:${start}:${Math.random()}`);

  for (let i = 0; i < chain.length; i++) {
    const target = chain[i]!;
    const fallbackUsed = i > 0;

    if (!isProviderAllowed(input.tenantId, target.provider, target.model)) {
      logCall({ requestId, tenantId: input.tenantId, capability: input.capability, provider: target.provider, model: target.model, attempt: i, fallbackUsed, outcome: "skipped_not_allowed" });
      continue;
    }

    if (!providerKeyAvailable(target.provider)) {
      logCall({ requestId, tenantId: input.tenantId, capability: input.capability, provider: target.provider, model: target.model, attempt: i, fallbackUsed, outcome: "skipped_missing_key" });
      continue;
    }

    try {
      const attemptStart = nowMs();
      if (input.stream) {
        // V1 streaming rule:
        // - If provider supports native streaming (OpenAI), pass-through stream.
        // - If provider does not support streaming, fallback to non-stream and wrap as SSE (single chunk).
        if (target.provider === "openai") {
          const resp = await openaiChatStream({
            apiKey: Deno.env.get("OPENAI_API_KEY")!,
            model: target.model,
            messages: input.messages,
            temperature: input.temperature,
            maxTokens: input.maxTokens,
            timeoutMs: input.timeoutMs,
          });
          const latencyMs = nowMs() - attemptStart;
          logCall({
            requestId,
            tenantId: input.tenantId,
            capability: input.capability,
            provider: target.provider,
            model: target.model,
            attempt: i,
            fallbackUsed,
            latencyMs,
            outcome: "ok_stream",
          });
          return { kind: "stream", provider: target.provider, model: target.model, response: resp, latencyMs };
        }
        throw new RouterError("Streaming not supported for this provider", { provider: target.provider, model: target.model, retryable: false });
      }

      // Non-streaming text generation
      let text = "";
      let usage: LLMUsage | undefined;
      if (target.provider === "openai") {
        const out = await openaiChat({
          apiKey: Deno.env.get("OPENAI_API_KEY")!,
          model: target.model,
          messages: input.messages,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          timeoutMs: input.timeoutMs,
        });
        text = out.text;
        usage = out.usage;
      } else {
        throw new RouterError("Unknown provider", { provider: target.provider, model: target.model, retryable: false });
      }

      const latencyMs = nowMs() - attemptStart;
      logCall({
        requestId,
        tenantId: input.tenantId,
        capability: input.capability,
        provider: target.provider,
        model: target.model,
        attempt: i,
        fallbackUsed,
        latencyMs,
        outcome: "ok",
        tokens: usage?.totalTokens,
      });
      return { kind: "text", provider: target.provider, model: target.model, text, usage, latencyMs };
    } catch (err) {
      const routed = classifyError(err, target.provider, target.model);
      logCall({
        requestId,
        tenantId: input.tenantId,
        capability: input.capability,
        provider: target.provider,
        model: target.model,
        attempt: i,
        fallbackUsed,
        outcome: "error",
        retryable: routed.retryable,
        message: routed.message,
        status: routed.status,
      });

      // Try next provider only if retryable OR not the last option.
      const hasNext = i < chain.length - 1;
      if (hasNext && routed.retryable) continue;
      if (hasNext && /missing key/i.test(routed.message)) continue;
      if (hasNext && routed.status && [429, 500, 502, 503, 504].includes(routed.status)) continue;

      throw routed;
    }
  }

  const totalLatencyMs = nowMs() - start;
  throw new RouterError(`No LLM providers available for capability '${input.capability}'`, { retryable: false, status: 503 });
}

export async function runImage(input: RunImageInput): Promise<RunImageResult> {
  const start = nowMs();
  const route = resolveRoute(input.tenantId, input.capability);
  const chain = [route.primary, ...(route.fallbacks || [])];
  const requestId = stableHash(`${input.tenantId}:${input.capability}:${start}:${Math.random()}`);

  for (let i = 0; i < chain.length; i++) {
    const target = chain[i]!;
    if (!isProviderAllowed(input.tenantId, target.provider, target.model)) continue;
    if (!providerKeyAvailable(target.provider)) continue;

    try {
      if (target.provider === "openai") {
        const out = await openaiImageGenerate({
          apiKey: Deno.env.get("OPENAI_API_KEY")!,
          model: target.model,
          prompt: input.prompt,
          size: input.size,
          timeoutMs: input.timeoutMs,
        });
        const latencyMs = nowMs() - start;
        logCall({ requestId, tenantId: input.tenantId, capability: input.capability, provider: target.provider, model: target.model, latencyMs, outcome: "ok_image" });
        return { provider: target.provider, model: target.model, b64: out.b64, url: out.url, latencyMs };
      }
      throw new RouterError("Image generation not supported for this provider yet", { provider: target.provider, model: target.model, retryable: false });
    } catch (err) {
      const routed = classifyError(err, target.provider, target.model);
      const hasNext = i < chain.length - 1;
      if (hasNext && routed.retryable) continue;
      throw routed;
    }
  }

  throw new RouterError(`No image providers available for capability '${input.capability}'`, { retryable: false, status: 503 });
}

