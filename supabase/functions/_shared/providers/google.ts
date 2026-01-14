import type { LLMMessage, LLMUsage } from "../llmRouter.ts";

function withTimeout(timeoutMs: number | undefined): { signal?: AbortSignal; cleanup: () => void } {
  if (!timeoutMs || timeoutMs <= 0) return { cleanup: () => {} };
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort("timeout"), timeoutMs);
  return { signal: controller.signal, cleanup: () => clearTimeout(id) };
}

// Google Gemini (AI Studio) REST API.
// Docs: https://ai.google.dev/gemini-api/docs
//
// We intentionally avoid importing provider SDKs here to keep Edge bundle slim.

function toGeminiContents(messages: LLMMessage[]) {
  // Gemini doesn't support a native "system" role the same way; map it as a first user message.
  const contents: any[] = [];
  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : "user";
    contents.push({ role, parts: [{ text: m.content }] });
  }
  return contents;
}

function parseUsage(_json: any): LLMUsage | undefined {
  // Gemini usage fields vary by API version; keep optional for now.
  return undefined;
}

export async function googleChat(args: {
  apiKey: string;
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ text: string; usage?: LLMUsage }> {
  const { signal, cleanup } = withTimeout(args.timeoutMs);
  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(args.apiKey)}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        contents: toGeminiContents(args.messages),
        generationConfig: {
          temperature: typeof args.temperature === "number" ? args.temperature : 0.7,
          maxOutputTokens: typeof args.maxTokens === "number" ? args.maxTokens : 1200,
        },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      const err: any = new Error(`Google Gemini error (${resp.status}): ${text ? text.slice(0, 800) : "unknown"}`);
      err.status = resp.status;
      throw err;
    }

    const json = await resp.json();
    const text =
      json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("") ??
        "";

    if (!text || typeof text !== "string") {
      throw new Error("Google Gemini returned an empty response");
    }

    return { text, usage: parseUsage(json) };
  } finally {
    cleanup();
  }
}

export async function googleStreamGenerateContent(args: {
  apiKey: string;
  model: string;
  contents: any[];
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<Response> {
  const { signal, cleanup } = withTimeout(args.timeoutMs);
  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:streamGenerateContent?key=${encodeURIComponent(args.apiKey)}&alt=sse`;

    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        contents: args.contents,
        generationConfig: {
          temperature: typeof args.temperature === "number" ? args.temperature : 0.7,
          maxOutputTokens: typeof args.maxOutputTokens === "number" ? args.maxOutputTokens : 1200,
        },
      }),
    });
  } finally {
    cleanup();
  }
}

