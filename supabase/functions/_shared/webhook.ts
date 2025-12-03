// supabase/functions/_shared/webhook.ts
export async function verifyHmacSignature(opts: {
  req: Request;
  rawBody: string;
  headerName: string;      // e.g. "x-ubigrowth-signature"
  secretEnv: string;       // e.g. "WEBHOOK_SHARED_SECRET"
  toleranceMs?: number;    // optional timestamp tolerance
  timestampHeader?: string; // e.g. "x-ubigrowth-timestamp"
}): Promise<boolean> {
  const {
    req,
    rawBody,
    headerName,
    secretEnv,
    toleranceMs = 5 * 60 * 1000,
    timestampHeader,
  } = opts;

  const secret = Deno.env.get(secretEnv);
  if (!secret) {
    console.error(`Missing env secret: ${secretEnv}`);
    return false;
  }

  const sigHeader = req.headers.get(headerName);
  if (!sigHeader) return false;

  let timestamp = "";
  if (timestampHeader) {
    timestamp = req.headers.get(timestampHeader) ?? "";
    if (!timestamp) return false;

    const tsNum = Number(timestamp);
    if (!Number.isFinite(tsNum)) return false;

    const now = Date.now();
    if (Math.abs(now - tsNum) > toleranceMs) {
      console.error("Webhook timestamp outside tolerance");
      return false;
    }
  }

  const encoder = new TextEncoder();
  const dataToSign = timestamp ? `${timestamp}.${rawBody}` : rawBody;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(dataToSign),
  );

  const expected = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // constant-time-ish compare
  const provided = sigHeader.trim();
  if (provided.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}
