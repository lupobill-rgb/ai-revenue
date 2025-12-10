/**
 * Voice Analytics Hook
 * Manages call analytics and metrics
 */

import { useQuery } from '@tanstack/react-query';
import { getAnalytics, listCalls } from '@/lib/voice/apiClient';
import type { VoiceAnalytics, VoiceCall } from '@/lib/voice/types';

export function useVoiceAnalytics(options?: { assistantId?: string; limit?: number }) {
  // Fetch analytics
  const analyticsQuery = useQuery({
    queryKey: ['voice-analytics'],
    queryFn: getAnalytics,
    staleTime: 60000,
  });

  // Fetch calls
  const callsQuery = useQuery({
    queryKey: ['voice-calls', options?.assistantId, options?.limit],
    queryFn: () =>
      listCalls({
        assistantId: options?.assistantId,
        limit: options?.limit || 100,
      }),
    staleTime: 30000,
  });

  return {
    analytics: analyticsQuery.data,
    calls: callsQuery.data || [],
    isLoading: analyticsQuery.isLoading || callsQuery.isLoading,
    error: analyticsQuery.error || callsQuery.error,
    refetchAnalytics: analyticsQuery.refetch,
    refetchCalls: callsQuery.refetch,
  };
}

// Sample data for demo mode
export const SAMPLE_ANALYTICS: VoiceAnalytics = {
  totalCalls: 156,
  completedCalls: 128,
  totalDurationMinutes: 892,
  averageCallDuration: 185,
  callsByType: { outboundPhoneCall: 98, inboundPhoneCall: 58 },
  callsByStatus: { ended: 128, 'no-answer': 18, busy: 6, failed: 4 },
  conversionRate: 0.32,
  bookingRate: 0.18,
};

export const SAMPLE_CALLS: VoiceCall[] = [
  {
    id: 'call-1',
    type: 'outboundPhoneCall',
    status: 'ended',
    assistantId: 'asst-1',
    customer: { number: '+1-555-0101', name: 'Sarah Johnson' },
    duration: 245,
    cost: 0.12,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    transcript: 'Agent: Hi! I\'m calling from your marketing platform...',
    summary: 'Lead was interested in premium features. Scheduled demo for next week.',
    analysis: {
      sentiment: 'positive',
      outcome: 'booked',
      keyPoints: ['Interested in premium features', 'Budget approved', 'Demo scheduled'],
      nextAction: 'Send calendar invite',
    },
  },
  {
    id: 'call-2',
    type: 'outboundPhoneCall',
    status: 'ended',
    assistantId: 'asst-1',
    customer: { number: '+1-555-0102', name: 'Michael Chen' },
    duration: 180,
    cost: 0.09,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    transcript: 'Agent: Hello! Do you have a moment to discuss...',
    summary: 'Contact requested callback next month.',
    analysis: {
      sentiment: 'neutral',
      outcome: 'callback',
      keyPoints: ['Currently evaluating options', 'Budget review in Q1'],
      nextAction: 'Schedule follow-up for January',
    },
  },
  {
    id: 'call-3',
    type: 'inboundPhoneCall',
    status: 'ended',
    assistantId: 'asst-2',
    customer: { number: '+1-555-0103', name: 'Emily Rodriguez' },
    duration: 320,
    cost: 0.16,
    createdAt: new Date(Date.now() - 14400000).toISOString(),
    transcript: 'Customer: Hi, I need help with my account...',
    summary: 'Resolved billing inquiry successfully.',
    analysis: {
      sentiment: 'positive',
      outcome: 'interested',
      keyPoints: ['Billing issue resolved', 'Interested in upgrade'],
    },
  },
  {
    id: 'call-4',
    type: 'outboundPhoneCall',
    status: 'no-answer',
    assistantId: 'asst-1',
    customer: { number: '+1-555-0104', name: 'David Thompson' },
    duration: 0,
    cost: 0.01,
    createdAt: new Date(Date.now() - 21600000).toISOString(),
    analysis: {
      sentiment: 'neutral',
      outcome: 'no_answer',
      keyPoints: [],
      nextAction: 'Retry tomorrow',
    },
  },
  {
    id: 'call-5',
    type: 'inboundPhoneCall',
    status: 'ended',
    assistantId: 'asst-3',
    customer: { number: '+1-555-0105', name: 'Jennifer Martinez' },
    duration: 420,
    cost: 0.21,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    transcript: 'Customer: I\'d like to schedule a consultation...',
    summary: 'Appointment booked for Thursday at 2pm.',
    analysis: {
      sentiment: 'positive',
      outcome: 'booked',
      keyPoints: ['Consultation scheduled', 'High intent buyer'],
    },
  },
];
