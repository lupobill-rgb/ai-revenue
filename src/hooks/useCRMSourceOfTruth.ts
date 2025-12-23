/**
 * useCRMSourceOfTruth Hook
 * 
 * THE SINGLE SOURCE OF TRUTH for all CRM metrics.
 * All dashboards, reports, and analytics MUST use this hook.
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DataQualityStatus = 'DEMO_MODE' | 'REVENUE_UNVERIFIED' | 'NO_STRIPE_CONNECTED' | 'EMPTY_CRM' | 'LIVE_OK';

export interface CRMSourceOfTruth {
  workspaceId: string | null;
  tenantId: string | null;
  demoMode: boolean;
  stripeConnected: boolean;
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  lostLeads: number;
  leadToContactRate: number;
  leadToQualifiedRate: number;
  qualifiedToWonRate: number;
  overallConversionRate: number;
  totalDeals: number;
  activeDeals: number;
  wonDeals: number;
  lostDeals: number;
  pipelineValue: number;
  winRate: number;
  wonRevenue: number;
  stripeRevenue: number;
  verifiedWonCount: number;
  avgDaysToContact: number;
  avgDaysToQualify: number;
  avgDaysToConvert: number;
  dataQualityStatus: DataQualityStatus;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const defaultState: Omit<CRMSourceOfTruth, 'refresh'> = {
  workspaceId: null,
  tenantId: null,
  demoMode: false,
  stripeConnected: false,
  totalLeads: 0,
  newLeads: 0,
  contactedLeads: 0,
  qualifiedLeads: 0,
  convertedLeads: 0,
  lostLeads: 0,
  leadToContactRate: 0,
  leadToQualifiedRate: 0,
  qualifiedToWonRate: 0,
  overallConversionRate: 0,
  totalDeals: 0,
  activeDeals: 0,
  wonDeals: 0,
  lostDeals: 0,
  pipelineValue: 0,
  winRate: 0,
  wonRevenue: 0,
  stripeRevenue: 0,
  verifiedWonCount: 0,
  avgDaysToContact: 0,
  avgDaysToQualify: 0,
  avgDaysToConvert: 0,
  dataQualityStatus: 'EMPTY_CRM',
  loading: true,
  error: null,
};

export function useCRMSourceOfTruth(): CRMSourceOfTruth {
  const [state, setState] = useState<Omit<CRMSourceOfTruth, 'refresh'>>(defaultState);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    const resolveWorkspace = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: ws } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      setWorkspaceId(ws?.id || null);
    };
    resolveWorkspace();
  }, []);

  const fetchCRMTruth = useCallback(async () => {
    if (!workspaceId) {
      setState({ ...defaultState, loading: false });
      return;
    }

    setState(prev => ({ ...prev, loading: true }));

    try {
      const { data, error } = await supabase
        .from('v_crm_source_of_truth')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (error) {
        setState(prev => ({ ...prev, loading: false, error: error.message }));
        return;
      }

      if (!data) {
        setState({ ...defaultState, workspaceId, loading: false });
        return;
      }

      setState({
        workspaceId: data.workspace_id,
        tenantId: data.tenant_id,
        demoMode: data.demo_mode || false,
        stripeConnected: data.stripe_connected || false,
        totalLeads: data.total_leads || 0,
        newLeads: data.new_leads || 0,
        contactedLeads: data.contacted_leads || 0,
        qualifiedLeads: data.qualified_leads || 0,
        convertedLeads: data.converted_leads || 0,
        lostLeads: data.lost_leads || 0,
        leadToContactRate: data.lead_to_contact_rate || 0,
        leadToQualifiedRate: data.lead_to_qualified_rate || 0,
        qualifiedToWonRate: data.qualified_to_won_rate || 0,
        overallConversionRate: data.overall_conversion_rate || 0,
        totalDeals: data.total_deals || 0,
        activeDeals: data.active_deals || 0,
        wonDeals: data.won_deals || 0,
        lostDeals: data.lost_deals || 0,
        pipelineValue: data.pipeline_value || 0,
        winRate: data.win_rate || 0,
        wonRevenue: data.won_revenue || 0,
        stripeRevenue: data.stripe_revenue || 0,
        verifiedWonCount: data.verified_won_count || 0,
        avgDaysToContact: data.avg_days_to_contact || 0,
        avgDaysToQualify: data.avg_days_to_qualify || 0,
        avgDaysToConvert: data.avg_days_to_convert || 0,
        dataQualityStatus: (data.data_quality_status as DataQualityStatus) || 'EMPTY_CRM',
        loading: false,
        error: null,
      });
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: 'Failed to fetch CRM data' }));
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchCRMTruth();
  }, [fetchCRMTruth]);

  return { ...state, refresh: fetchCRMTruth };
}

export function getDataQualityBadge(status: DataQualityStatus) {
  switch (status) {
    case 'DEMO_MODE':
      return { label: 'Demo Data', variant: 'outline' as const, className: 'text-amber-500 border-amber-500' };
    case 'REVENUE_UNVERIFIED':
      return { label: 'Revenue Unverified', variant: 'outline' as const, className: 'text-amber-500 border-amber-500' };
    case 'NO_STRIPE_CONNECTED':
      return { label: 'Setup Required', variant: 'outline' as const, className: 'text-destructive border-destructive' };
    case 'EMPTY_CRM':
      return { label: 'No Data', variant: 'secondary' as const, className: '' };
    case 'LIVE_OK':
      return { label: 'Live Data', variant: 'default' as const, className: 'text-green-500 border-green-500' };
    default:
      return { label: 'Unknown', variant: 'secondary' as const, className: '' };
  }
}
