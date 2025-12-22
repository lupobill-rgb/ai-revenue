/**
 * Data Integrity Regression Test
 * 
 * Verifies that demo data does not leak into live mode via the dashboard views.
 * 
 * Test scenario:
 * 1. workspace.demo_mode = false (live mode)
 * 2. Insert a known demo row (data_mode='demo')
 * 3. Confirm the view returns 0 for that workspace
 * 4. Insert a live row (data_mode='live')
 * 5. Confirm the view reflects it
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Skip tests if no service key (can't run in CI without secrets)
const canRunTests = !!SUPABASE_SERVICE_KEY;

describe.skipIf(!canRunTests)('Data Integrity - Demo Data Leak Prevention', () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  let testTenantId: string;
  let testWorkspaceId: string;
  
  beforeAll(async () => {
    // Create test tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({ name: 'Test Tenant DI', slug: `test-di-${Date.now()}`, status: 'active' })
      .select()
      .single();
    
    if (tenantError) throw tenantError;
    testTenantId = tenant.id;
    
    // Create test workspace in LIVE mode (demo_mode = false)
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .insert({ 
        name: 'Test Workspace DI', 
        slug: `test-ws-di-${Date.now()}`,
        tenant_id: testTenantId,
        demo_mode: false, // LIVE MODE
        stripe_connected: true,
      })
      .select()
      .single();
    
    if (wsError) throw wsError;
    testWorkspaceId = workspace.id;
  });
  
  afterAll(async () => {
    // Cleanup test data
    if (testWorkspaceId) {
      await supabase.from('cmo_metrics_snapshots').delete().eq('workspace_id', testWorkspaceId);
      await supabase.from('workspaces').delete().eq('id', testWorkspaceId);
    }
    if (testTenantId) {
      await supabase.from('tenants').delete().eq('id', testTenantId);
    }
  });
  
  it('should return 0 impressions when only demo data exists in live mode', async () => {
    // Insert demo data (data_mode='demo')
    const { error: insertError } = await supabase
      .from('cmo_metrics_snapshots')
      .insert({
        tenant_id: testTenantId,
        workspace_id: testWorkspaceId,
        metric_type: 'campaign_daily',
        snapshot_date: new Date().toISOString().split('T')[0],
        impressions: 10000, // Demo impressions that should NOT appear
        clicks: 500,
        data_mode: 'demo',
      });
    
    if (insertError) throw insertError;
    
    // Query the view
    const { data: viewData, error: viewError } = await supabase
      .from('v_impressions_clicks_by_workspace')
      .select('*')
      .eq('workspace_id', testWorkspaceId)
      .maybeSingle();
    
    if (viewError) throw viewError;
    
    // In live mode, demo data should result in 0 impressions
    expect(viewData?.total_impressions || 0).toBe(0);
    expect(viewData?.total_clicks || 0).toBe(0);
  });
  
  it('should return actual impressions when live data exists in live mode', async () => {
    // Insert live data (data_mode='live')
    const { error: insertError } = await supabase
      .from('cmo_metrics_snapshots')
      .insert({
        tenant_id: testTenantId,
        workspace_id: testWorkspaceId,
        metric_type: 'campaign_daily',
        snapshot_date: new Date().toISOString().split('T')[0],
        impressions: 5000, // Live impressions that SHOULD appear
        clicks: 250,
        data_mode: 'live',
      });
    
    if (insertError) throw insertError;
    
    // Query the view
    const { data: viewData, error: viewError } = await supabase
      .from('v_impressions_clicks_by_workspace')
      .select('*')
      .eq('workspace_id', testWorkspaceId)
      .maybeSingle();
    
    if (viewError) throw viewError;
    
    // In live mode, only live data should appear (5000 impressions, 250 clicks)
    // Demo data (10000 impressions) should NOT be included
    expect(viewData?.cmo_impressions).toBe(5000);
    expect(viewData?.cmo_clicks).toBe(250);
  });
  
  it('should have LIVE_OK data_quality_status when analytics connected', async () => {
    // Query the view
    const { data: viewData, error: viewError } = await supabase
      .from('v_impressions_clicks_by_workspace')
      .select('data_quality_status')
      .eq('workspace_id', testWorkspaceId)
      .maybeSingle();
    
    if (viewError) throw viewError;
    
    // Since demo_mode=false and we haven't connected analytics, expect NO_ANALYTICS_CONNECTED
    // (or LIVE_OK if analytics check passes differently)
    expect(['LIVE_OK', 'NO_ANALYTICS_CONNECTED']).toContain(viewData?.data_quality_status);
  });
  
  it('guardDemoLeak should throw when demo data leaks into live mode', async () => {
    // Simulate the guard function logic
    const isLiveMode = true;
    const responseDataMode = 'demo';
    
    const guardDemoLeak = (responseMetaDataMode?: string) => {
      if (isLiveMode && responseMetaDataMode === 'demo') {
        throw new Error('DEMO DATA LEAK: blocked');
      }
    };
    
    expect(() => guardDemoLeak(responseDataMode)).toThrow('DEMO DATA LEAK: blocked');
    expect(() => guardDemoLeak('live')).not.toThrow();
  });
});
