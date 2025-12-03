/**
 * Rate Limit Test Utilities
 * Shared helpers for testing edge function rate limiting
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface EdgeFunctionCallOptions {
  functionName: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  overrideIp?: string;
  authToken?: string;
  internalSecret?: string;
}

export interface EdgeFunctionResponse {
  status: number;
  data: unknown;
  headers: Headers;
  retryAfter?: number;
}

/**
 * Call a Supabase edge function with configurable options
 */
export async function callEdgeFunction(
  options: EdgeFunctionCallOptions
): Promise<EdgeFunctionResponse> {
  const {
    functionName,
    method = "POST",
    headers = {},
    body,
    overrideIp,
    authToken,
    internalSecret,
  } = options;

  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    ...headers,
  };

  // Add authorization if provided
  if (authToken) {
    requestHeaders["Authorization"] = `Bearer ${authToken}`;
  }

  // Add internal secret if provided
  if (internalSecret) {
    requestHeaders["x-internal-secret"] = internalSecret;
  }

  // Override IP for rate limit testing
  if (overrideIp) {
    requestHeaders["x-forwarded-for"] = overrideIp;
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  const retryAfter = response.headers.get("Retry-After");

  return {
    status: response.status,
    data,
    headers: response.headers,
    retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
  };
}

/**
 * Sleep for N milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random IP address for testing
 */
export function generateRandomIp(): string {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

/**
 * Generate unique test identifier
 */
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Call edge function multiple times in rapid succession
 */
export async function callEdgeFunctionNTimes(
  options: EdgeFunctionCallOptions,
  times: number,
  delayBetweenMs = 0
): Promise<EdgeFunctionResponse[]> {
  const results: EdgeFunctionResponse[] = [];

  for (let i = 0; i < times; i++) {
    const result = await callEdgeFunction(options);
    results.push(result);

    if (delayBetweenMs > 0 && i < times - 1) {
      await sleep(delayBetweenMs);
    }
  }

  return results;
}

/**
 * Count responses by status code
 */
export function countByStatus(responses: EdgeFunctionResponse[]): Record<number, number> {
  return responses.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>
  );
}

/**
 * Rate limit configuration for each endpoint
 */
export const RATE_LIMITS = {
  "lead-capture": { perMinute: 60, perHour: 500, perDay: 2000 },
  "generate-video": { perMinute: 5, perHour: 20, perDay: 100 },
  "execute-voice-campaign": { perMinute: 10, perHour: 50, perDay: 200 },
  "social-deploy": { perMinute: 10, perHour: 60, perDay: 500 },
} as const;

export type RateLimitedEndpoint = keyof typeof RATE_LIMITS;
