// supabase/functions/_shared/basic-auth.ts

/**
 * HTTP Basic Auth for private dashboards, staging, and internal tooling.
 * Requires both username and password to match env variables.
 * 
 * Usage:
 * ```typescript
 * import { requireBasicAuth, basicAuthResponse } from "../_shared/basic-auth.ts";
 * 
 * if (!requireBasicAuth(req, "UG_ADMIN_BASIC_USER", "UG_ADMIN_BASIC_PASS")) {
 *   return basicAuthResponse("UbiGrowth Admin");
 * }
 * ```
 */

/**
 * Verify HTTP Basic Auth credentials against environment variables
 */
export function requireBasicAuth(
  req: Request,
  userEnv: string,
  passEnv: string
): boolean {
  const expectedUser = Deno.env.get(userEnv) ?? "";
  const expectedPass = Deno.env.get(passEnv) ?? "";

  // If credentials not configured, deny access (fail-closed)
  if (!expectedUser || !expectedPass) {
    console.error(`[basic-auth] Missing credentials: ${userEnv} or ${passEnv} not set`);
    return false;
  }

  const header = req.headers.get("Authorization");
  if (!header || !header.startsWith("Basic ")) {
    console.log("[basic-auth] No Basic auth header provided");
    return false;
  }

  try {
    const base64 = header.slice("Basic ".length);
    const decoded = atob(base64);
    const colonIndex = decoded.indexOf(":");
    
    if (colonIndex === -1) {
      console.log("[basic-auth] Invalid Basic auth format");
      return false;
    }

    const user = decoded.slice(0, colonIndex);
    const pass = decoded.slice(colonIndex + 1);

    // Timing-safe comparison
    const userMatch = timingSafeEqual(user, expectedUser);
    const passMatch = timingSafeEqual(pass, expectedPass);

    if (userMatch && passMatch) {
      console.log("[basic-auth] Authentication successful");
      return true;
    }

    console.log("[basic-auth] Invalid credentials");
    return false;
  } catch (e) {
    console.error("[basic-auth] Failed to decode credentials:", e);
    return false;
  }
}

/**
 * Generate a 401 Unauthorized response with WWW-Authenticate header
 */
export function basicAuthResponse(
  realm: string = "Protected",
  corsHeaders?: Record<string, string>
): Response {
  const headers: Record<string, string> = {
    "WWW-Authenticate": `Basic realm="${realm}"`,
    "Content-Type": "text/plain",
    ...corsHeaders,
  };

  return new Response("Unauthorized", {
    status: 401,
    headers,
  });
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still iterate to prevent length-based timing leaks
    let dummy = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      dummy |= (a.charCodeAt(i % a.length) || 0) ^ (a.charCodeAt(i % a.length) || 0);
    }
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
