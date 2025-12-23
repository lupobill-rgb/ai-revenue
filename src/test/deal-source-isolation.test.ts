/**
 * Deal Source Isolation Test
 * 
 * INVARIANT: In live mode, only source='user' deals count toward analytics.
 * Test/seed deals must NEVER pollute live metrics.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

const canRunTests = !!SERVICE_KEY && !!SUPABASE_URL;

describe.skipIf(!canRunTests)('Deal Source Isolation', () => {
  // Use 'any' typed client to bypass strict typing for test queries
  let supabase: SupabaseClient<any>;
  let testTenantId: string;
  let testWorkspaceId: string;
  let testDealId: string;
  let userDealId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SERVICE_KEY!, {
      auth: { persistSession: false },
    });

    // Create a test tenant first
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: `Source Isolation Test Tenant - ${Date.now()}`,
        slug: `source-test-tenant-${Date.now()}`,
        status: 'active',
      })
      .select()
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Tenant creation failed: ${tenantError?.message}`);
    }
    testTenantId = tenant.id;

    // Create a live workspace (demo_mode = false) with required owner_id
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .insert({
        name: `Source Isolation Test WS - ${Date.now()}`,
        slug: `source-test-ws-${Date.now()}`,
        demo_mode: false,
        tenant_id: testTenantId,
        owner_id: testTenantId, // Required field - using tenant_id as placeholder
      })
      .select()
      .single();

    if (wsError || !workspace) {
      throw new Error(`Workspace creation failed: ${wsError?.message}`);
    }
    testWorkspaceId = workspace.id;
  });

  afterAll(async () => {
    if (!supabase) return;

    // Cleanup in reverse order: deals → workspace → tenant
    if (testDealId) {
      await supabase.from('deals').delete().eq('id', testDealId);
    }
    if (userDealId) {
      await supabase.from('deals').delete().eq('id', userDealId);
    }
    if (testWorkspaceId) {
      await supabase.from('workspaces').delete().eq('id', testWorkspaceId);
    }
    if (testTenantId) {
      await supabase.from('tenants').delete().eq('id', testTenantId);
    }
  });

  it('source=test closed_won deal must NOT count in live analytics', async () => {
    // Create a closed_won deal with source='test'
    const { data: deal, error } = await supabase
      .from('deals')
      .insert({
        workspace_id: testWorkspaceId,
        tenant_id: testTenantId,
        name: 'Test Deal - Should Not Count',
        stage: 'closed_won',
        value: 10000,
        source: 'test',
      })
      .select()
      .single();

    if (error || !deal) {
      throw new Error(`Deal creation failed: ${error?.message}`);
    }
    testDealId = deal.id;

    // Query the view
    const { data: metrics, error: viewError } = await supabase
      .from('v_pipeline_metrics_by_workspace')
      .select('*')
      .eq('workspace_id', testWorkspaceId)
      .single();

    if (viewError || !metrics) {
      throw new Error(`View query failed: ${viewError?.message}`);
    }

    // INVARIANT: won must be 0 because source='test' is excluded in live mode
    expect(Number(metrics.won)).toBe(0);
    expect(Number(metrics.verified_revenue)).toBe(0);
  });

  it('source=user closed_won deal MUST count in live analytics', async () => {
    // Create a closed_won deal with source='user' (default)
    const { data: deal, error } = await supabase
      .from('deals')
      .insert({
        workspace_id: testWorkspaceId,
        tenant_id: testTenantId,
        name: 'User Deal - Should Count',
        stage: 'closed_won',
        value: 5000,
        revenue_verified: true,
        source: 'user',
      })
      .select()
      .single();

    if (error || !deal) {
      throw new Error(`Deal creation failed: ${error?.message}`);
    }
    userDealId = deal.id;

    // Query the view
    const { data: metrics, error: viewError } = await supabase
      .from('v_pipeline_metrics_by_workspace')
      .select('*')
      .eq('workspace_id', testWorkspaceId)
      .single();

    if (viewError || !metrics) {
      throw new Error(`View query failed: ${viewError?.message}`);
    }

    // INVARIANT: won must be 1 (only the user deal counts)
    expect(Number(metrics.won)).toBe(1);
  });

  it('source constraint rejects invalid values', async () => {
    // Try to create a deal with invalid source
    const { error } = await supabase
      .from('deals')
      .insert({
        workspace_id: testWorkspaceId,
        tenant_id: testTenantId,
        name: 'Invalid Source Deal',
        stage: 'qualification',
        value: 1000,
        source: 'invalid_source',
      });

    // Should fail with constraint violation
    expect(error).not.toBeNull();
    expect(error?.message).toContain('deals_source_check');
  });
});
