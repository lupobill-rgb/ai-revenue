// CMO Optimistic Update Hooks - CRUD operations with instant UI feedback

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cmoKeys } from "./useCMO";
import * as cmoApi from "@/lib/cmo/api";
import type {
  CMOCampaign,
  CMOContentAsset,
  CMOFunnel,
  CMOMarketingPlan,
  CMORecommendation,
} from "@/lib/cmo/types";
import { toast } from "@/hooks/use-toast";

// Generic optimistic update helper
function createOptimisticMutation<T extends { id: string }, TInput>({
  queryKey,
  mutationFn,
  getOptimisticData,
  successMessage,
  errorMessage,
}: {
  queryKey: readonly unknown[];
  mutationFn: (input: TInput) => Promise<T>;
  getOptimisticData: (input: TInput, previousData: T[] | undefined) => T[];
  successMessage: string;
  errorMessage: string;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (input) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<T[]>(queryKey);

      // Optimistically update
      queryClient.setQueryData<T[]>(queryKey, (old) => getOptimisticData(input, old));

      return { previousData };
    },
    onError: (err, _input, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast({
        title: errorMessage,
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({ title: successMessage });
    },
    onSettled: () => {
      // Refetch to ensure server state
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// Campaign CRUD with optimistic updates
export function useCreateCampaignOptimistic(workspaceId: string) {
  const queryClient = useQueryClient();
  const queryKey = cmoKeys.campaigns(workspaceId);

  return useMutation({
    mutationFn: async (campaign: Partial<CMOCampaign>) => {
      const response = await cmoApi.invokeCMOKernel("launch-campaign", {
        workspace_id: workspaceId,
        campaign,
      });
      return response.data as CMOCampaign;
    },
    onMutate: async (newCampaign) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<CMOCampaign[]>(queryKey);

      // Create optimistic campaign
      const optimisticCampaign: CMOCampaign = {
        id: `temp-${Date.now()}`,
        tenant_id: "",
        workspace_id: workspaceId,
        campaign_name: newCampaign.campaign_name || "New Campaign",
        campaign_type: newCampaign.campaign_type || "awareness",
        status: "draft",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...newCampaign,
      };

      queryClient.setQueryData<CMOCampaign[]>(queryKey, (old = []) => [
        optimisticCampaign,
        ...old,
      ]);

      return { previousData };
    },
    onError: (err, _input, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast({
        title: "Failed to create campaign",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({ title: "Campaign created successfully" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useUpdateCampaignOptimistic(workspaceId: string) {
  const queryClient = useQueryClient();
  const queryKey = cmoKeys.campaigns(workspaceId);

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CMOCampaign> }) => {
      const response = await cmoApi.invokeCMOKernel("update-campaign", {
        workspace_id: workspaceId,
        campaign_id: id,
        updates,
      });
      return response.data as CMOCampaign;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<CMOCampaign[]>(queryKey);

      queryClient.setQueryData<CMOCampaign[]>(queryKey, (old = []) =>
        old.map((campaign) =>
          campaign.id === id
            ? { ...campaign, ...updates, updated_at: new Date().toISOString() }
            : campaign
        )
      );

      return { previousData };
    },
    onError: (err, _input, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast({
        title: "Failed to update campaign",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({ title: "Campaign updated" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useDeleteCampaignOptimistic(workspaceId: string) {
  const queryClient = useQueryClient();
  const queryKey = cmoKeys.campaigns(workspaceId);

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await cmoApi.invokeCMOKernel("delete-campaign", {
        workspace_id: workspaceId,
        campaign_id: campaignId,
      });
      return response;
    },
    onMutate: async (campaignId) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<CMOCampaign[]>(queryKey);

      queryClient.setQueryData<CMOCampaign[]>(queryKey, (old = []) =>
        old.filter((campaign) => campaign.id !== campaignId)
      );

      return { previousData };
    },
    onError: (err, _input, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast({
        title: "Failed to delete campaign",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({ title: "Campaign deleted" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// Content Asset CRUD with optimistic updates
export function useCreateContentOptimistic(workspaceId: string) {
  const queryClient = useQueryClient();
  const queryKey = cmoKeys.contentAssets(workspaceId);

  return useMutation({
    mutationFn: async (asset: Partial<CMOContentAsset>) => {
      const response = await cmoApi.invokeCMOKernel("generate-content", {
        workspace_id: workspaceId,
        asset,
      });
      return response.data as CMOContentAsset;
    },
    onMutate: async (newAsset) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<CMOContentAsset[]>(queryKey);

      const optimisticAsset: CMOContentAsset = {
        id: `temp-${Date.now()}`,
        tenant_id: "",
        workspace_id: workspaceId,
        title: newAsset.title || "New Content",
        content_type: newAsset.content_type || "post",
        status: "generating",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...newAsset,
      };

      queryClient.setQueryData<CMOContentAsset[]>(queryKey, (old = []) => [
        optimisticAsset,
        ...old,
      ]);

      return { previousData };
    },
    onError: (err, _input, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast({
        title: "Failed to create content",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({ title: "Content generated successfully" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useUpdateContentOptimistic(workspaceId: string) {
  const queryClient = useQueryClient();
  const queryKey = cmoKeys.contentAssets(workspaceId);

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CMOContentAsset> }) => {
      const response = await cmoApi.invokeCMOKernel("update-content", {
        workspace_id: workspaceId,
        asset_id: id,
        updates,
      });
      return response.data as CMOContentAsset;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<CMOContentAsset[]>(queryKey);

      queryClient.setQueryData<CMOContentAsset[]>(queryKey, (old = []) =>
        old.map((asset) =>
          asset.id === id
            ? { ...asset, ...updates, updated_at: new Date().toISOString() }
            : asset
        )
      );

      return { previousData };
    },
    onError: (err, _input, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast({
        title: "Failed to update content",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({ title: "Content updated" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// Recommendation status update with optimistic UI
export function useUpdateRecommendationOptimistic(workspaceId: string) {
  const queryClient = useQueryClient();
  const queryKey = cmoKeys.recommendations(workspaceId);

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return cmoApi.updateRecommendationStatus(id, status);
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<CMORecommendation[]>(queryKey);

      queryClient.setQueryData<CMORecommendation[]>(queryKey, (old = []) =>
        old.map((rec) =>
          rec.id === id
            ? {
                ...rec,
                status,
                implemented_at: status === "implemented" ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
              }
            : rec
        )
      );

      return { previousData };
    },
    onError: (err, _input, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast({
        title: "Failed to update recommendation",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    },
    onSuccess: (_, { status }) => {
      toast({
        title: status === "implemented" ? "Recommendation implemented" : "Status updated",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
