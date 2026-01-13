/**
 * Raw Edge Function invoker that exposes real HTTP status + response body
 * Use this instead of supabase.functions.invoke() when debugging errors
 */

import { supabase } from "@/integrations/supabase/client";

type InvokeOpts = {
  fn: string;              // e.g. "cmo-kernel"
  body?: unknown;
  signal?: AbortSignal;
};

export async function invokeEdgeRaw<T>({ fn, body, signal }: InvokeOpts): Promise<T> {
  // Ensure we send a fresh JWT. Stale/expired tokens commonly present as "Invalid JWT" in Edge Functions.
  const nowSec = Math.floor(Date.now() / 1000);
  const {
    data: { session: initialSession },
  } = await supabase.auth.getSession();

  let session = initialSession ?? null;
  const expiresAt = session?.expires_at ?? null;

  // Refresh if the token is missing or within ~60s of expiry.
  if (!session || (typeof expiresAt === "number" && expiresAt <= nowSec + 60)) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data?.session?.access_token) {
      session = data.session;
    }
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // IMPORTANT: include JWT so the function sees the user/tenant
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  const text = await res.text();

  if (!res.ok) {
    // This is the missing data you need.
    console.error(`[edge] ${fn} non-2xx`, {
      status: res.status,
      statusText: res.statusText,
      responseText: text,
      requestBody: body,
      hasSession: Boolean(session),
      tokenPreview: session?.access_token ? `${session.access_token.slice(0, 12)}...` : null,
    });

    // Surface a useful error in the UI (not just generic)
    throw new Error(`[${fn}] ${res.status} ${res.statusText}: ${text || "(empty body)"}`);
  }

  // handle empty body
  if (!text) return {} as T;

  // try JSON, fallback to text
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
