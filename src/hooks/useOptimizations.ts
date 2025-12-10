/**
 * Optimizations Hook
 * Fetches AI-generated campaign optimizations from cmo_recommendations
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Optimization {
  id: string;
  title: string;
  description: string | null;
  recommendation_type: string;
  priority: string | null;
  status: string | null;
  expected_impact: string | null;
  rationale: string | null;
  action_items: any[];
  campaign_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useOptimizations(campaignId?: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['optimizations', campaignId],
    queryFn: async () => {
      let query = supabase
        .from('cmo_recommendations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (campaignId) {
        query = query.eq('campaign_id', campaignId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Optimization[];
    },
    staleTime: 60000,
  });

  return {
    data: data || [],
    loading: isLoading,
    error,
    refetch,
  };
}
