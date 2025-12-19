/**
 * Voice Data Hook
 * Tenant-isolated voice data management: phone numbers, call records, analytics
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';

export interface VoicePhoneNumber {
  id: string;
  tenant_id: string;
  workspace_id: string;
  phone_number: string;
  display_name: string;
  provider: string;
  provider_number_id: string | null;
  is_default: boolean;
  status: string;
  created_at: string;
}

export interface VoiceCallRecord {
  id: string;
  tenant_id: string;
  workspace_id: string;
  phone_number_id: string | null;
  voice_agent_id: string | null;
  lead_id: string | null;
  campaign_id: string | null;
  provider_call_id: string | null;
  call_type: 'inbound' | 'outbound';
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'no-answer' | 'busy';
  customer_number: string | null;
  customer_name: string | null;
  duration_seconds: number;
  cost: number;
  started_at: string | null;
  ended_at: string | null;
  transcript: string | null;
  summary: string | null;
  recording_url: string | null;
  outcome: string | null;
  failure_reason: string | null;
  analysis: {
    sentiment?: string;
    keyPoints?: string[];
    nextAction?: string;
  };
  created_at: string;
}

export interface VoiceAnalytics {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  noAnswerCalls: number;
  totalDurationMinutes: number;
  averageCallDuration: number;
  callsByType: Record<string, number>;
  callsByStatus: Record<string, number>;
  callsByOutcome: Record<string, number>;
}

interface UseVoiceDataOptions {
  timeframeDays?: number;
}

export function useVoiceData(options: UseVoiceDataOptions = {}) {
  const { timeframeDays = 30 } = options;
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Fetch tenant ID for the current user
  useEffect(() => {
    async function fetchTenantId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('user_tenants')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.tenant_id) setTenantId(data.tenant_id);
    }
    fetchTenantId();
  }, []);

  // Fetch tenant phone numbers
  const {
    data: phoneNumbers = [],
    isLoading: isLoadingNumbers,
    error: numbersError,
    refetch: refetchNumbers,
  } = useQuery({
    queryKey: ['voice-phone-numbers', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('voice_phone_numbers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as VoicePhoneNumber[];
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  // Fetch call records with timeframe filter
  const startDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - timeframeDays);
    return date.toISOString();
  }, [timeframeDays]);

  const {
    data: callRecords = [],
    isLoading: isLoadingCalls,
    error: callsError,
    refetch: refetchCalls,
  } = useQuery({
    queryKey: ['voice-call-records', tenantId, timeframeDays],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('voice_call_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as VoiceCallRecord[];
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });

  // Calculate analytics from call records
  const analytics: VoiceAnalytics = useMemo(() => {
    if (callRecords.length === 0) {
      return {
        totalCalls: 0,
        completedCalls: 0,
        failedCalls: 0,
        noAnswerCalls: 0,
        totalDurationMinutes: 0,
        averageCallDuration: 0,
        callsByType: {},
        callsByStatus: {},
        callsByOutcome: {},
      };
    }

    const completed = callRecords.filter(c => c.status === 'completed');
    const failed = callRecords.filter(c => c.status === 'failed');
    const noAnswer = callRecords.filter(c => c.status === 'no-answer');
    const totalDuration = callRecords.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);

    const callsByType: Record<string, number> = {};
    const callsByStatus: Record<string, number> = {};
    const callsByOutcome: Record<string, number> = {};

    callRecords.forEach(call => {
      callsByType[call.call_type] = (callsByType[call.call_type] || 0) + 1;
      callsByStatus[call.status] = (callsByStatus[call.status] || 0) + 1;
      if (call.outcome) {
        callsByOutcome[call.outcome] = (callsByOutcome[call.outcome] || 0) + 1;
      }
    });

    return {
      totalCalls: callRecords.length,
      completedCalls: completed.length,
      failedCalls: failed.length,
      noAnswerCalls: noAnswer.length,
      totalDurationMinutes: Math.round(totalDuration / 60),
      averageCallDuration: callRecords.length > 0 ? Math.round(totalDuration / callRecords.length) : 0,
      callsByType,
      callsByStatus,
      callsByOutcome,
    };
  }, [callRecords]);

  // Add phone number mutation
  const addNumberMutation = useMutation({
    mutationFn: async (data: { phone_number: string; display_name: string; provider?: string }) => {
      if (!tenantId || !workspaceId) throw new Error('No tenant/workspace');
      const { data: result, error } = await supabase
        .from('voice_phone_numbers')
        .insert({
          tenant_id: tenantId,
          workspace_id: workspaceId,
          phone_number: data.phone_number,
          display_name: data.display_name,
          provider: data.provider || 'vapi',
          is_default: phoneNumbers.length === 0,
          status: 'active',
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-phone-numbers', tenantId] });
      toast.success('Phone number added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add number: ${error.message}`);
    },
  });

  // Create call record mutation
  const createCallRecordMutation = useMutation({
    mutationFn: async (data: Partial<VoiceCallRecord>) => {
      if (!tenantId || !workspaceId) throw new Error('No tenant/workspace');
      const { data: result, error } = await supabase
        .from('voice_call_records')
        .insert({
          tenant_id: tenantId,
          workspace_id: workspaceId,
          ...data,
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-call-records', tenantId] });
    },
    onError: (error: Error) => {
      console.error('Failed to create call record:', error);
    },
  });

  // Update call record mutation
  const updateCallRecordMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<VoiceCallRecord> }) => {
      const { data: result, error } = await supabase
        .from('voice_call_records')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-call-records', tenantId] });
    },
  });

  // Helper to check if voice is set up
  const isVoiceConfigured = phoneNumbers.length > 0;
  const defaultPhoneNumber = phoneNumbers.find(p => p.is_default) || phoneNumbers[0];

  return {
    // Data
    phoneNumbers,
    callRecords,
    analytics,
    
    // Loading states
    isLoading: isLoadingNumbers || isLoadingCalls,
    isLoadingNumbers,
    isLoadingCalls,
    
    // Errors
    error: numbersError || callsError,
    
    // Refetch functions
    refetchNumbers,
    refetchCalls,
    refetchAll: useCallback(() => {
      refetchNumbers();
      refetchCalls();
    }, [refetchNumbers, refetchCalls]),
    
    // Mutations
    addPhoneNumber: addNumberMutation.mutateAsync,
    createCallRecord: createCallRecordMutation.mutateAsync,
    updateCallRecord: updateCallRecordMutation.mutateAsync,
    
    // State flags
    isVoiceConfigured,
    defaultPhoneNumber,
    
    // Mutation loading states
    isAddingNumber: addNumberMutation.isPending,
    isCreatingCall: createCallRecordMutation.isPending,
  };
}
