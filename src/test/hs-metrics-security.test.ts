import { describe, it, expect } from 'vitest';

/**
 * Security tests for horizontal scaling metrics
 * 
 * These tests verify:
 * 1. RPC rejects anon/authenticated (forbidden)
 * 2. Edge function returns 401 for missing auth
 * 3. Edge function returns 403 for non-admin
 * 4. Platform admin can call hs-metrics and gets 200 with metrics
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const TEST_PLATFORM_ADMIN_JWT = import.meta.env.VITE_TEST_PLATFORM_ADMIN_JWT || '';

describe('Horizontal Scaling Metrics Security', () => {

  describe('RPC get_horizontal_scaling_metrics', () => {
    it('RPC1: should reject anon calls with forbidden', async () => {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_horizontal_scaling_metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ p_window_minutes: 5 }),
      });

      // Must be rejected - either 403 (REVOKE) or 400 (forbidden exception)
      expect([400, 403]).toContain(response.status);
    });

    it('RPC1: should reject authenticated non-service-role calls', async () => {
      // Simulate an authenticated user (not service_role)
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_horizontal_scaling_metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${TEST_PLATFORM_ADMIN_JWT || SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ p_window_minutes: 5 }),
      });

      // Even with valid user JWT, should fail (not service_role)
      expect([400, 403]).toContain(response.status);
    });
  });

  describe('Edge function hs-metrics', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/hs-metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://cmo.ubigrowth.ai',
        },
        body: JSON.stringify({ window_minutes: 5 }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('authorization');
    });

    it('should return 403 for non-admin authenticated user', async () => {
      // Use anon key as "user" - will fail is_platform_admin check
      const response = await fetch(`${SUPABASE_URL}/functions/v1/hs-metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Origin': 'https://cmo.ubigrowth.ai',
        },
        body: JSON.stringify({ window_minutes: 5 }),
      });

      // Must be 403 - not 401, not 500
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('denied');
    });

    it('should return 200 with metrics for platform admin', async () => {
      // MANDATORY: This test requires a real platform admin JWT - fails hard if not set
      expect(TEST_PLATFORM_ADMIN_JWT).toBeTruthy();

      const response = await fetch(`${SUPABASE_URL}/functions/v1/hs-metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_PLATFORM_ADMIN_JWT}`,
          'Origin': 'https://cmo.ubigrowth.ai',
        },
        body: JSON.stringify({ window_minutes: 5 }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('workers');
      expect(json.data).toHaveProperty('queue_stats');
      expect(json.data).toHaveProperty('oldest_queued_age_seconds');
      expect(json.data).toHaveProperty('duplicate_groups_last_hour');
      
      // Validate structure
      expect(Array.isArray(json.data.workers)).toBe(true);
      expect(typeof json.data.queue_stats.queued).toBe('number');
      expect(typeof json.data.oldest_queued_age_seconds).toBe('number');
      expect(typeof json.data.duplicate_groups_last_hour).toBe('number');
    });
  });

  describe('CORS restrictions', () => {
    it('should allow OPTIONS from valid origin', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/hs-metrics`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://cmo.ubigrowth.ai',
        },
      });

      expect([200, 204]).toContain(response.status);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://cmo.ubigrowth.ai');
    });

    it('should reject OPTIONS from invalid origin', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/hs-metrics`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://evil-site.com',
        },
      });

      // Should be 403 or no CORS header
      const corsHeader = response.headers.get('Access-Control-Allow-Origin');
      expect(corsHeader === null || response.status === 403).toBe(true);
    });
  });
});

describe('Pass/Fail Criteria Validation', () => {
  it('HS1: requires 4+ workers active in last 2 minutes', () => {
    const now = Date.now();
    const twoMinutesAgo = now - 2 * 60 * 1000;
    
    // All 4 workers active
    const workers4Active = [
      { worker_id: 'w1', last_tick_at: new Date(now - 30000).toISOString() },
      { worker_id: 'w2', last_tick_at: new Date(now - 60000).toISOString() },
      { worker_id: 'w3', last_tick_at: new Date(now - 90000).toISOString() },
      { worker_id: 'w4', last_tick_at: new Date(now - 100000).toISOString() },
    ];

    const activeCount4 = workers4Active.filter(w => 
      new Date(w.last_tick_at).getTime() > twoMinutesAgo
    ).length;
    expect(activeCount4 >= 4).toBe(true); // HS1 PASS

    // Only 2 workers active
    const workers2Active = [
      { worker_id: 'w1', last_tick_at: new Date(now - 30000).toISOString() },
      { worker_id: 'w2', last_tick_at: new Date(now - 60000).toISOString() },
      { worker_id: 'w3', last_tick_at: new Date(now - 180000).toISOString() }, // 3 min ago
    ];

    const activeCount2 = workers2Active.filter(w => 
      new Date(w.last_tick_at).getTime() > twoMinutesAgo
    ).length;
    expect(activeCount2 >= 4).toBe(false); // HS1 FAIL
  });

  it('HS2: duplicate_groups must be 0', () => {
    const checkDuplicates = (count: number) => count === 0;
    expect(checkDuplicates(0)).toBe(true); // HS2 PASS
    expect(checkDuplicates(1)).toBe(false); // HS2 FAIL
    expect(checkDuplicates(5)).toBe(false); // HS2 FAIL
  });

  it('HS3: oldest_queued_age must be under 180s', () => {
    const checkAge = (seconds: number) => seconds < 180;
    expect(checkAge(0)).toBe(true); // HS3 PASS
    expect(checkAge(60)).toBe(true); // HS3 PASS
    expect(checkAge(179)).toBe(true); // HS3 PASS - edge
    expect(checkAge(180)).toBe(false); // HS3 FAIL - exactly 180s
    expect(checkAge(300)).toBe(false); // HS3 FAIL
  });
});
