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
  // Always refresh first so we don't send a stale/expired JWT.
  // If the user isn't authenticated, fail fast (don't hit the function with no/invalid Authorization header).
  await supabase.auth.refreshSession();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error(`[${fn}] Missing session token (user not authenticated)`);
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // IMPORTANT: include JWT so the function sees the user/tenant
      Authorization: `Bearer ${token}`,
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
      hasSession: true,
      tokenPreview: `${token.slice(0, 12)}...`,
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
