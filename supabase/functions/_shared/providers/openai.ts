import type { LLMMessage, LLMUsage } from "../llmRouter.ts";

function withTimeout(timeoutMs: number | undefined): { signal?: AbortSignal; cleanup: () => void } {
  if (!timeoutMs || timeoutMs <= 0) return { cleanup: () => {} };
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort("timeout"), timeoutMs);
  return { signal: controller.signal, cleanup: () => clearTimeout(id) };
}

function parseUsage(raw: any): LLMUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const prompt = raw.prompt_tokens;
  const completion = raw.completion_tokens;
  const total = raw.total_tokens;
  if (typeof prompt !== "number" && typeof completion !== "number" && typeof total !== "number") return undefined;
  return { inputTokens: prompt, outputTokens: completion, totalTokens: total };
}

export async function openaiChat(args: {
  apiKey: string;
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ text: string; usage?: LLMUsage }> {
  const { signal, cleanup } = withTimeout(args.timeoutMs);
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        model: args.model,
        messages: args.messages,
        temperature: typeof args.temperature === "number" ? args.temperature : 0.7,
        max_tokens: typeof args.maxTokens === "number" ? args.maxTokens : 1200,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      const err: any = new Error(`OpenAI error (${resp.status}): ${text ? text.slice(0, 800) : "unknown"}`);
      err.status = resp.status;
      throw err;
    }

    const json = await resp.json();
    const out = json?.choices?.[0]?.message?.content;
    if (!out || typeof out !== "string") {
      throw new Error("OpenAI returned an empty response");
    }
    return { text: out, usage: parseUsage(json?.usage) };
  } finally {
    cleanup();
  }
}

export async function openaiChatStream(args: {
  apiKey: string;
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<Response> {
  const { signal, cleanup } = withTimeout(args.timeoutMs);
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        model: args.model,
        messages: args.messages,
        temperature: typeof args.temperature === "number" ? args.temperature : 0.7,
        max_tokens: typeof args.maxTokens === "number" ? args.maxTokens : 2048,
        stream: true,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      const err: any = new Error(`OpenAI stream error (${resp.status}): ${text ? text.slice(0, 800) : "unknown"}`);
      err.status = resp.status;
      throw err;
    }

    // Pass-through body; caller sets CORS + content-type.
    return resp;
  } finally {
    cleanup();
  }
}

export async function openaiImageGenerate(args: {
  apiKey: string;
  model: string;
  prompt: string;
  size?: string;
  timeoutMs?: number;
}): Promise<{ b64?: string; url?: string }> {
  const { signal, cleanup } = withTimeout(args.timeoutMs);
  try {
    const allowedSizes = new Set(["1024x1024", "1024x1536", "1536x1024"]);
    const requestedSize = typeof args.size === "string" ? args.size.trim() : "";
    const size = allowedSizes.has(requestedSize) ? requestedSize : "1024x1024";

    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        model: args.model,
        prompt: args.prompt,
        size,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      const err: any = new Error(`OpenAI image error (${resp.status}): ${text ? text.slice(0, 800) : "unknown"}`);
      err.status = resp.status;
      throw err;
    }

    const json = await resp.json();
    const b64 = json?.data?.[0]?.b64_json;
    const url = json?.data?.[0]?.url;
    if ((b64 && typeof b64 === "string") || (url && typeof url === "string")) {
      return { b64: typeof b64 === "string" ? b64 : undefined, url: typeof url === "string" ? url : undefined };
    }

    throw new Error("OpenAI returned no image payload");
  } finally {
    cleanup();
  }
}

// Router-guard: vendor URLs are only allowed in `_shared/providers/*`.
export type OpenAIChatCompletionPayload = {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  max_tokens?: number;
  response_format?: unknown;
};

export async function getOpenAIChatCompletion(
  payload: OpenAIChatCompletionPayload,
  apiKey: string,
): Promise<any> {
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`,
    },
    // Supabase Edge (Deno) supports AbortSignal.timeout
    signal: AbortSignal.timeout(55_000),
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  return JSON.parse(text);
}
