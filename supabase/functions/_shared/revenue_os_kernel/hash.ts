export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function makeIdempotencyKey(parts: (string | null | undefined)[]): Promise<string> {
  const normalized = parts.filter(Boolean).join("|");
  return sha256Hex(normalized);
}


