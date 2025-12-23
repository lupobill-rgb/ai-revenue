/**
 * useDataQualityStatus - Unified hook for fail-fast data quality gating
 * 
 * HARD RULE: All KPI components must use this hook to determine what to show.
 * 
 * SOURCE OF TRUTH: The view's data_quality_status field is authoritative.
 * Context flags are fallbacks only when views haven't loaded yet.
 * 
 * Returns:
 * - status: The current data quality status (from view, authoritative)
 * - canShowRevenue: Whether revenue KPIs can show non-zero values
 * - canShowImpressions: Whether impression/click KPIs can show non-zero values
 * - canShowPipeline: Whether pipeline KPIs can show values (always true for CRM)
 * - isDemoMode: Whether demo mode is active
 * - isLiveOK: Whether all systems are connected and live
 */

import { useMemo, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ViewDataQualityStatus = 
  | 'DEMO_MODE' 
  | 'LIVE_OK' 
  | 'NO_STRIPE_CONNECTED' 
  | 'NO_ANALYTICS_CONNECTED' 
  | 'NO_PROVIDER_CONNECTED';

export interface DataQualityState {
  status: ViewDataQualityStatus;
  isDemoMode: boolean;
  isLiveOK: boolean;
  canShowRevenue: boolean;
  canShowImpressions: boolean;
  canShowPipeline: boolean;
  canShowVoice: boolean;
  stripeConnected: boolean;
  analyticsConnected: boolean;
  voiceConnected: boolean;
  loading: boolean;
  // Utility functions
  gateValue: (value: number | null | undefined, kpiType: 'revenue' | 'impressions' | 'pipeline' | 'voice') => number;
  formatRevenue: (value: number | null | undefined) => string;
  formatNumber: (value: number | null | undefined) => string;
  formatPercentage: (value: number | null | undefined) => string;
}

/**
 * SOURCE OF TRUTH: Queries v_impressions_clicks_by_workspace directly for status.
 * Does NOT use context - the view is the authority.
 */
export function useDataQualityStatus(workspaceId?: string | null): DataQualityState {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ViewDataQualityStatus>('LIVE_OK');
  const [stripeConnected, setStripeConnected] = useState(false);
  const [analyticsConnected, setAnalyticsConnected] = useState(false);
  const [voiceConnected, setVoiceConnected] = useState(false);
  
  const fetchViewStatus = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      // AUTHORITATIVE SOURCE: Query the view directly
      const { data: impressionsData } = await supabase
        .from('v_impressions_clicks_by_workspace' as any)
        .select('demo_mode, analytics_connected, stripe_connected, data_quality_status')
        .eq('workspace_id', workspaceId)
        .maybeSingle() as { data: any };
      
      if (impressionsData) {
        // View's data_quality_status is the source of truth
        const viewStatus = impressionsData.data_quality_status as ViewDataQualityStatus;
        setStatus(viewStatus || 'LIVE_OK');
        setAnalyticsConnected(impressionsData.analytics_connected === true);
        setStripeConnected(impressionsData.stripe_connected === true);
      } else {
        // No data = fresh workspace, default to checking revenue view
        const { data: revenueData } = await supabase
          .from('v_revenue_by_workspace' as any)
          .select('stripe_connected, data_quality_status')
          .eq('workspace_id', workspaceId)
          .maybeSingle() as { data: any };
        
        if (revenueData) {
          setStripeConnected(revenueData.stripe_connected === true);
          setStatus((revenueData.data_quality_status as ViewDataQualityStatus) || 'LIVE_OK');
        }
      }
      
      // Fetch voice connection status from ai_settings_voice
      // INVARIANT: ai_settings_voice.tenant_id == workspaceId (NOT workspace.tenant_id which is NULL)
      // This matches how SettingsIntegrations.tsx saves the data
      const { data: voiceSettings } = await supabase
        .from('ai_settings_voice')
        .select('is_connected, vapi_private_key, elevenlabs_api_key')
        .eq('tenant_id', workspaceId)
        .maybeSingle();
      
      if (voiceSettings) {
        const isExplicitlyConnected = voiceSettings.is_connected === true;
        const hasVapi = !!voiceSettings.vapi_private_key;
        const hasElevenLabs = !!voiceSettings.elevenlabs_api_key;
        setVoiceConnected(isExplicitlyConnected || hasVapi || hasElevenLabs);
      }
    } catch (err) {
      console.error('[useDataQualityStatus] Error fetching view status:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);
  
  useEffect(() => {
    fetchViewStatus();
  }, [fetchViewStatus]);
  
  // Derived from VIEW status only
  const isDemoMode = status === 'DEMO_MODE';
  const isLiveOK = status === 'LIVE_OK';
  
  // Gating rules derived from view status
  const canShowRevenue = useMemo(() => {
    return isDemoMode || isLiveOK || stripeConnected;
  }, [isDemoMode, isLiveOK, stripeConnected]);
  
  const canShowImpressions = useMemo(() => {
    return isDemoMode || isLiveOK || analyticsConnected;
  }, [isDemoMode, isLiveOK, analyticsConnected]);
  
  const canShowVoice = useMemo(() => {
    return isDemoMode || isLiveOK || voiceConnected;
  }, [isDemoMode, isLiveOK, voiceConnected]);
  
  const canShowPipeline = true; // Pipeline data always comes from CRM
  
  // Utility: gate a numeric value based on KPI type
  const gateValue = useCallback((value: number | null | undefined, kpiType: 'revenue' | 'impressions' | 'pipeline' | 'voice'): number => {
    if (value === null || value === undefined) return 0;
    
    switch (kpiType) {
      case 'revenue':
        return canShowRevenue ? value : 0;
      case 'impressions':
        return canShowImpressions ? value : 0;
      case 'voice':
        return canShowVoice ? value : 0;
      case 'pipeline':
        return value; // Always show pipeline values
      default:
        return 0;
    }
  }, [canShowRevenue, canShowImpressions, canShowVoice]);
  
  // Utility: format revenue with gating
  const formatRevenue = useCallback((value: number | null | undefined): string => {
    const gatedValue = gateValue(value, 'revenue');
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(gatedValue);
  }, [gateValue]);
  
  // Utility: format number (for impressions/clicks) - no gating here, use gateValue first
  const formatNumber = useCallback((value: number | null | undefined): string => {
    if (value === null || value === undefined) return '0';
    return new Intl.NumberFormat('en-US').format(value);
  }, []);
  
  // Utility: format percentage
  const formatPercentage = useCallback((value: number | null | undefined): string => {
    if (value === null || value === undefined) return '0%';
    return `${value.toFixed(1)}%`;
  }, []);
  
  return {
    status,
    isDemoMode,
    isLiveOK,
    canShowRevenue,
    canShowImpressions,
    canShowPipeline,
    canShowVoice,
    stripeConnected,
    analyticsConnected,
    voiceConnected,
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
