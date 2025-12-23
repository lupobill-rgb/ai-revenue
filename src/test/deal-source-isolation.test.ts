/**
 * Deal Source Isolation Test
 * 
 * INVARIANT: In live mode, only source='user' deals count toward analytics.
 * Test/seed deals must NEVER pollute live metrics.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

const canRunTests = !!SERVICE_KEY;

describe.skipIf(!canRunTests)('Deal Source Isolation', () => {
  let testWorkspaceId: string;
  let testDealId: string;
  let userDealId: string;

  beforeAll(async () => {
    // Create a live workspace (demo_mode = false)
    const wsRes = await fetch(`${SUPABASE_URL}/rest/v1/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY!,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        name: `Source Isolation Test - ${Date.now()}`,
        slug: `source-test-${Date.now()}`,
        demo_mode: false,
      }),
    });
    const [workspace] = await wsRes.json();
    testWorkspaceId = workspace.id;
  });

  afterAll(async () => {
    // Cleanup: delete test deals and workspace
    if (testDealId) {
      await fetch(`${SUPABASE_URL}/rest/v1/deals?id=eq.${testDealId}`, {
        method: 'DELETE',
        headers: {
          'apikey': SERVICE_KEY!,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });
    }
    if (userDealId) {
      await fetch(`${SUPABASE_URL}/rest/v1/deals?id=eq.${userDealId}`, {
        method: 'DELETE',
        headers: {
          'apikey': SERVICE_KEY!,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });
    }
    if (testWorkspaceId) {
      await fetch(`${SUPABASE_URL}/rest/v1/workspaces?id=eq.${testWorkspaceId}`, {
        method: 'DELETE',
        headers: {
          'apikey': SERVICE_KEY!,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });
    }
  });

  it('source=test closed_won deal must NOT count in live analytics', async () => {
    // Create a closed_won deal with source='test'
    const dealRes = await fetch(`${SUPABASE_URL}/rest/v1/deals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY!,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        workspace_id: testWorkspaceId,
        name: 'Test Deal - Should Not Count',
        stage: 'closed_won',
        value: 10000,
        source: 'test',
      }),
    });
    const [deal] = await dealRes.json();
    testDealId = deal.id;

    // Query the view
    const viewRes = await fetch(
      `${SUPABASE_URL}/rest/v1/v_pipeline_metrics_by_workspace?workspace_id=eq.${testWorkspaceId}`,
      {
        headers: {
          'apikey': SERVICE_KEY!,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      }
    );
    const [metrics] = await viewRes.json();

    // INVARIANT: won must be 0 because source='test' is excluded in live mode
    expect(metrics.won).toBe(0);
    expect(metrics.verified_revenue).toBe(0);
  });

  it('source=user closed_won deal MUST count in live analytics', async () => {
    // Create a closed_won deal with source='user' (default)
    const dealRes = await fetch(`${SUPABASE_URL}/rest/v1/deals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY!,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        workspace_id: testWorkspaceId,
        name: 'User Deal - Should Count',
        stage: 'closed_won',
        value: 5000,
        revenue_verified: true,
        source: 'user',
      }),
    });
    const [deal] = await dealRes.json();
    userDealId = deal.id;

    // Query the view
    const viewRes = await fetch(
      `${SUPABASE_URL}/rest/v1/v_pipeline_metrics_by_workspace?workspace_id=eq.${testWorkspaceId}`,
      {
        headers: {
          'apikey': SERVICE_KEY!,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      }
    );
    const [metrics] = await viewRes.json();

    // INVARIANT: won must be 1 (only the user deal counts)
    expect(metrics.won).toBe(1);
  });

  it('source constraint rejects invalid values', async () => {
    // Try to create a deal with invalid source
    const dealRes = await fetch(`${SUPABASE_URL}/rest/v1/deals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY!,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        workspace_id: testWorkspaceId,
        name: 'Invalid Source Deal',
        stage: 'qualification',
        value: 1000,
        source: 'invalid_source',
      }),
    });

    // Should fail with constraint violation
    expect(dealRes.ok).toBe(false);
  });
});
