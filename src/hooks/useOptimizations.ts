/**
 * Optimizations Hook
 * Fetches AI-generated campaign optimizations from cmo_recommendations and campaign_optimizations
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
  changes?: any[];
  metrics_snapshot?: any;
}

export function useOptimizations(campaignId?: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['optimizations', campaignId],
    queryFn: async () => {
      // Fetch from both cmo_recommendations and campaign_optimizations
      const [recommendationsResult, optimizationsResult] = await Promise.all([
        supabase
          .from('cmo_recommendations')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10)
          .then(res => campaignId 
            ? supabase.from('cmo_recommendations').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false }).limit(10)
            : res
          ),
        campaignId 
          ? supabase
              .from('campaign_optimizations')
              .select('*')
              .eq('campaign_id', campaignId)
              .order('created_at', { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [], error: null })
      ]);

      // Build query based on campaignId
      let recommendationsQuery = supabase
        .from('cmo_recommendations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (campaignId) {
        recommendationsQuery = recommendationsQuery.eq('campaign_id', campaignId);
      }

      const { data: recommendations, error: recError } = await recommendationsQuery;
      if (recError) throw recError;

      // If we have a campaignId, also fetch detailed optimizations
      let detailedOptimizations: any[] = [];
      if (campaignId) {
        const { data: optData } = await supabase
          .from('campaign_optimizations')
          .select('*')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: false })
          .limit(10);
        
        detailedOptimizations = (optData || []).map(opt => ({
          id: opt.id,
          title: `AI Optimization - ${new Date(opt.created_at).toLocaleDateString()}`,
          description: opt.summary,
          recommendation_type: opt.optimization_type,
          priority: 'high',
          status: 'implemented',
          expected_impact: null,
          rationale: opt.summary,
          action_items: opt.changes || [],
          campaign_id: opt.campaign_id,
          created_at: opt.created_at,
          updated_at: opt.created_at,
          changes: opt.changes,
          metrics_snapshot: opt.metrics_snapshot,
        }));
      }

      // Combine results, filtering out duplicates
      const combined = [...(recommendations || []), ...detailedOptimizations];
      const seen = new Set();
      const unique = combined.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

      return unique.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ) as Optimization[];
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
