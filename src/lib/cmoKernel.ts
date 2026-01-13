import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "@/lib/supabase";

function decodeJwtPayload(jwt: string) {
  const p = jwt.split(".")[1];
  if (!p) throw new Error("BAD JWT: missing payload");
  const json = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as { iss?: string };
}

export async function callCmoKernel(payload: unknown) {
  // Refresh first (cheap + removes stale tokens)
  await supabase.auth.refreshSession();

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) throw new Error("NO SESSION TOKEN");
  if (!token.startsWith("eyJ")) throw new Error(`BAD TOKEN PREFIX: ${token.slice(0, 12)}`);

  // issuer must match your current project
  const iss = decodeJwtPayload(token).iss as string;
  const expectedHost = new URL(SUPABASE_URL).host;
  if (!iss?.includes(expectedHost)) {
    throw new Error(`JWT ISSUER MISMATCH: iss=${iss} expectedHost=${expectedHost}`);
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/cmo-kernel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`[cmo-kernel] ${res.status}: ${text || "(empty)"}`);
  return text ? JSON.parse(text) : {};
}

