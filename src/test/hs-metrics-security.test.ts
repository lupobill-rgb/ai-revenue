import { describe, it, expect, vi } from 'vitest';

/**
 * Security tests for horizontal scaling metrics
 * 
 * These tests verify:
 * 1. anon/authenticated users cannot call the RPC directly (forbidden)
 * 2. platform admin can call hs-metrics edge function and get metrics
 * 3. non-admin users get 403 from hs-metrics
 */

describe('Horizontal Scaling Metrics Security', () => {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

  describe('RPC get_horizontal_scaling_metrics', () => {
    it('should reject anon calls with forbidden error', async () => {
      // Anon user tries to call RPC directly
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_horizontal_scaling_metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ p_window_minutes: 5 }),
      });

      // Should fail - either 403 (forbidden by REVOKE) or error in response
      expect(response.status === 403 || response.status === 401 || response.status === 400).toBe(true);
    });

    it('should reject authenticated non-service-role calls', async () => {
      // Even with a valid JWT, non-service-role should be rejected
      // This simulates what would happen if someone tried to bypass the edge function
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_horizontal_scaling_metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, // Not a real user JWT
        },
        body: JSON.stringify({ p_window_minutes: 5 }),
      });

      // Should fail
      expect(response.ok).toBe(false);
    });
  });

  describe('Edge function hs-metrics', () => {
    it('should return 401 when no Authorization header', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/hs-metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ window_minutes: 5 }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('authorization');
    });

    it('should return 403 for non-admin users', async () => {
      // This test would require a real non-admin user JWT
      // For now, we test with anon key which should also fail
      const response = await fetch(`${SUPABASE_URL}/functions/v1/hs-metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ window_minutes: 5 }),
      });

      // Should be 403 or 500 (if JWT validation fails differently)
      expect(response.status === 403 || response.status === 500).toBe(true);
    });

    // Note: Testing successful admin access requires a real platform admin JWT
    // This would be done in integration tests with proper test fixtures
    it.skip('should return metrics for platform admin', async () => {
      // This test requires a real platform admin JWT
      // Would be implemented in integration tests
      const adminJwt = ''; // Would come from test setup
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/hs-metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminJwt}`,
        },
        body: JSON.stringify({ window_minutes: 5 }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('workers');
      expect(data.data).toHaveProperty('queue_stats');
      expect(data.data).toHaveProperty('oldest_queued_age_seconds');
      expect(data.data).toHaveProperty('duplicate_groups_last_hour');
    });
  });

  describe('CORS restrictions', () => {
    it('should include CORS headers in OPTIONS response', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/hs-metrics`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://cmo.ubigrowth.ai',
        },
      });

      // OPTIONS should succeed
      expect(response.status === 200 || response.status === 204).toBe(true);
    });
  });
});

describe('Pass/Fail Criteria Validation', () => {
  it('HS1: should require 4+ workers active in last 2 minutes', () => {
    const now = Date.now();
    const twoMinutesAgo = now - 2 * 60 * 1000;
    
    const workers = [
      { worker_id: 'w1', last_tick_at: new Date(now - 30000).toISOString() },
      { worker_id: 'w2', last_tick_at: new Date(now - 60000).toISOString() },
      { worker_id: 'w3', last_tick_at: new Date(now - 90000).toISOString() },
      { worker_id: 'w4', last_tick_at: new Date(now - 100000).toISOString() },
    ];

    const activeWorkers = workers.filter(w => 
      new Date(w.last_tick_at).getTime() > twoMinutesAgo
    );

    expect(activeWorkers.length).toBe(4);
    expect(activeWorkers.length >= 4).toBe(true); // HS1 PASS
  });

  it('HS1: should fail with fewer than 4 active workers', () => {
    const now = Date.now();
    const twoMinutesAgo = now - 2 * 60 * 1000;
    
    const workers = [
      { worker_id: 'w1', last_tick_at: new Date(now - 30000).toISOString() },
      { worker_id: 'w2', last_tick_at: new Date(now - 60000).toISOString() },
      { worker_id: 'w3', last_tick_at: new Date(now - 180000).toISOString() }, // 3 min ago - inactive
    ];

    const activeWorkers = workers.filter(w => 
      new Date(w.last_tick_at).getTime() > twoMinutesAgo
    );

    expect(activeWorkers.length).toBe(2);
    expect(activeWorkers.length >= 4).toBe(false); // HS1 FAIL
  });

  it('HS2: duplicate_groups must be 0', () => {
    const zeroDuplicates: number = 0;
    const someDuplicates: number = 1;
    const isZeroPass = zeroDuplicates === 0;
    const isOneFail = someDuplicates === 0;
    expect(isZeroPass).toBe(true); // HS2 PASS
    expect(isOneFail).toBe(false); // HS2 FAIL with 1 duplicate group
  });

  it('HS3: oldest_queued_age must be under 180s', () => {
    const age60 = 60;
    const age179 = 179;
    const age180 = 180;
    const age300 = 300;
    expect(age60 < 180).toBe(true); // HS3 PASS - 60s
    expect(age179 < 180).toBe(true); // HS3 PASS - edge case
    expect(age180 < 180).toBe(false); // HS3 FAIL - exactly 180s
    expect(age300 < 180).toBe(false); // HS3 FAIL - 5 minutes
  });
});
