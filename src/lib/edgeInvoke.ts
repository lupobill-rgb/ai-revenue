import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "@/integrations/supabase/client";

// Some tooling (eslint/tsserver) may not load Vite's `import.meta.env` types via project references.
// Keep access narrow and resilient.
const isDev = Boolean((import.meta as any)?.env?.DEV);

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

function inferProjectRefFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname || "";
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
}

function inferProjectRefFromIssuer(iss: string | undefined | null): string | null {
  if (!iss) return null;
  try {
    const u = new URL(iss);
    const host = u.hostname || "";
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
}

async function invokeEdgeRawForDebug(fn: string, body: unknown) {
  const supabaseUrl = SUPABASE_URL;
  const anonKey = SUPABASE_ANON_KEY;
  // IMPORTANT: do NOT call refreshSession() here.
  // If the browser is in a fragile auth/storage state, refreshSession() can create confusing loops.
  // We want to debug using the *current* token exactly as-is.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const tokenPayload = token ? decodeJwtPayload(token) : null;

  const url = `${supabaseUrl}/functions/v1/${fn}`;
  const res = await fetch(url, {
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
    url,
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
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionToken = sessionData.session?.access_token;
  if (!sessionToken) {
    throw new Error(`[${fn}] NO SESSION TOKEN (sign in required before calling Edge Functions)`);
  }

  // If the browser has a session token from a different Supabase project than the app is configured for,
  // calls can fail in confusing ways (including 404s). Detect early and force re-auth.
  const tokenPayload = decodeJwtPayload(sessionToken);
  const tokenRef = inferProjectRefFromIssuer(tokenPayload?.iss ?? null);
  const envRef = inferProjectRefFromUrl(SUPABASE_URL);
  if (tokenRef && envRef && tokenRef !== envRef) {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    throw new Error(
      `[${fn}] AUTH PROJECT MISMATCH. You were signed into project ref=${tokenRef} but this app is configured for ref=${envRef}. ` +
        `You have been signed out; please sign in again.`
    );
  }

  if (isDev) {
    // eslint-disable-next-line no-console
    console.log("[edge] invoke", {
      fn,
      url: `${SUPABASE_URL}/functions/v1/${fn}`,
    });
  }
  const { data, error } = await supabase.functions.invoke<T>(fn, { body });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[edge] invoke failed", { fn, error });
    const msg = summarizeEdgeInvokeError(fn, error);
    let enrichedMsg: string | null = null;
    let rawStatus: number | null = null;
    let rawText: string | null = null;

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
        rawStatus = raw.status ?? null;
        rawText = raw.text ?? null;
        enrichedMsg =
          `[${fn}] Edge Function failed (status=${raw.status}, message=${(error as any)?.message || "non-2xx"}, ` +
          `details=${raw.text || "(empty)"}, url=${raw.url}, hasToken=${raw.hasToken}, tokenIss=${raw.tokenIss}, tokenExp=${raw.tokenExp})`;
      } catch (e) {
        // fall through to original message if raw fetch also fails unexpectedly
        // ignore
      }
    }

    const lower = `${msg} ${rawText ?? ""}`.toLowerCase();
    // Common Supabase edge gateway auth errors. These usually happen when:
    // - the session is expired
    // - the browser has a session from a different Supabase project ("mismatched project")
    // In both cases the fastest recovery is to sign out and re-authenticate.
    if (rawStatus === 401 || lower.includes("invalid jwt") || lower.includes("jwt expired") || lower.includes("status=401")) {
      // Do NOT auto-sign-out. Auto sign-out can create an endless loop where a transient/misrouted 401
      // immediately logs users out every time they click an action.
      // Instead, surface a clear remediation message and let the user reset auth via /debug/auth.
      throw new Error(
        `[${fn}] AUTH ERROR (401). The Edge Function gateway rejected your JWT. ` +
          `Go to /debug/auth → "Clear auth storage + reload" → sign in again, then retry.`
      );
    }

    if (rawStatus === 404 || lower.includes("status=404")) {
      throw new Error(
        `[${fn}] EDGE FUNCTION NOT FOUND (404). This function is not deployed to your Supabase project. ` +
          `Deploy it (e.g. \`supabase functions deploy ${fn}\`) and retry.`
      );
    }

    throw new Error(enrichedMsg ?? msg);
  }
  return data as T;
}

