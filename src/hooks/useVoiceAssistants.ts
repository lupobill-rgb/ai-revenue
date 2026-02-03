/**
 * Voice Assistants Hook
 * Manages voice assistant state and operations
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listAssistants,
  createAssistant,
  updateAssistant,
  deleteAssistant,
  generateAssistantFromBrand,
  optimizeScript,
} from '@/lib/voice/apiClient';
import type { VoiceAssistant, VoiceCall } from '@/lib/voice/types';

export function useVoiceAssistants() {
  const queryClient = useQueryClient();

  // Fetch assistants
  const {
    data: assistants = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['voice-assistants'],
    queryFn: listAssistants,
    staleTime: 60000,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createAssistant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-assistants'] });
      toast.success('Assistant created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create assistant: ${error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VoiceAssistant> }) =>
      updateAssistant(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-assistants'] });
      toast.success('Assistant updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update assistant: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteAssistant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-assistants'] });
      toast.success('Assistant deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete assistant: ${error.message}`);
    },
  });

  // AI generation mutation
  const generateMutation = useMutation({
    mutationFn: generateAssistantFromBrand,
    onSuccess: (assistant) => {
      queryClient.invalidateQueries({ queryKey: ['voice-assistants'] });
      toast.success(`AI assistant "${assistant.name}" generated`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate assistant: ${error.message}`);
    },
  });

  // Script optimization mutation
  const optimizeMutation = useMutation({
    mutationFn: optimizeScript,
    onSuccess: (data) => {
      toast.success(`${data.suggestions.length} optimization suggestions generated`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to optimize script: ${error.message}`);
    },
  });

  // Helpers
  const create = useCallback(
    (data: Partial<VoiceAssistant>) => createMutation.mutateAsync(data),
    [createMutation]
  );

  const update = useCallback(
    (id: string, data: Partial<VoiceAssistant>) =>
      updateMutation.mutateAsync({ id, data }),
    [updateMutation]
  );

  const remove = useCallback(
    (id: string) => deleteMutation.mutateAsync(id),
    [deleteMutation]
  );

  const generateFromBrand = useCallback(
    (params: {
      tenantId: string;
      workspaceId: string;
      templateId?: string;
      customPrompt?: string;
    }) => generateMutation.mutateAsync(params),
    [generateMutation]
  );

  const optimize = useCallback(
    (params: {
      tenantId: string;
      workspaceId: string;
      assistantId: string;
      callData?: VoiceCall[];
    }) => optimizeMutation.mutateAsync(params),
    [optimizeMutation]
  );

  return {
    assistants,
    isLoading,
    error,
    refetch,
    create,
    update,
    remove,
    generateFromBrand,
    optimize,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isGenerating: generateMutation.isPending,
    isOptimizing: optimizeMutation.isPending,
  };
}
