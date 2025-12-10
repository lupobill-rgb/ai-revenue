/**
 * Voice Agent Autopilot Types
 * Core type definitions for the Voice OS kernel
 */

export interface VoiceAssistant {
  id: string;
  name: string;
  firstMessage?: string;
  systemPrompt?: string;
  model?: string;
  voice?: string;
  createdAt?: string;
  tenantId?: string;
}

export interface VoicePhoneNumber {
  id: string;
  number: string;
  name: string;
  provider?: string;
}

export interface VoiceCall {
  id: string;
  type: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall';
  status: 'queued' | 'ringing' | 'in-progress' | 'ended' | 'no-answer' | 'busy' | 'failed';
  assistantId?: string;
  customer?: {
    number?: string;
    name?: string;
  };
  duration?: number;
  cost?: number;
  createdAt: string;
  endedAt?: string;
  transcript?: string;
  summary?: string;
  recordingUrl?: string;
  analysis?: CallAnalysis;
}

export interface CallAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  outcome: 'interested' | 'not_interested' | 'callback' | 'booked' | 'no_answer';
  keyPoints: string[];
  nextAction?: string;
}

export interface VoiceCampaign {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
  goal?: string;
  assistantId?: string;
  phoneNumberId?: string;
  scheduledAt?: string;
  completedAt?: string;
  config: VoiceCampaignConfig;
  stats?: VoiceCampaignStats;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  workspaceId: string;
}

export interface VoiceCampaignConfig {
  maxConcurrentCalls: number;
  maxCallsPerDay: number;
  businessHoursOnly: boolean;
  timezone: string;
  retryFailedCalls: boolean;
  maxRetries: number;
  callInterval: number; // seconds between calls
}

export interface VoiceCampaignStats {
  totalLeads: number;
  called: number;
  answered: number;
  noAnswer: number;
  interested: number;
  booked: number;
  avgDuration: number;
  totalCost: number;
}

export interface VoiceLead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  company?: string;
  status: 'pending' | 'queued' | 'calling' | 'completed' | 'failed' | 'callback';
  lastCallAt?: string;
  callAttempts: number;
  callOutcome?: CallAnalysis['outcome'];
  notes?: string;
  campaignId?: string;
}

export interface VoiceAnalytics {
  totalCalls: number;
  completedCalls: number;
  totalDurationMinutes: number;
  averageCallDuration: number;
  callsByType: Record<string, number>;
  callsByStatus: Record<string, number>;
  conversionRate: number;
  bookingRate: number;
}

// Kernel Agent Types
export interface VoiceAgentConfig {
  id: string;
  label: string;
  description: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string[];
}

export interface VoiceKernelRequest {
  mode: 'create_assistant' | 'optimize_script' | 'schedule_calls' | 'analyze_performance';
  tenantId: string;
  workspaceId: string;
  payload: Record<string, unknown>;
  context?: {
    campaignId?: string;
    assistantId?: string;
  };
}

export interface VoiceKernelResponse {
  success: boolean;
  mode: string;
  agent: string;
  runId: string;
  data?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

// Assistant Builder Types
export interface AssistantTemplate {
  id: string;
  name: string;
  description: string;
  category: 'sales' | 'support' | 'scheduling' | 'survey' | 'custom';
  systemPrompt: string;
  firstMessage: string;
  voiceId: string;
  model: string;
}

export const ASSISTANT_TEMPLATES: AssistantTemplate[] = [
  {
    id: 'sales-outreach',
    name: 'Sales Outreach',
    description: 'Warm outreach to qualified leads',
    category: 'sales',
    systemPrompt: 'You are a friendly sales representative. Your goal is to qualify interest and schedule a demo. Be conversational, not pushy.',
    firstMessage: "Hi! I'm calling from {{company}}. Do you have a quick moment to chat about how we might help with {{pain_point}}?",
    voiceId: 'alloy',
    model: 'gpt-4o',
  },
  {
    id: 'appointment-scheduler',
    name: 'Appointment Scheduler',
    description: 'Book meetings and consultations',
    category: 'scheduling',
    systemPrompt: 'You are an appointment scheduler. Help the customer find a convenient time for their consultation. Be efficient but friendly.',
    firstMessage: "Hello! I'm calling to help schedule your consultation with {{company}}. What time works best for you?",
    voiceId: 'nova',
    model: 'gpt-4o',
  },
  {
    id: 'customer-support',
    name: 'Customer Support',
    description: 'Handle inbound support calls',
    category: 'support',
    systemPrompt: 'You are a helpful customer support agent. Listen carefully, empathize, and resolve issues efficiently.',
    firstMessage: "Thank you for calling {{company}} support. How can I help you today?",
    voiceId: 'shimmer',
    model: 'gpt-4o',
  },
  {
    id: 'survey-collector',
    name: 'Survey Collector',
    description: 'Gather feedback and survey responses',
    category: 'survey',
    systemPrompt: 'You are conducting a brief customer satisfaction survey. Be friendly and keep questions short.',
    firstMessage: "Hi! I'm calling from {{company}} to get your quick feedback on your recent experience. Do you have 2 minutes?",
    voiceId: 'echo',
    model: 'gpt-4o-mini',
  },
];

export const VOICE_OPTIONS = [
  { id: 'alloy', name: 'Alloy', description: 'Neutral, professional' },
  { id: 'echo', name: 'Echo', description: 'Warm, friendly' },
  { id: 'fable', name: 'Fable', description: 'British, articulate' },
  { id: 'onyx', name: 'Onyx', description: 'Deep, authoritative' },
  { id: 'nova', name: 'Nova', description: 'Energetic, youthful' },
  { id: 'shimmer', name: 'Shimmer', description: 'Soft, empathetic' },
];

export const MODEL_OPTIONS = [
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable, best for complex conversations' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and cost-effective' },
];
