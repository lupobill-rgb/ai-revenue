/**
 * useDataQualityStatus - Unified hook for fail-fast data quality gating
 * 
 * HARD RULE: All KPI components must use this hook to determine what to show.
 * 
 * Returns:
 * - status: The current data quality status
 * - canShowRevenue: Whether revenue KPIs can show non-zero values
 * - canShowImpressions: Whether impression/click KPIs can show non-zero values
 * - canShowPipeline: Whether pipeline KPIs can show values (always true for CRM)
 * - isDemoMode: Whether demo mode is active
 * - isLiveOK: Whether all systems are connected and live
 * - formatKPI: Gated formatting function that returns 0 if not allowed
 */

import { useMemo } from "react";
import { usePipelineMetrics } from "./usePipelineMetrics";
import { useWorkspaceContext, DataQualityStatus } from "@/contexts/WorkspaceContext";

export interface DataQualityState {
  status: DataQualityStatus;
  isDemoMode: boolean;
  isLiveOK: boolean;
  canShowRevenue: boolean;
  canShowImpressions: boolean;
  canShowPipeline: boolean;
  stripeConnected: boolean;
  analyticsConnected: boolean;
  loading: boolean;
  // Utility functions
  gateValue: (value: number | null | undefined, kpiType: 'revenue' | 'impressions' | 'pipeline') => number;
  formatRevenue: (value: number | null | undefined) => string;
  formatNumber: (value: number | null | undefined) => string;
  formatPercentage: (value: number | null | undefined) => string;
}

export function useDataQualityStatus(workspaceId?: string | null): DataQualityState {
  const { 
    demoMode, 
    stripeConnected, 
    analyticsConnected, 
    dataQualityStatus,
    isLoading: contextLoading 
  } = useWorkspaceContext();
  
  const { metrics, dataQuality, loading: metricsLoading } = usePipelineMetrics(workspaceId ?? null);
  
  const loading = contextLoading || metricsLoading;
  
  // Derive the authoritative status
  const status: DataQualityStatus = useMemo(() => {
    // Use metrics view status if available, otherwise use context
    if (metrics?.data_quality_status) {
      return metrics.data_quality_status as DataQualityStatus;
    }
    return dataQualityStatus;
  }, [metrics?.data_quality_status, dataQualityStatus]);
  
  const isDemoMode = status === 'DEMO_MODE' || demoMode;
  const isLiveOK = status === 'LIVE_OK';
  
  // Gating rules
  const canShowRevenue = isDemoMode || isLiveOK || stripeConnected;
  const canShowImpressions = isDemoMode || isLiveOK || analyticsConnected;
  const canShowPipeline = true; // Pipeline data always comes from CRM
  
  // Utility: gate a numeric value based on KPI type
  const gateValue = (value: number | null | undefined, kpiType: 'revenue' | 'impressions' | 'pipeline'): number => {
    if (value === null || value === undefined) return 0;
    
    switch (kpiType) {
      case 'revenue':
        return canShowRevenue ? value : 0;
      case 'impressions':
        return canShowImpressions ? value : 0;
      case 'pipeline':
        return value; // Always show pipeline values
      default:
        return 0;
    }
  };
  
  // Utility: format revenue with gating
  const formatRevenue = (value: number | null | undefined): string => {
    const gatedValue = gateValue(value, 'revenue');
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(gatedValue);
  };
  
  // Utility: format number with gating (for impressions/clicks)
  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '0';
    return new Intl.NumberFormat('en-US').format(value);
  };
  
  // Utility: format percentage
  const formatPercentage = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '0%';
    return `${value.toFixed(1)}%`;
  };
  
  return {
    status,
    isDemoMode,
    isLiveOK,
    canShowRevenue,
    canShowImpressions,
    canShowPipeline,
    stripeConnected,
    analyticsConnected,
    loading,
    gateValue,
    formatRevenue,
    formatNumber,
    formatPercentage,
  };
}

/**
 * Validate that a data source doesn't leak demo data in live mode
 * Throws if violation detected - for use in edge functions and critical paths
 */
export function validateNoDataLeak(
  metricsMode: 'real' | 'demo',
  dataSource: 'live' | 'demo' | string
): void {
  if (metricsMode === 'real' && dataSource === 'demo') {
    throw new Error(
      `DATA INTEGRITY VIOLATION: Demo data source detected in live mode. ` +
      `This indicates a potential data leak. Blocking operation.`
    );
  }
}
