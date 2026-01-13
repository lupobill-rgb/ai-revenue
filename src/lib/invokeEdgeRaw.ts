/**
 * Raw Edge Function invoker that exposes real HTTP status + response body
 * Use this instead of supabase.functions.invoke() when debugging errors
 */

import { supabase, SUPABASE_ANON_KEY } from "@/lib/supabase";

type InvokeOpts = {
  fn: string;              // e.g. "cmo-kernel"
  body?: unknown;
  signal?: AbortSignal;
};

function decodeJwtPayload(jwt: string) {
  const payload = jwt.split(".")[1];
  if (!payload) return null;
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as { iss?: string; aud?: string; exp?: number; role?: string; sub?: string } | null;
}

export async function invokeEdgeRaw<T>({ fn, body, signal }: InvokeOpts): Promise<T> {
  // Important: "Invalid JWT" after attaching a token is usually a PROJECT MISMATCH:
  // the session token was issued by Project A but you're calling functions on Project B.
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error(`[${fn}] Missing session token (user not authenticated)`);
  }

  const clientUrl =
    ((supabase as any).supabaseUrl as string | undefined) ??
    ((supabase as any).url as string | undefined) ??
    import.meta.env.VITE_SUPABASE_URL;
  const functionsUrlEnv = import.meta.env.VITE_SUPABASE_URL;

  const jwtPayload = decodeJwtPayload(token);

  // Guardrail: the Supabase anon/publishable key is itself a JWT (starts with eyJ...),
  // but it is NOT a user access token. If we accidentally send it as Bearer, Edge will return "Invalid JWT".
  if (token === import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      `[${fn}] Invalid auth: using VITE_SUPABASE_PUBLISHABLE_KEY as Bearer token. ` +
        `This key is a project anon JWT, not a user session. Ensure the user is logged in and do not fallback to anon key for Authorization.`
    );
  }
  if (jwtPayload && !jwtPayload.sub) {
    console.warn(`[auth] Token has no sub claim; this does not look like a user session JWT`, {
      fn,
      jwtIss: jwtPayload.iss ?? null,
      jwtAud: jwtPayload.aud ?? null,
      jwtRole: jwtPayload.role ?? null,
      tokenPrefix: `${token.slice(0, 20)}...`,
    });
  }
  const clientHost = new URL(clientUrl).host;
  const issuerHost = jwtPayload?.iss ? new URL(jwtPayload.iss).host : null;

  if (issuerHost && issuerHost !== clientHost) {
    console.error("[auth] JWT issuer mismatch for edge call", {
      fn,
      supabaseUrlClient: clientUrl,
      functionsUrlEnv,
      clientHost,
      jwtIss: jwtPayload?.iss,
      issuerHost,
      tokenPresent: Boolean(token),
      tokenPrefix: `${token.slice(0, 20)}...`,
    });
    throw new Error(
      `[${fn}] Invalid JWT: session was issued by ${issuerHost} but client is configured for ${clientHost}. ` +
        `Sign out/in (or clear localStorage keys starting with "sb-") to reset the session for this project.`
    );
  }

  // If token is near expiry, refresh once to avoid edge auth failures on borderline-expired tokens.
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof jwtPayload?.exp === "number" && jwtPayload.exp <= nowSec + 60) {
    await supabase.auth.refreshSession();
  }

  const url = `${clientUrl}/functions/v1/${fn}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // IMPORTANT: include JWT so the function sees the user/tenant
      Authorization: `Bearer ${token}`,
      // Some setups require apikey even when Authorization is present.
      apikey: SUPABASE_ANON_KEY,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  const text = await res.text();

  if (!res.ok) {
    const invalidJwt =
      res.status === 401 &&
      (text.includes("Invalid JWT") || text.includes("\"Invalid JWT\"") || text.includes("invalid jwt"));

    // This is the missing data you need.
    console.error(`[edge] ${fn} non-2xx`, {
      status: res.status,
      statusText: res.statusText,
      responseText: text,
      requestBody: body,
      hasSession: true,
      tokenPreview: `${token.slice(0, 12)}...`,
      supabaseUrlClient: clientUrl,
      functionsUrlEnv,
      jwtIss: jwtPayload?.iss ?? null,
      jwtAud: jwtPayload?.aud ?? null,
      jwtExp: jwtPayload?.exp ?? null,
    });

    // Surface a useful error in the UI (not just generic)
    if (invalidJwt) {
      const issuerHost2 = jwtPayload?.iss ? new URL(jwtPayload.iss).host : null;
      const clientHost2 = new URL(clientUrl).host;
      throw new Error(
        `[${fn}] 401 Invalid JWT. This usually means the session token was issued by a DIFFERENT Supabase project.\n` +
          `- supabaseUrl(client): ${clientUrl}\n` +
          `- functionsUrl(env): ${functionsUrlEnv}\n` +
          `- jwt.iss: ${jwtPayload?.iss ?? "(missing)"}\n` +
          `- clientHost: ${clientHost2}\n` +
          `- issuerHost: ${issuerHost2 ?? "(missing)"}\n` +
          `Fix: sign out + sign back in, or clear LocalStorage keys starting with "sb-" for the old project, then reload.\n` +
          `Raw response: ${text || "(empty body)"}`
      );
    }

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
