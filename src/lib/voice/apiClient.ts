/**
 * Voice Agent API Client
 * Centralized API calls for Voice OS
 */

import { supabase } from '@/integrations/supabase/client';
import { invokeEdge } from '@/lib/edgeInvoke';
import type {
  VoiceAssistant,
  VoicePhoneNumber,
  VoiceCall,
  VoiceCampaign,
  VoiceAnalytics,
  VoiceKernelRequest,
  VoiceKernelResponse,
} from './types';

// Assistant APIs
export async function listAssistants(workspaceId: string): Promise<VoiceAssistant[]> {
  const data = await invokeEdge<any>('elevenlabs-list-agents', { workspace_id: workspaceId });
  const agents = data?.agents || [];
  return agents.map((a: any) => ({
    id: a.id || a.agent_id,
    name: a.name || 'Unnamed Agent',
    firstMessage: a.first_message || '',
    model: 'elevenlabs',
    voice: 'elevenlabs',
    createdAt: a.created_at || new Date().toISOString(),
  }));
}

export async function createAssistant(assistantData: Partial<VoiceAssistant>): Promise<VoiceAssistant> {
  // ElevenLabs agent creation is supported via edge function.
  // Note: ElevenLabs uses different fields; we accept name and workspace_id only.
  const data = await invokeEdge<any>('elevenlabs-create-agent', {
    name: assistantData.name,
    workspace_id: (assistantData as any).workspaceId,
    use_case: (assistantData as any).use_case || 'sales_outreach',
  });
  if (!data?.success) throw new Error(data?.error || 'Failed to create ElevenLabs agent');
  return {
    id: data.agent_id,
    name: data.name || assistantData.name || 'AI Voice Agent',
    model: 'elevenlabs',
    voice: 'elevenlabs',
  } as VoiceAssistant;
}

export async function updateAssistant(
  assistantId: string,
  assistantData: Partial<VoiceAssistant>
): Promise<VoiceAssistant> {
  // Not implemented: no ElevenLabs update edge function currently.
  throw new Error('Updating ElevenLabs agents is not supported in-app yet.');
}

export async function deleteAssistant(assistantId: string): Promise<void> {
  // Not implemented: no ElevenLabs delete edge function currently.
  throw new Error('Deleting ElevenLabs agents is not supported in-app yet.');
}

// Phone Number APIs
export async function listPhoneNumbers(): Promise<VoicePhoneNumber[]> {
  // ElevenLabs phone calling does not require selecting a provider phone number here.
  return [];
}

// Call APIs
export async function listCalls(options?: {
  limit?: number;
  assistantId?: string;
}): Promise<VoiceCall[]> {
  // TODO: Implement ElevenLabs call history via DB tables (channel_outbox / voice_call_records).
  // For now, return empty list.
  return [];
}

export async function initiateCall(params: {
  assistantId: string;
  phoneNumberId?: string;
  customerNumber: string;
  customerName?: string;
  leadId?: string;
  workspaceId: string;
}): Promise<VoiceCall> {
  const data = await invokeEdge<any>('elevenlabs-make-call', {
    agent_id: params.assistantId,
    phone_number: params.customerNumber,
    workspace_id: params.workspaceId,
    lead_data: {
      id: params.leadId,
      name: params.customerName,
    },
  });
  if (!data?.success) throw new Error(data?.error || 'Failed to initiate call');
  return {
    id: data.conversation_id,
    type: 'outboundPhoneCall',
    status: data.status || 'queued',
    assistantId: params.assistantId,
    customer: { number: params.customerNumber, name: params.customerName },
    createdAt: data.timestamp,
  } as any;
}

// Analytics APIs
export async function getAnalytics(): Promise<VoiceAnalytics> {
  // TODO: compute from persisted outbox/call records
  return {
    totalCalls: 0,
    completedCalls: 0,
    totalDurationMinutes: 0,
    averageCallDuration: 0,
    callsByType: {},
    callsByStatus: {},
    conversionRate: 0,
    bookingRate: 0,
  } as any;
}

