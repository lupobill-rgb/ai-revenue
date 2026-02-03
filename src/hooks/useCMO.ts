// CMO React Query Hooks

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as cmoApi from "@/lib/cmo/api";
import type {
  CMOBrandProfile,
  CMOICPSegment,
  CMOOffer,
  CMOMarketingPlan,
  CMOFunnel,
  CMOCampaign,
  CMOContentAsset,
  CMOMetricsSnapshot,
  CMOWeeklySummary,
  CMORecommendation,
  CMOCalendarEvent,
} from "@/lib/cmo/types";

// Query Keys
export const cmoKeys = {
  all: ["cmo"] as const,
  brandProfiles: (workspaceId: string) => [...cmoKeys.all, "brandProfiles", workspaceId] as const,
  brandProfile: (id: string) => [...cmoKeys.all, "brandProfile", id] as const,
  icpSegments: (workspaceId: string) => [...cmoKeys.all, "icpSegments", workspaceId] as const,
  offers: (workspaceId: string) => [...cmoKeys.all, "offers", workspaceId] as const,
  marketingPlans: (workspaceId: string) => [...cmoKeys.all, "marketingPlans", workspaceId] as const,
  marketingPlan: (id: string) => [...cmoKeys.all, "marketingPlan", id] as const,
  funnels: (workspaceId: string) => [...cmoKeys.all, "funnels", workspaceId] as const,
  funnel: (id: string) => [...cmoKeys.all, "funnel", id] as const,
  campaigns: (workspaceId: string) => [...cmoKeys.all, "campaigns", workspaceId] as const,
  campaign: (id: string) => [...cmoKeys.all, "campaign", id] as const,
  contentAssets: (workspaceId: string, campaignId?: string) => 
    [...cmoKeys.all, "contentAssets", workspaceId, campaignId] as const,
  contentAsset: (id: string) => [...cmoKeys.all, "contentAsset", id] as const,
  metrics: (workspaceId: string, filters?: Record<string, unknown>) => 
    [...cmoKeys.all, "metrics", workspaceId, filters] as const,
  weeklySummaries: (workspaceId: string) => [...cmoKeys.all, "weeklySummaries", workspaceId] as const,
  recommendations: (workspaceId: string, status?: string) => 
    [...cmoKeys.all, "recommendations", workspaceId, status] as const,
  calendarEvents: (workspaceId: string, filters?: Record<string, unknown>) => 
    [...cmoKeys.all, "calendarEvents", workspaceId, filters] as const,
};

// Brand Profiles
export function useBrandProfiles(workspaceId: string) {
  return useQuery({
    queryKey: cmoKeys.brandProfiles(workspaceId),
    queryFn: () => cmoApi.getBrandProfiles(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useBrandProfile(id: string) {
  return useQuery({
    queryKey: cmoKeys.brandProfile(id),
    queryFn: () => cmoApi.getBrandProfile(id),
    enabled: !!id,
  });
}

export function useCreateBrandProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (profile: Partial<CMOBrandProfile>) => cmoApi.createBrandProfile(profile),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: cmoKeys.brandProfiles(data.workspace_id) });
    },
  });
}

export function useUpdateBrandProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CMOBrandProfile> }) => 
      cmoApi.updateBrandProfile(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: cmoKeys.brandProfile(data.id) });
      queryClient.invalidateQueries({ queryKey: cmoKeys.brandProfiles(data.workspace_id) });
    },
  });
}

// ICP Segments
export function useICPSegments(workspaceId: string) {
  return useQuery({
    queryKey: cmoKeys.icpSegments(workspaceId),
    queryFn: () => cmoApi.getICPSegments(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useCreateICPSegment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (segment: Partial<CMOICPSegment>) => cmoApi.createICPSegment(segment),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: cmoKeys.icpSegments(data.workspace_id) });
    },
  });
}

export function useUpdateICPSegment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CMOICPSegment> }) => 
      cmoApi.updateICPSegment(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: cmoKeys.icpSegments(data.workspace_id) });
    },
  });
}

// Offers
export function useOffers(workspaceId: string) {
  return useQuery({
    queryKey: cmoKeys.offers(workspaceId),
    queryFn: () => cmoApi.getOffers(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useCreateOffer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (offer: Partial<CMOOffer>) => cmoApi.createOffer(offer),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: cmoKeys.offers(data.workspace_id) });
    },
  });
}

// Marketing Plans
export function useMarketingPlans(workspaceId: string) {
  return useQuery({
    queryKey: cmoKeys.marketingPlans(workspaceId),
    queryFn: () => cmoApi.getMarketingPlans(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useMarketingPlan(id: string) {
  return useQuery({
    queryKey: cmoKeys.marketingPlan(id),
    queryFn: () => cmoApi.getMarketingPlan(id),
    enabled: !!id,
  });
}

export function useCreateMarketingPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (plan: Partial<CMOMarketingPlan>) => cmoApi.createMarketingPlan(plan),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: cmoKeys.marketingPlans(data.workspace_id) });
    },
  });
}

