import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "@/lib/supabase";

function decodeJwtPayload(jwt: string) {
  const p = jwt.split(".")[1];
  if (!p) throw new Error("BAD JWT: missing payload");
  const json = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as { iss?: string; aud?: string; exp?: number; sub?: string; ref?: string; role?: string };
}

export async function callCmoKernel(payload: unknown) {
  // Refresh first (cheap + removes stale tokens)
  await supabase.auth.refreshSession();

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) throw new Error("NO SESSION TOKEN");
  if (!token.startsWith("eyJ")) throw new Error(`BAD TOKEN PREFIX: ${token.slice(0, 12)}`);
  if (!SUPABASE_ANON_KEY) throw new Error("MISSING SUPABASE ANON KEY (VITE_SUPABASE_ANON_KEY)");

  // issuer must match your current project
  const tokenPayload = decodeJwtPayload(token);
  const iss = tokenPayload.iss as string;
  const expectedHost = new URL(SUPABASE_URL).host;
  if (!iss?.includes(expectedHost)) {
    throw new Error(`JWT ISSUER MISMATCH: iss=${iss} expectedHost=${expectedHost}`);
  }

  // Verify the anon key matches this project ref (prevents apikey/project mismatch -> "Invalid JWT").
  const projectRefFromHost = expectedHost.split(".")[0];
  const anonPayload = decodeJwtPayload(SUPABASE_ANON_KEY);
  if (anonPayload?.ref && anonPayload.ref !== projectRefFromHost) {
    throw new Error(
      `ANON KEY PROJECT MISMATCH: anon.ref=${anonPayload.ref} expectedRef=${projectRefFromHost} ` +
        `(check VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY)`
    );
  }

  // Sanity-check the token against GoTrue before hitting Edge Functions gateway.
  // If this fails, the token itself is invalid (expired/revoked/corrupted).
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    throw new Error(`SESSION TOKEN INVALID (getUser failed): ${userErr?.message || "no user"}`);
  }

  const requestId = `cmo_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  // eslint-disable-next-line no-console
  console.log("[cmo-kernel] request", {
    requestId,
    urlHost: expectedHost,
    tokenPrefix: `${token.slice(0, 12)}...`,
    tokenLen: token.length,
    tokenAud: tokenPayload.aud ?? null,
    tokenExp: tokenPayload.exp ?? null,
    tokenSub: tokenPayload.sub ?? null,
    apikeyPrefix: `${SUPABASE_ANON_KEY.slice(0, 12)}...`,
    apikeyLen: SUPABASE_ANON_KEY.length,
    apikeyRef: anonPayload.ref ?? null,
  });

  const res = await fetch(`${SUPABASE_URL}/functions/v1/cmo-kernel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "x-request-id": requestId,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error("[cmo-kernel] non-2xx", {
      requestId,
      status: res.status,
      responseText: text || "(empty)",
      urlHost: expectedHost,
      tokenPrefix: `${token.slice(0, 12)}...`,
      tokenLen: token.length,
      apikeyPrefix: `${SUPABASE_ANON_KEY.slice(0, 12)}...`,
      apikeyLen: SUPABASE_ANON_KEY.length,
    });
    throw new Error(`[cmo-kernel] ${res.status}: ${text || "(empty)"}`);
  }
  return text ? JSON.parse(text) : {};
}

