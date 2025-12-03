// Rate limiting helper for edge functions

interface RateLimitConfig {
  perMinute?: number;
  perHour?: number;
  perDay?: number;
}

// Use any type to avoid version mismatches between Supabase client imports
type AnySupabaseClient = any;

/**
 * Extract client IP from request headers
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown-ip"
  );
}

/**
 * Build rate limit key with endpoint, identifier, and IP
 */
export function buildRateKey(endpoint: string, identifier: string, ip: string): string {
  return `${endpoint}:${identifier}:${ip}`;
}

/**
 * Check rate limit against a single window
 * Fail-closed: returns false on error (denies request)
 */
async function checkLimit(
  supabase: AnySupabaseClient,
  rateKey: string,
  maxRequests: number,
  windowSeconds: number,
  endpoint: string,
  windowType: "minute" | "hour" | "day"
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_and_increment_rate_limit", {
    rate_key: rateKey,
    max_requests: maxRequests,
    window_seconds: windowSeconds,
    p_window_type: windowType,
  });

  if (error) {
    console.error(`[${endpoint}] Rate limit check error:`, error);
    // Fail-closed for enterprise security
    return false;
  }

  return data === true;
}

/**
 * Check rate limits across all configured windows
 * Returns which limit was exceeded (if any)
 */
export async function checkRateLimits(
  supabase: AnySupabaseClient,
  endpoint: string,
  identifier: string,
  ip: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; limitExceeded?: "minute" | "hour" | "day"; retryAfter?: number }> {
  const rateKeyBase = buildRateKey(endpoint, identifier, ip);

  // Check per-minute limit
  if (config.perMinute) {
    const allowed = await checkLimit(supabase, `${rateKeyBase}:minute`, config.perMinute, 60, endpoint, "minute");
    if (!allowed) {
      console.warn(`[${endpoint}] Rate limit exceeded (per-minute) for ${identifier} from ${ip}`);
      return { allowed: false, limitExceeded: "minute", retryAfter: 60 };
    }
  }

  // Check per-hour limit
  if (config.perHour) {
    const allowed = await checkLimit(supabase, `${rateKeyBase}:hour`, config.perHour, 3600, endpoint, "hour");
    if (!allowed) {
      console.warn(`[${endpoint}] Rate limit exceeded (per-hour) for ${identifier} from ${ip}`);
      return { allowed: false, limitExceeded: "hour", retryAfter: 3600 };
    }
  }

  // Check per-day limit
  if (config.perDay) {
    const allowed = await checkLimit(supabase, `${rateKeyBase}:day`, config.perDay, 86400, endpoint, "day");
    if (!allowed) {
      console.warn(`[${endpoint}] Rate limit exceeded (per-day) for ${identifier} from ${ip}`);
      return { allowed: false, limitExceeded: "day", retryAfter: 86400 };
    }
  }

  return { allowed: true };
}

/**
 * Generate 429 response for rate limit exceeded
 */
export function rateLimitResponse(
  result: { limitExceeded?: string; retryAfter?: number },
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      limitExceeded: result.limitExceeded,
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfter || 60),
      },
    }
  );
}
