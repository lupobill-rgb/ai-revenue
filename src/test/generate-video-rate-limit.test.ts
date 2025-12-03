/**
 * Generate-Video Rate Limit Integration Tests
 * 
 * Tests rate limiting for generate-video endpoint (userId + IP keyed)
 * 
 * Prerequisites:
 * - Set TEST_AUTH_TOKEN_U1 env var (valid JWT for user 1)
 * - Set TEST_AUTH_TOKEN_U2 env var (valid JWT for user 2)
 * 
 * Run with:
 * TEST_RATE_LIMITS=true TEST_AUTH_TOKEN_U1=xxx TEST_AUTH_TOKEN_U2=xxx npx vitest run src/test/generate-video-rate-limit.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  callEdgeFunction,
  callEdgeFunctionNTimes,
  countByStatus,
  generateTestId,
  sleep,
  RATE_LIMITS,
} from "./rate-limit-utils";

// Skip tests by default
const shouldRun = process.env.TEST_RATE_LIMITS === "true";
const authTokenU1 = process.env.TEST_AUTH_TOKEN_U1;
const authTokenU2 = process.env.TEST_AUTH_TOKEN_U2;

describe.skipIf(!shouldRun || !authTokenU1)("Generate-Video Rate Limit Tests", () => {
  const limits = RATE_LIMITS["generate-video"]; // 5/min, 20/hr, 100/day
  const endpoint = "generate-video";

  /**
   * Scenario A – Hard per-minute limit
   * Loop calling generate-video 6 times in under a minute
   * 5 calls are 2xx, 1+ calls return 429
   */
  describe("Scenario A – Hard per-minute limit", () => {
    const testIp = "9.9.9.9";

    it("should enforce per-minute limit of 5 requests", async () => {
      const uniqueIp = `${testIp}-${generateTestId()}`;
      const requestCount = limits.perMinute + 1; // 6 requests

      const results = await callEdgeFunctionNTimes(
        {
          functionName: endpoint,
          body: { vertical: "test-vertical" },
          authToken: authTokenU1,
          overrideIp: uniqueIp,
        },
        requestCount,
        100 // 100ms between requests
      );

      const statusCounts = countByStatus(results);

      // Assert: At least one 429 response
      expect(statusCounts[429] || 0).toBeGreaterThan(0);

      // Assert: First 5 should not be 429
      const first5 = results.slice(0, limits.perMinute);
      const first5RateLimited = first5.filter((r) => r.status === 429).length;
      expect(first5RateLimited).toBe(0);

      // Assert: Error body includes rate limit indication
      const rateLimitedResponse = results.find((r) => r.status === 429);
      expect(rateLimitedResponse).toBeDefined();

      const errorData = rateLimitedResponse?.data as Record<string, unknown>;
      expect(errorData.error).toBe("Rate limit exceeded");

      console.log("Scenario A results:", statusCounts);
    });
  });

  /**
   * Scenario B – Different user
   * After U1 is throttled, U2 from same IP should work
   */
  describe.skipIf(!authTokenU2)("Scenario B – Different user", () => {
    const testIp = "9.9.9.10";

    it("should allow requests from different user on same IP", async () => {
      const uniqueIp = `${testIp}-${generateTestId()}`;

      // First exhaust limit for U1
      await callEdgeFunctionNTimes(
        {
          functionName: endpoint,
          body: { vertical: "test-vertical" },
          authToken: authTokenU1,
          overrideIp: uniqueIp,
        },
        limits.perMinute + 3,
        50
      );

      // Now send 5 requests as U2 from same IP
      const u2Results = await callEdgeFunctionNTimes(
        {
          functionName: endpoint,
          body: { vertical: "test-vertical" },
          authToken: authTokenU2,
          overrideIp: uniqueIp,
        },
        5,
        100
      );

      const statusCounts = countByStatus(u2Results);

      // Assert: All 5 from U2 should NOT be 429 (userId is part of key)
      expect(statusCounts[429] || 0).toBe(0);

      console.log("Scenario B results (U2):", statusCounts);
    });
  });

  /**
   * Scenario C – Window reset
   * After throttling U1, wait >65 seconds, then request should work
   */
  describe("Scenario C – Window reset", () => {
    const testIp = "9.9.9.11";

    it("should allow requests after minute window resets", { timeout: 120000 }, async () => {
      const uniqueIp = `${testIp}-${generateTestId()}`;

      // First exhaust limit
      const initialResults = await callEdgeFunctionNTimes(
        {
          functionName: endpoint,
          body: { vertical: "test-vertical" },
          authToken: authTokenU1,
          overrideIp: uniqueIp,
        },
        limits.perMinute + 3,
        50
      );

      // Verify we hit the limit
      const initialStatusCounts = countByStatus(initialResults);
      expect(initialStatusCounts[429] || 0).toBeGreaterThan(0);

      console.log("Scenario C - Before wait:", initialStatusCounts);

      // Wait for window to reset (65 seconds)
      console.log("Waiting 65 seconds for window reset...");
      await sleep(65000);

      // Now send 1 request
      const afterResetResult = await callEdgeFunction({
        functionName: endpoint,
        body: { vertical: "test-vertical" },
        authToken: authTokenU1,
        overrideIp: uniqueIp,
      });

      // Assert: Should NOT be 429 (window reset)
      expect(afterResetResult.status).not.toBe(429);

      console.log("Scenario C - After wait:", afterResetResult.status);
    });
  });

  /**
   * Additional: Verify proper error format
   */
  describe("429 Response Format", () => {
    it("should include proper error structure", async () => {
      const uniqueIp = `format-test-${generateTestId()}`;

      // Exhaust limit
      const results = await callEdgeFunctionNTimes(
        {
          functionName: endpoint,
          body: { vertical: "test-vertical" },
          authToken: authTokenU1,
          overrideIp: uniqueIp,
        },
        limits.perMinute + 3,
        50
      );

      const rateLimitedResponse = results.find((r) => r.status === 429);
      expect(rateLimitedResponse).toBeDefined();

      // Check response body
      const data = rateLimitedResponse?.data as Record<string, unknown>;
      expect(data.error).toBe("Rate limit exceeded");
      expect(data.limitExceeded).toBe("minute");
      expect(data.retryAfter).toBe(60);

      // Check Retry-After header
      expect(rateLimitedResponse?.retryAfter).toBe(60);
    });
  });
});