// Campaign APIs
export async function listCampaigns(workspaceId: string): Promise<VoiceCampaign[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('type', 'voice')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((asset) => ({
    id: asset.id,
    name: asset.name,
    status: asset.status as VoiceCampaign['status'],
    goal: asset.goal,
    assistantId: null,
    config: (asset.content as any)?.config || {
      maxConcurrentCalls: 1,
      maxCallsPerDay: 100,
      businessHoursOnly: true,
      timezone: 'America/New_York',
      retryFailedCalls: true,
      maxRetries: 2,
      callInterval: 30,
    },
    stats: (asset.content as any)?.stats,
    createdAt: asset.created_at,
    updatedAt: asset.updated_at,
    tenantId: asset.created_by || '',
    workspaceId: asset.workspace_id || '',
  }));
}

export async function createCampaign(
  campaign: Omit<VoiceCampaign, 'id' | 'createdAt' | 'updatedAt'>
): Promise<VoiceCampaign> {
  const { data, error } = await supabase
    .from('assets')
    .insert([{
      name: campaign.name,
      type: 'voice' as const,
      status: 'draft' as const,
      goal: campaign.goal || null,
      vapi_id: null,
      workspace_id: campaign.workspaceId,
      created_by: campaign.tenantId,
      content: JSON.parse(JSON.stringify({
        config: campaign.config,
        stats: campaign.stats,
        phoneNumberId: campaign.phoneNumberId,
      })),
    }])
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    status: data.status as VoiceCampaign['status'],
    goal: data.goal,
    assistantId: null,
    config: (data.content as any)?.config,
    stats: (data.content as any)?.stats,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    tenantId: data.created_by || '',
    workspaceId: data.workspace_id || '',
  };
}

export async function updateCampaign(
  id: string,
  updates: Partial<VoiceCampaign>
): Promise<VoiceCampaign> {
  const updateData: any = {};
  if (updates.name) updateData.name = updates.name;
  if (updates.status) updateData.status = updates.status;
  if (updates.goal) updateData.goal = updates.goal;
  if (updates.assistantId) updateData.vapi_id = updates.assistantId;
  if (updates.config || updates.stats) {
    updateData.content = {
      config: updates.config,
      stats: updates.stats,
    };
  }

  const { data, error } = await supabase
    .from('assets')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    status: data.status as VoiceCampaign['status'],
    goal: data.goal,
    assistantId: null,
    config: (data.content as any)?.config,
    stats: (data.content as any)?.stats,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    tenantId: data.created_by || '',
    workspaceId: data.workspace_id || '',
  };
}

export async function executeCampaign(params: {
  campaignId: string;
  assistantId: string;
  phoneNumberId?: string;
  leadIds: string[];
}): Promise<{ success: boolean; results: any[] }> {
  const { data, error } = await supabase.functions.invoke('execute-voice-campaign', {
    body: params,
  });
  if (error) throw error;
  return data;
}

// Kernel/AI APIs
export async function runVoiceKernel(
  request: VoiceKernelRequest
): Promise<VoiceKernelResponse> {
  const { data, error } = await supabase.functions.invoke('voice-kernel', {
    body: request,
  });
  if (error) {
    return {
      success: false,
      mode: request.mode,
      agent: 'voice-kernel',
      runId: '',
      error: error.message,
    };
  }
  return data;
}

// AI-powered assistant generation
export async function generateAssistantFromBrand(params: {
  tenantId: string;
  workspaceId: string;
  templateId?: string;
  customPrompt?: string;
}): Promise<VoiceAssistant> {
  const response = await runVoiceKernel({
    mode: 'create_assistant',
    tenantId: params.tenantId,
    workspaceId: params.workspaceId,
    payload: {
      templateId: params.templateId,
      customPrompt: params.customPrompt,
    },
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to generate assistant');
  }

  return response.data?.assistant as VoiceAssistant;
}

// AI-powered script optimization
export async function optimizeScript(params: {
  tenantId: string;
  workspaceId: string;
  assistantId: string;
  callData?: VoiceCall[];
}): Promise<{ suggestions: string[]; updatedPrompt?: string }> {
  const response = await runVoiceKernel({
    mode: 'optimize_script',
    tenantId: params.tenantId,
    workspaceId: params.workspaceId,
    payload: {
      callData: params.callData,
    },
    context: {
      assistantId: params.assistantId,
    },
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to optimize script');
  }

  return response.data as { suggestions: string[]; updatedPrompt?: string };
}
