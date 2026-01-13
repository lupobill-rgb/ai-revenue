import { supabase } from "@/integrations/supabase/client";

function decodeJwtPayload(jwt: string) {
  const p = jwt.split(".")[1];
  if (!p) return null;
  const json = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
  try {
    return JSON.parse(json) as { iss?: string; exp?: number; aud?: string; sub?: string; role?: string; ref?: string };
  } catch {
    return null;
  }
}

function summarizeEdgeInvokeError(fn: string, error: any) {
  const status =
    error?.status ??
    error?.statusCode ??
    error?.context?.status ??
    error?.context?.response?.status ??
    error?.context?.statusCode ??
    null;

  const details =
    error?.details ??
    error?.context?.body ??
    error?.context?.responseText ??
    error?.context?.response?.body ??
    error?.context?.response?.statusText ??
    null;

  const base = `[${fn}] Edge Function failed`;
  const parts = [
    status ? `status=${status}` : null,
    error?.message ? `message=${String(error.message)}` : null,
    details ? `details=${typeof details === "string" ? details : JSON.stringify(details)}` : null,
  ].filter(Boolean);

  return `${base}${parts.length ? ` (${parts.join(", ")})` : ""}`;
}

async function invokeEdgeRawForDebug(fn: string, body: unknown) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  // Ensure token is fresh when replaying; expired tokens can appear as "Invalid JWT".
  await supabase.auth.refreshSession();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const tokenPayload = token ? decodeJwtPayload(token) : null;

  const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(anonKey ? { apikey: anonKey } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  return {
    status: res.status,
    statusText: res.statusText,
    text,
    hasToken: Boolean(token),
    tokenIss: tokenPayload?.iss ?? null,
    tokenExp: tokenPayload?.exp ?? null,
  };
}

export async function invokeEdge<T>(fn: string, body: unknown): Promise<T> {
  // Fail fast if we have no authenticated session. Otherwise Edge Functions that require JWT
  // will return 401 and supabase-js often surfaces only the generic non-2xx message.
  await supabase.auth.refreshSession();
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionToken = sessionData.session?.access_token;
  if (!sessionToken) {
    throw new Error(`[${fn}] NO SESSION TOKEN (sign in required before calling Edge Functions)`);
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[edge] invoke", {
      fn,
      url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`,
    });
  }
  const { data, error } = await supabase.functions.invoke<T>(fn, { body });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[edge] invoke failed", { fn, error });
    const msg = summarizeEdgeInvokeError(fn, error);

    // If supabase-js swallowed the body (common), replay via raw fetch to capture the real status/body.
    const detailsVal = (error as any)?.details ?? (error as any)?.context?.body ?? null;
    const hasDetails =
      typeof detailsVal === "string"
        ? detailsVal.trim().length > 0
        : detailsVal && typeof detailsVal === "object"
          ? Object.keys(detailsVal).length > 0
          : Boolean(detailsVal);
    if (!hasDetails) {
      try {
        const raw = await invokeEdgeRawForDebug(fn, body);
        // eslint-disable-next-line no-console
        console.error("[edge] raw fetch debug", { fn, ...raw });
        throw new Error(
          `[${fn}] Edge Function failed (status=${raw.status}, message=${(error as any)?.message || "non-2xx"}, ` +
            `details=${raw.text || "(empty)"}, hasToken=${raw.hasToken}, tokenIss=${raw.tokenIss}, tokenExp=${raw.tokenExp})`
        );
      } catch (e) {
        // fall through to original message if raw fetch also fails unexpectedly
        if (e instanceof Error) throw e;
      }
    }

    throw new Error(msg);
  }
  return data as T;
}

