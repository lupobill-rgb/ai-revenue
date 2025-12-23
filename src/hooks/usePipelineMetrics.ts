/**
 * usePipelineMetrics - CRM Single Source of Truth for Pipeline KPIs
 * 
 * This hook queries v_pipeline_metrics_by_workspace (the authoritative view)
 * to get properly gated pipeline metrics that respect demo_mode and data_mode.
 * 
 * RULES:
 * - Won = 0 unless a deal exists with status='won'
 * - Revenue = 0 unless Stripe connected + revenue_verified
 * - Win rate = won / (won + lost) OR 0 if no closed deals
 * - Conversion rate = won / total_leads OR 0 if no leads
 * - Avg conversion time = null/0 if no won deals with timestamps
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PipelineMetrics {
  workspace_id: string;
  tenant_id: string;
  demo_mode: boolean;
  total_leads: number;
  contacted: number;
  qualified: number;
  converted: number;
  lost_leads: number;
  won: number;
  lost: number;
  verified_revenue: number;
  conversion_rate: number; // percentage (0-100)
  win_rate: number; // percentage (0-100)
  avg_conversion_time_days: number | null;
  stage_breakdown: Record<string, { count: number; avg_days: number }>;
  data_quality_status: 'DEMO_MODE' | 'LIVE_OK' | 'NO_STRIPE_CONNECTED' | 'NO_ANALYTICS_CONNECTED';
}

export interface DataQualityFlags {
  workspace_id: string;
  tenant_id: string;
  demo_mode: boolean;
  stripe_connected: boolean;
  analytics_connected: boolean;
  voice_provider_configured: boolean;
  email_provider_configured: boolean;
  data_quality_status: string;
}

interface UsePipelineMetricsResult {
  metrics: PipelineMetrics | null;
  dataQuality: DataQualityFlags | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePipelineMetrics(workspaceId: string | null): UsePipelineMetricsResult {
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQualityFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!workspaceId) {
      setMetrics(null);
      setDataQuality(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch pipeline metrics from authoritative view
      // Use type assertion since views aren't in generated types
      const { data: pipelineData, error: pipelineError } = await supabase
        .from('v_pipeline_metrics_by_workspace' as any)
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle() as { data: any; error: any };

      if (pipelineError) {
        console.error('[usePipelineMetrics] Error fetching pipeline:', pipelineError);
        setError(pipelineError.message);
      } else if (pipelineData) {
        setMetrics({
          workspace_id: pipelineData.workspace_id,
          tenant_id: pipelineData.tenant_id,
          demo_mode: pipelineData.demo_mode === true,
          total_leads: Number(pipelineData.total_leads || 0),
          contacted: Number(pipelineData.contacted || 0),
          qualified: Number(pipelineData.qualified || 0),
          converted: Number(pipelineData.converted || 0),
          lost_leads: Number(pipelineData.lost_leads || 0),
          won: Number(pipelineData.won || 0),
          lost: Number(pipelineData.lost || 0),
          verified_revenue: Number(pipelineData.verified_revenue || 0),
          conversion_rate: Number(pipelineData.conversion_rate || 0),
          win_rate: Number(pipelineData.win_rate || 0),
          avg_conversion_time_days: pipelineData.avg_conversion_time_days != null 
            ? Number(pipelineData.avg_conversion_time_days) 
            : null,
          stage_breakdown: pipelineData.stage_breakdown || {},
          data_quality_status: pipelineData.data_quality_status || 'LIVE_OK',
        });
      } else {
        // No data = empty workspace, return zeros
        setMetrics({
          workspace_id: workspaceId,
          tenant_id: '',
          demo_mode: false,
          total_leads: 0,
          contacted: 0,
          qualified: 0,
          converted: 0,
          lost_leads: 0,
          won: 0,
          lost: 0,
          verified_revenue: 0,
          conversion_rate: 0,
          win_rate: 0,
          avg_conversion_time_days: null,
          stage_breakdown: {},
          data_quality_status: 'LIVE_OK',
        });
      }

      // Fetch data quality flags from authoritative view
      const { data: qualityData, error: qualityError } = await supabase
        .from('v_data_quality_by_workspace' as any)
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle() as { data: any; error: any };

      if (qualityError) {
        console.error('[usePipelineMetrics] Error fetching data quality:', qualityError);
      } else if (qualityData) {
        setDataQuality({
          workspace_id: qualityData.workspace_id,
          tenant_id: qualityData.tenant_id,
          demo_mode: qualityData.demo_mode === true,
          stripe_connected: qualityData.stripe_connected === true,
          analytics_connected: qualityData.analytics_connected === true,
          voice_provider_configured: qualityData.voice_provider_configured === true,
          email_provider_configured: qualityData.email_provider_configured === true,
          data_quality_status: qualityData.data_quality_status || 'LIVE_OK',
        });
      }

    } catch (err) {
      console.error('[usePipelineMetrics] Unexpected error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    dataQuality,
    loading,
    error,
    refresh: fetchMetrics,
  };
}

/**
 * Helper to format pipeline metrics for display with proper zero/dash behavior
 */
export function formatPipelineMetric(
  value: number | null | undefined,
  type: 'percentage' | 'number' | 'days' | 'currency',
  fallback: string = '—'
): string {
  if (value === null || value === undefined) return fallback;
  
  switch (type) {
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'days':
      return value > 0 ? `${value.toFixed(1)} days` : fallback;
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    case 'number':
    default:
      return new Intl.NumberFormat('en-US').format(value);
  }
}
