// Rate limiting helper for edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface RateLimitConfig {
  perMinute?: number;
  perHour?: number;
  perDay?: number;
}

interface RateLimitResult {
  allowed: boolean;
  limitExceeded?: "minute" | "hour" | "day";
  retryAfter?: number;
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Check per-minute limit
  if (config.perMinute) {
    const { data: allowed } = await supabase.rpc("check_and_increment_rate_limit", {
      rate_key: `${key}:minute`,
      max_requests: config.perMinute,
      window_seconds: 60,
    });
    if (!allowed) {
      return { allowed: false, limitExceeded: "minute", retryAfter: 60 };
    }
  }

  // Check per-hour limit
  if (config.perHour) {
    const { data: allowed } = await supabase.rpc("check_and_increment_rate_limit", {
      rate_key: `${key}:hour`,
      max_requests: config.perHour,
      window_seconds: 3600,
    });
    if (!allowed) {
      return { allowed: false, limitExceeded: "hour", retryAfter: 3600 };
    }
  }

  // Check per-day limit
  if (config.perDay) {
    const { data: allowed } = await supabase.rpc("check_and_increment_rate_limit", {
      rate_key: `${key}:day`,
      max_requests: config.perDay,
      window_seconds: 86400,
    });
    if (!allowed) {
      return { allowed: false, limitExceeded: "day", retryAfter: 86400 };
    }
  }

  return { allowed: true };
}

export function rateLimitResponse(result: RateLimitResult, corsHeaders: Record<string, string>) {
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
