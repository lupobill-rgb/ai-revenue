/**
 * Voice Campaigns Hook
 * Manages voice campaign state and operations
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  executeCampaign,
} from '@/lib/voice/apiClient';
import type { VoiceCampaign, VoiceCampaignConfig } from '@/lib/voice/types';

const DEFAULT_CONFIG: VoiceCampaignConfig = {
  maxConcurrentCalls: 1,
  maxCallsPerDay: 100,
  businessHoursOnly: true,
  timezone: 'America/New_York',
  retryFailedCalls: true,
  maxRetries: 2,
  callInterval: 30,
};

export function useVoiceCampaigns(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch campaigns
  const {
    data: campaigns = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['voice-campaigns', workspaceId],
    queryFn: () => (workspaceId ? listCampaigns(workspaceId) : Promise.resolve([])),
    enabled: !!workspaceId,
    staleTime: 30000,
  });

  // Create campaign mutation
  const createMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-campaigns', workspaceId] });
      toast.success('Voice campaign created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create campaign: ${error.message}`);
    },
  });

  // Update campaign mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<VoiceCampaign> }) =>
      updateCampaign(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-campaigns', workspaceId] });
      toast.success('Campaign updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update campaign: ${error.message}`);
    },
  });

  // Execute campaign mutation
  const executeMutation = useMutation({
    mutationFn: executeCampaign,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['voice-campaigns', workspaceId] });
      toast.success(`Campaign started: ${data.results.length} calls queued`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to execute campaign: ${error.message}`);
    },
  });

  // Helpers
  const createNewCampaign = useCallback(
    async (params: {
      name: string;
      goal?: string;
      assistantId?: string;
      phoneNumberId?: string;
      tenantId: string;
      config?: Partial<VoiceCampaignConfig>;
    }) => {
      if (!workspaceId) throw new Error('No workspace selected');

      return createMutation.mutateAsync({
        name: params.name,
        status: 'draft',
        goal: params.goal,
        assistantId: params.assistantId,
        phoneNumberId: params.phoneNumberId,
        config: { ...DEFAULT_CONFIG, ...params.config },
        tenantId: params.tenantId,
        workspaceId,
      });
    },
    [workspaceId, createMutation]
  );

  const startCampaign = useCallback(
    async (campaignId: string, assistantId: string, phoneNumberId: string, leadIds: string[]) => {
      // First update status to active
      await updateMutation.mutateAsync({
        id: campaignId,
        updates: { status: 'active' },
      });

      // Then execute
      return executeMutation.mutateAsync({
        campaignId,
        assistantId,
        phoneNumberId,
        leadIds,
      });
    },
    [updateMutation, executeMutation]
  );

  const pauseCampaign = useCallback(
    (campaignId: string) => {
      return updateMutation.mutateAsync({
        id: campaignId,
        updates: { status: 'paused' },
      });
    },
    [updateMutation]
  );

  const completeCampaign = useCallback(
    (campaignId: string) => {
      return updateMutation.mutateAsync({
        id: campaignId,
        updates: { status: 'completed' },
      });
    },
    [updateMutation]
  );

  return {
    campaigns,
    isLoading,
    error,
    refetch,
    createCampaign: createNewCampaign,
    updateCampaign: updateMutation.mutateAsync,
    startCampaign,
    pauseCampaign,
    completeCampaign,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isExecuting: executeMutation.isPending,
  };
}