// Funnels
export function useFunnels(workspaceId: string) {
  return useQuery({
    queryKey: cmoKeys.funnels(workspaceId),
    queryFn: () => cmoApi.getFunnels(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useFunnel(id: string) {
  return useQuery({
    queryKey: cmoKeys.funnel(id),
    queryFn: () => cmoApi.getFunnel(id),
    enabled: !!id,
  });
}

// Campaigns
export function useCampaigns(workspaceId: string) {
  return useQuery({
    queryKey: cmoKeys.campaigns(workspaceId),
    queryFn: () => cmoApi.getCampaigns(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: cmoKeys.campaign(id),
    queryFn: () => cmoApi.getCampaign(id),
    enabled: !!id,
  });
}

export function useUpdateCampaignGoal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ campaignId, goal }: { campaignId: string; goal: string | null }) => 
      cmoApi.updateCampaignGoal(campaignId, goal),
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: cmoKeys.campaign(campaignId) });
      queryClient.invalidateQueries({ queryKey: cmoKeys.all });
    },
  });
}

// Content Assets
export function useContentAssets(workspaceId: string, campaignId?: string) {
  return useQuery({
    queryKey: cmoKeys.contentAssets(workspaceId, campaignId),
    queryFn: () => cmoApi.getContentAssets(workspaceId, campaignId),
    enabled: !!workspaceId,
  });
}

export function useContentAsset(id: string) {
  return useQuery({
    queryKey: cmoKeys.contentAsset(id),
    queryFn: () => cmoApi.getContentAsset(id),
    enabled: !!id,
  });
}

// Metrics
export function useMetricsSnapshots(
  workspaceId: string,
  filters?: { campaignId?: string; startDate?: string; endDate?: string }
) {
  return useQuery({
    queryKey: cmoKeys.metrics(workspaceId, filters),
    queryFn: () => cmoApi.getMetricsSnapshots(workspaceId, filters),
    enabled: !!workspaceId,
  });
}

// Weekly Summaries
export function useWeeklySummaries(workspaceId: string, limit = 10) {
  return useQuery({
    queryKey: cmoKeys.weeklySummaries(workspaceId),
    queryFn: () => cmoApi.getWeeklySummaries(workspaceId, limit),
    enabled: !!workspaceId,
  });
}

// Recommendations
export function useRecommendations(workspaceId: string, status?: string) {
  return useQuery({
    queryKey: cmoKeys.recommendations(workspaceId, status),
    queryFn: () => cmoApi.getRecommendations(workspaceId, status),
    enabled: !!workspaceId,
  });
}

export function useUpdateRecommendationStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => 
      cmoApi.updateRecommendationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cmoKeys.all });
    },
  });
}

// Calendar Events
export function useCalendarEvents(
  workspaceId: string,
  filters?: { startDate?: string; endDate?: string; channel?: string }
) {
  return useQuery({
    queryKey: cmoKeys.calendarEvents(workspaceId, filters),
    queryFn: () => cmoApi.getCalendarEvents(workspaceId, filters),
    enabled: !!workspaceId,
  });
}

// CMO Kernel (AI Gateway)
export function useCMOKernel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ mode, payload }: { mode: string; payload: Record<string, unknown> }) => 
      cmoApi.invokeCMOKernel(mode, payload),
    onSuccess: () => {
      // Invalidate all CMO queries after AI operations
      queryClient.invalidateQueries({ queryKey: cmoKeys.all });
    },
  });
}

// Asset Upload
export function useUploadCMOAsset() {
  return useMutation({
    mutationFn: ({ tenantId, path, file }: { tenantId: string; path: string; file: File }) => 
      cmoApi.uploadCMOAsset(tenantId, path, file),
  });
}

// Campaign Orchestration Hooks
export const orchestrationKeys = {
  integrations: (workspaceId: string) => ["orchestration", "integrations", workspaceId] as const,
};

export function useValidateIntegrations(workspaceId: string, channels?: string[]) {
  return useQuery({
    queryKey: [...orchestrationKeys.integrations(workspaceId), channels],
    queryFn: () => cmoApi.validateIntegrations(workspaceId, channels),
    enabled: !!workspaceId && workspaceId.length >= 32, // Must be valid UUID length
    staleTime: 30000, // Cache for 30 seconds
    retry: 1, // Only retry once on failure
    retryDelay: 1000,
  });
}

export function useOrchestrateCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      campaignId, 
      action, 
      options 
    }: { 
      campaignId: string; 
      action: 'validate' | 'launch' | 'optimize' | 'pause' | 'resume';
      options?: {
        channels?: string[];
        autoCreateDeals?: boolean;
        pipelineStage?: string;
      };
    }) => cmoApi.orchestrateCampaign(campaignId, action, options),
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: cmoKeys.campaign(campaignId) });
      queryClient.invalidateQueries({ queryKey: cmoKeys.all });
    },
  });
}

export function useLaunchCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ campaignId, channels }: { campaignId: string; channels?: string[] }) => 
      cmoApi.launchCampaign(campaignId, channels),
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: cmoKeys.campaign(campaignId) });
      queryClient.invalidateQueries({ queryKey: cmoKeys.all });
    },
  });
}

export function useOptimizeCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (campaignId: string) => cmoApi.optimizeCampaign(campaignId),
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: cmoKeys.campaign(campaignId) });
      queryClient.invalidateQueries({ queryKey: cmoKeys.all });
    },
  });
}

export function usePauseCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (campaignId: string) => cmoApi.pauseCampaign(campaignId),
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: cmoKeys.campaign(campaignId) });
      queryClient.invalidateQueries({ queryKey: cmoKeys.all });
    },
  });
}

export function useResumeCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (campaignId: string) => cmoApi.resumeCampaign(campaignId),
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: cmoKeys.campaign(campaignId) });
      queryClient.invalidateQueries({ queryKey: cmoKeys.all });
    },
  });
}
