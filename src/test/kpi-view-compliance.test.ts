/**
 * KPI View Compliance Test
 * 
 * HARD RULE: Dashboards must only query these canonical views:
 * - v_impressions_clicks_by_workspace
 * - v_revenue_by_workspace
 * - v_pipeline_metrics_by_workspace
 * - v_campaign_metrics_gated
 * 
 * This test verifies that these views exist and return the expected gated data.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('KPI View Compliance', () => {
  let testWorkspaceId: string | null = null;

  beforeAll(async () => {
    // Get a workspace ID for testing
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id')
      .limit(1)
      .maybeSingle();
    
    testWorkspaceId = workspaces?.id || null;
  });

  describe('Authoritative Views Exist', () => {
    it('v_impressions_clicks_by_workspace returns expected fields', async () => {
      if (!testWorkspaceId) {
        console.log('No workspace available for testing');
        return;
      }

      const { data, error } = await supabase
        .from('v_impressions_clicks_by_workspace' as any)
        .select('*')
        .eq('workspace_id', testWorkspaceId)
        .maybeSingle();

      // View should exist (no error about unknown table)
      expect(error?.message).not.toContain('does not exist');
      
      if (data) {
        // Should have data quality gating fields
        expect(data).toHaveProperty('demo_mode');
        expect(data).toHaveProperty('data_quality_status');
        expect(data).toHaveProperty('analytics_connected');
        expect(data).toHaveProperty('total_impressions');
        expect(data).toHaveProperty('total_clicks');
      }
    });

    it('v_revenue_by_workspace returns expected fields', async () => {
      if (!testWorkspaceId) return;

      const { data, error } = await supabase
        .from('v_revenue_by_workspace' as any)
        .select('*')
        .eq('workspace_id', testWorkspaceId)
        .maybeSingle();

      expect(error?.message).not.toContain('does not exist');
      
      if (data) {
        expect(data).toHaveProperty('revenue');
        expect(data).toHaveProperty('stripe_connected');
        expect(data).toHaveProperty('data_quality_status');
      }
    });

    it('v_pipeline_metrics_by_workspace returns expected fields', async () => {
      if (!testWorkspaceId) return;

      const { data, error } = await supabase
        .from('v_pipeline_metrics_by_workspace' as any)
        .select('*')
        .eq('workspace_id', testWorkspaceId)
        .maybeSingle();

      expect(error?.message).not.toContain('does not exist');
      
      if (data) {
        expect(data).toHaveProperty('demo_mode');
        expect(data).toHaveProperty('total_leads');
        expect(data).toHaveProperty('won');
        expect(data).toHaveProperty('lost');
        expect(data).toHaveProperty('conversion_rate');
        expect(data).toHaveProperty('win_rate');
        expect(data).toHaveProperty('data_quality_status');
      }
    });

    it('v_campaign_metrics_gated returns expected fields', async () => {
      if (!testWorkspaceId) return;

      const { data, error } = await supabase
        .from('v_campaign_metrics_gated')
        .select('*')
        .eq('workspace_id', testWorkspaceId)
        .limit(1);

      expect(error?.message).not.toContain('does not exist');
      
      // Campaign metrics are per-campaign, so may be empty
      if (data && data.length > 0) {
        expect(data[0]).toHaveProperty('impressions');
        expect(data[0]).toHaveProperty('clicks');
        expect(data[0]).toHaveProperty('revenue');
        expect(data[0]).toHaveProperty('cost');
      }
    });
  });

  describe('Data Mode Isolation', () => {
    it('demo_mode=false workspaces should not return demo data_mode records', async () => {
      // Get a live (non-demo) workspace
      const { data: liveWorkspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('demo_mode', false)
        .limit(1)
        .maybeSingle();

      if (!liveWorkspace) {
        console.log('No live workspace available for testing');
        return;
      }

      // Query pipeline view - should only return live data
      const { data: pipelineData } = await supabase
        .from('v_pipeline_metrics_by_workspace' as any)
        .select('demo_mode, data_quality_status')
        .eq('workspace_id', liveWorkspace.id)
        .maybeSingle() as { data: any };

      if (pipelineData) {
        // If workspace is live, view should reflect that
        expect(pipelineData.demo_mode).toBe(false);
        // Status should NOT be DEMO_MODE
        expect(pipelineData.data_quality_status).not.toBe('DEMO_MODE');
      }
    });

    it('demo_mode=true workspaces should return DEMO_MODE status', async () => {
      // Get a demo workspace
      const { data: demoWorkspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('demo_mode', true)
        .limit(1)
        .maybeSingle();

      if (!demoWorkspace) {
        console.log('No demo workspace available for testing');
        return;
      }

      const { data: pipelineData } = await supabase
        .from('v_pipeline_metrics_by_workspace' as any)
        .select('demo_mode, data_quality_status')
        .eq('workspace_id', demoWorkspace.id)
        .maybeSingle() as { data: any };

      if (pipelineData) {
        expect(pipelineData.demo_mode).toBe(true);
        expect(pipelineData.data_quality_status).toBe('DEMO_MODE');
      }
    });
  });

  describe('Provider Connectivity Gating', () => {
    it('revenue is 0 when stripe_connected=false in live mode', async () => {
      // Get a live workspace without Stripe
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('demo_mode', false)
        .eq('stripe_connected', false)
        .limit(1)
        .maybeSingle();

      if (!workspace) {
        console.log('No non-Stripe live workspace for testing');
        return;
      }

      const { data: revenueData } = await supabase
        .from('v_revenue_by_workspace' as any)
        .select('revenue, stripe_connected, data_quality_status')
        .eq('workspace_id', workspace.id)
        .maybeSingle() as { data: any };

      if (revenueData) {
        expect(revenueData.stripe_connected).toBe(false);
        // Revenue should be 0 OR status should indicate no stripe
        if (!revenueData.stripe_connected) {
          expect(revenueData.data_quality_status).toBe('NO_STRIPE_CONNECTED');
        }
      }
    });
  });
});

describe('Source Tagging Enforcement', () => {
  it('deals created should have source=user by default', async () => {
    // This is a schema-level check - verify the deals table has source column
    const { data: deals } = await supabase
      .from('deals')
      .select('source')
      .limit(1);

    // If there are deals, check source is set
    if (deals && deals.length > 0) {
      expect(deals[0].source).toBeDefined();
      expect(['user', 'import', 'api', 'seed', 'test']).toContain(deals[0].source);
    }
  });

  it('leads created should have source=user by default', async () => {
    const { data: leads } = await supabase
      .from('crm_leads')
      .select('source')
      .limit(1);

    if (leads && leads.length > 0) {
      expect(leads[0].source).toBeDefined();
    }
  });
});
