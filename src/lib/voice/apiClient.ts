/**
 * Voice Agent API Client
 * Centralized API calls for Voice OS
 */

import { supabase } from '@/integrations/supabase/client';
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
export async function listAssistants(): Promise<VoiceAssistant[]> {
  const { data, error } = await supabase
    .from('voice_agents')
    .select('agent_id, name, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((agent: any) => ({
    id: agent.agent_id,
    name: agent.name || 'Unnamed Agent',
    createdAt: agent.created_at,
  }));
}

export async function createAssistant(assistantData: Partial<VoiceAssistant>): Promise<VoiceAssistant> {
  const { data, error } = await supabase.functions.invoke('elevenlabs-create-agent', {
    body: {
      name: assistantData.name,
      first_message: assistantData.firstMessage,
      system_prompt: assistantData.systemPrompt,
      voice_id: assistantData.voice,
      tenant_id: assistantData.tenantId,
    },
  });
  if (error) throw error;
  return {
    id: data?.agent_id || data?.agent?.agent_id,
    name: assistantData.name || 'Unnamed Agent',
  };
}

export async function updateAssistant(
  assistantId: string,
  assistantData: Partial<VoiceAssistant>
): Promise<VoiceAssistant> {
  throw new Error('Updating assistants is managed in ElevenLabs.');
}

export async function deleteAssistant(assistantId: string): Promise<void> {
  throw new Error('Deleting assistants is managed in ElevenLabs.');
}

// Phone Number APIs
export async function listPhoneNumbers(): Promise<VoicePhoneNumber[]> {
  const { data, error } = await supabase
    .from('voice_phone_numbers')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Call APIs
export async function listCalls(options?: {
  limit?: number;
  assistantId?: string;
}): Promise<VoiceCall[]> {
  const { data, error } = await supabase
    .from('voice_call_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 50);
  if (error) throw error;
  return data || [];
}

export async function initiateCall(params: {
  assistantId: string;
  phoneNumberId?: string;
  customerNumber: string;
  customerName?: string;
  leadId?: string;
}): Promise<VoiceCall> {
  const { data, error } = await supabase.functions.invoke('elevenlabs-make-call', {
    body: {
      agent_id: params.assistantId,
      phone_number: params.customerNumber,
      lead_data: {
        id: params.leadId,
        name: params.customerName,
      },
    },
  });
  if (error) throw error;
  if (!data) {
    throw new Error("ElevenLabs call did not return data");
  }

  return {
    id: data.conversation_id || data.id || "",
    tenant_id: "",
    workspace_id: "",
    phone_number_id: params.phoneNumberId || null,
    voice_agent_id: params.assistantId,
    lead_id: params.leadId || null,
    campaign_id: null,
    provider_call_id: data.conversation_id || null,
    call_type: "outbound",
    status: data.status || "queued",
    customer_number: data.phone_number || params.customerNumber,
    customer_name: params.customerName || null,
    duration_seconds: 0,
    cost: 0,
    started_at: data.timestamp || null,
    ended_at: null,
    transcript: null,
    summary: null,
    recording_url: null,
    outcome: null,
    failure_reason: null,
    analysis: {},
    created_at: data.timestamp || new Date().toISOString(),
  } as VoiceCall;
}

// Analytics APIs
export async function getAnalytics(): Promise<VoiceAnalytics> {
  const { data, error } = await supabase
    .from('voice_call_records')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const calls = data || [];
  const completed = calls.filter((c: any) => c.status === 'completed');
  const failed = calls.filter((c: any) => c.status === 'failed');
  const noAnswer = calls.filter((c: any) => c.status === 'no-answer');
  const totalDuration = calls.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0);
  return {
    totalCalls: calls.length,
    completedCalls: completed.length,
    failedCalls: failed.length,
    noAnswerCalls: noAnswer.length,
    totalDurationMinutes: Math.round(totalDuration / 60),
    averageCallDuration: calls.length > 0 ? Math.round(totalDuration / calls.length) : 0,
    callsByType: {},
    callsByStatus: {},
    callsByOutcome: {},
  };
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
    assistantId: (asset.content as any)?.assistantId || null,
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
      content: JSON.parse(JSON.stringify({
        config: campaign.config,
        stats: campaign.stats,
        phoneNumberId: campaign.phoneNumberId,
        assistantId: campaign.assistantId,
      })),
      workspace_id: campaign.workspaceId,
      created_by: campaign.tenantId,
    }])
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    status: data.status as VoiceCampaign['status'],
    goal: data.goal,
    assistantId: (data.content as any)?.assistantId || null,
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
  if (updates.assistantId) {
    updateData.content = {
      ...(updateData.content || {}),
      assistantId: updates.assistantId,
    };
  }
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
    assistantId: (data.content as any)?.assistantId || null,
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
