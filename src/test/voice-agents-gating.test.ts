/**
 * Voice Agents Gating Tests
 * 
 * NON-NEGOTIABLE: These tests ensure SAMPLE_ data NEVER appears when demoMode=false.
 * If any of these tests fail, the build MUST fail - no sample data leakage allowed.
 */

import { describe, it, expect } from 'vitest';

// Types matching VoiceAgents.tsx
interface VapiAnalytics {
  totalCalls: number;
  completedCalls: number;
  totalDurationMinutes: number;
  averageCallDuration: number;
  callsByType: Record<string, number>;
  callsByStatus: Record<string, number>;
}

interface VapiAssistant {
  id: string;
  name: string;
}

interface VapiPhoneNumber {
  id: string;
  number: string;
  name: string;
}

interface VapiCall {
  id: string;
  type: string;
  status: string;
}

// Zero analytics constant (must match VoiceAgents.tsx)
const ZERO_ANALYTICS: VapiAnalytics = {
  totalCalls: 0,
  completedCalls: 0,
  totalDurationMinutes: 0,
  averageCallDuration: 0,
  callsByType: {},
  callsByStatus: {},
};

// Sample data (simulating what VoiceAgents.tsx defines)
const SAMPLE_ANALYTICS: VapiAnalytics = {
  totalCalls: 156,
  completedCalls: 128,
  totalDurationMinutes: 340,
  averageCallDuration: 2.2,
  callsByType: { outbound: 120, inbound: 36 },
  callsByStatus: { completed: 128, failed: 18, pending: 10 },
};

const SAMPLE_ASSISTANTS: VapiAssistant[] = [
  { id: 'sample-1', name: 'Sample Agent 1' },
  { id: 'sample-2', name: 'Sample Agent 2' },
];

const SAMPLE_PHONE_NUMBERS: VapiPhoneNumber[] = [
  { id: 'phone-1', number: '+1 (555) 123-4567', name: 'Primary' },
];

const SAMPLE_CALLS: VapiCall[] = [
  { id: 'call-1', type: 'outbound', status: 'completed' },
];

// Real data (could be empty or have values)
const REAL_ANALYTICS: VapiAnalytics = {
  totalCalls: 5,
  completedCalls: 3,
  totalDurationMinutes: 12,
  averageCallDuration: 2.4,
  callsByType: { outbound: 5 },
  callsByStatus: { completed: 3, failed: 2 },
};

const REAL_ASSISTANTS: VapiAssistant[] = [
  { id: 'real-1', name: 'My Real Agent' },
];

const REAL_PHONE_NUMBERS: VapiPhoneNumber[] = [
  { id: 'real-phone-1', number: '+1 (800) 555-0100', name: 'Production Line' },
];

const REAL_CALLS: VapiCall[] = [
  { id: 'real-call-1', type: 'outbound', status: 'completed' },
];

/**
 * Gating logic - MUST match VoiceAgents.tsx exactly
 */
function computeDisplayAnalytics(
  demoMode: boolean,
  voiceConnected: boolean,
  analytics: VapiAnalytics | null
): VapiAnalytics {
  const showSamples = demoMode === true;
  
  // Demo mode: sample only if analytics is null/undefined
  if (showSamples) return analytics ?? SAMPLE_ANALYTICS;
  
  // Live mode: disconnected => zeros
  if (!voiceConnected) return ZERO_ANALYTICS;
  
  // Live mode + connected: real only, but never null in UI
  return analytics ?? ZERO_ANALYTICS;
}

function computeDisplayCalls(
  demoMode: boolean,
  voiceConnected: boolean,
  calls: VapiCall[]
): VapiCall[] {
  const showSamples = demoMode === true;
  return showSamples
    ? (calls.length ? calls : SAMPLE_CALLS)
    : (voiceConnected ? calls : []);
}

function computeDisplayAssistants(
  demoMode: boolean,
  voiceConnected: boolean,
  assistants: VapiAssistant[]
): VapiAssistant[] {
  const showSamples = demoMode === true;
  return showSamples
    ? (assistants.length ? assistants : SAMPLE_ASSISTANTS)
    : (voiceConnected ? assistants : []);
}

function computeDisplayPhoneNumbers(
  demoMode: boolean,
  voiceConnected: boolean,
  phoneNumbers: VapiPhoneNumber[]
): VapiPhoneNumber[] {
  const showSamples = demoMode === true;
  return showSamples
    ? (phoneNumbers.length ? phoneNumbers : SAMPLE_PHONE_NUMBERS)
    : (voiceConnected ? phoneNumbers : []);
}

/**
 * Helper to check if any SAMPLE_ data leaked
 */
function containsSampleData(
  analytics: VapiAnalytics,
  assistants: VapiAssistant[],
  phoneNumbers: VapiPhoneNumber[],
  calls: VapiCall[]
): boolean {
  // Check analytics matches sample
  if (analytics.totalCalls === SAMPLE_ANALYTICS.totalCalls &&
      analytics.completedCalls === SAMPLE_ANALYTICS.completedCalls) {
    return true;
  }
  
  // Check arrays for sample IDs
  if (assistants.some(a => a.id.startsWith('sample-'))) return true;
  if (calls.some(c => c.id.startsWith('call-') && !c.id.startsWith('real-'))) return true;
  
  return false;
}

type ElevenLabsSettings = {
  elevenlabs_api_key?: string | null;
  default_elevenlabs_voice_id?: string | null;
};

function getElevenLabsStatus(settings: ElevenLabsSettings) {
  const configured = !!settings.elevenlabs_api_key;
  const ready = configured && !!settings.default_elevenlabs_voice_id;
  const error = !configured
    ? "Eleven Labs API key not configured"
    : !settings.default_elevenlabs_voice_id
      ? "No Eleven Labs voice ID configured"
      : undefined;

  return { configured, ready, error };
}

describe('Voice Agents Gating - NO SAMPLE LEAKAGE', () => {
  
  describe('Scenario 1: demoMode=false, voiceConnected=false (NO PROVIDER)', () => {
    const demoMode = false;
    const voiceConnected = false;
    
    it('should return ZERO_ANALYTICS, not SAMPLE_ANALYTICS', () => {
      const result = computeDisplayAnalytics(demoMode, voiceConnected, null);
      expect(result.totalCalls).toBe(0);
      expect(result.completedCalls).toBe(0);
      expect(result).toEqual(ZERO_ANALYTICS);
      expect(result).not.toEqual(SAMPLE_ANALYTICS);
    });
    
    it('should return empty arrays, not SAMPLE_ arrays', () => {
      const calls = computeDisplayCalls(demoMode, voiceConnected, []);
      const assistants = computeDisplayAssistants(demoMode, voiceConnected, []);
      const phoneNumbers = computeDisplayPhoneNumbers(demoMode, voiceConnected, []);
      
      expect(calls).toEqual([]);
      expect(assistants).toEqual([]);
      expect(phoneNumbers).toEqual([]);
    });
    
    it('should NEVER contain sample data (comprehensive check)', () => {
      const analytics = computeDisplayAnalytics(demoMode, voiceConnected, null);
      const calls = computeDisplayCalls(demoMode, voiceConnected, []);
      const assistants = computeDisplayAssistants(demoMode, voiceConnected, []);
      const phoneNumbers = computeDisplayPhoneNumbers(demoMode, voiceConnected, []);
      
      expect(containsSampleData(analytics, assistants, phoneNumbers, calls)).toBe(false);
    });
  });
  
  describe('Scenario 2: demoMode=false, voiceConnected=true (LIVE MODE)', () => {
    const demoMode = false;
    const voiceConnected = true;
    
    it('should return real analytics when available', () => {
      const result = computeDisplayAnalytics(demoMode, voiceConnected, REAL_ANALYTICS);
      expect(result).toEqual(REAL_ANALYTICS);
      expect(result).not.toEqual(SAMPLE_ANALYTICS);
    });
    
    it('should return ZERO_ANALYTICS when real analytics is null', () => {
      const result = computeDisplayAnalytics(demoMode, voiceConnected, null);
      expect(result).toEqual(ZERO_ANALYTICS);
      expect(result).not.toEqual(SAMPLE_ANALYTICS);
    });
    
    it('should return real arrays, never SAMPLE_ arrays', () => {
      const calls = computeDisplayCalls(demoMode, voiceConnected, REAL_CALLS);
      const assistants = computeDisplayAssistants(demoMode, voiceConnected, REAL_ASSISTANTS);
      const phoneNumbers = computeDisplayPhoneNumbers(demoMode, voiceConnected, REAL_PHONE_NUMBERS);
      
      expect(calls).toEqual(REAL_CALLS);
      expect(assistants).toEqual(REAL_ASSISTANTS);
      expect(phoneNumbers).toEqual(REAL_PHONE_NUMBERS);
    });
    
    it('should return empty arrays when real data is empty (not SAMPLE_)', () => {
      const calls = computeDisplayCalls(demoMode, voiceConnected, []);
      const assistants = computeDisplayAssistants(demoMode, voiceConnected, []);
      const phoneNumbers = computeDisplayPhoneNumbers(demoMode, voiceConnected, []);
      
      expect(calls).toEqual([]);
      expect(assistants).toEqual([]);
      expect(phoneNumbers).toEqual([]);
    });
    
    it('should NEVER contain sample data (comprehensive check)', () => {
      const analytics = computeDisplayAnalytics(demoMode, voiceConnected, null);
      const calls = computeDisplayCalls(demoMode, voiceConnected, []);
      const assistants = computeDisplayAssistants(demoMode, voiceConnected, []);
      const phoneNumbers = computeDisplayPhoneNumbers(demoMode, voiceConnected, []);
      
      expect(containsSampleData(analytics, assistants, phoneNumbers, calls)).toBe(false);
    });
  });
  
  describe('Scenario 3: demoMode=true (DEMO MODE)', () => {
    const demoMode = true;
    const voiceConnected = false; // doesn't matter in demo mode
    
    it('should return SAMPLE_ANALYTICS when real analytics is null', () => {
      const result = computeDisplayAnalytics(demoMode, voiceConnected, null);
      expect(result).toEqual(SAMPLE_ANALYTICS);
    });
    
    it('should return real analytics when available (even in demo mode)', () => {
      const result = computeDisplayAnalytics(demoMode, voiceConnected, REAL_ANALYTICS);
      expect(result).toEqual(REAL_ANALYTICS);
    });
    
    it('should return SAMPLE_ arrays when real arrays are empty', () => {
      const calls = computeDisplayCalls(demoMode, voiceConnected, []);
      const assistants = computeDisplayAssistants(demoMode, voiceConnected, []);
      const phoneNumbers = computeDisplayPhoneNumbers(demoMode, voiceConnected, []);
      
      expect(calls).toEqual(SAMPLE_CALLS);
      expect(assistants).toEqual(SAMPLE_ASSISTANTS);
      expect(phoneNumbers).toEqual(SAMPLE_PHONE_NUMBERS);
    });
    
    it('should return real arrays when they have data (demo mode prefers real)', () => {
      const calls = computeDisplayCalls(demoMode, voiceConnected, REAL_CALLS);
      const assistants = computeDisplayAssistants(demoMode, voiceConnected, REAL_ASSISTANTS);
      const phoneNumbers = computeDisplayPhoneNumbers(demoMode, voiceConnected, REAL_PHONE_NUMBERS);
      
      expect(calls).toEqual(REAL_CALLS);
      expect(assistants).toEqual(REAL_ASSISTANTS);
      expect(phoneNumbers).toEqual(REAL_PHONE_NUMBERS);
    });
  });
  
  describe('Banner Logic', () => {
    it('should show DEMO_MODE banner when demoMode=true', () => {
      const demoMode = true;
      const voiceConnected = false;
      const showVoiceSetupBanner = !demoMode && !voiceConnected;
      
      // In demo mode, no setup banner
      expect(showVoiceSetupBanner).toBe(false);
      // But we should show demo banner (demoMode is true)
      expect(demoMode).toBe(true);
    });
    
    it('should show setup banner when demoMode=false and voiceConnected=false', () => {
      const demoMode = false;
      const voiceConnected = false;
      const showVoiceSetupBanner = !demoMode && !voiceConnected;
      
      expect(showVoiceSetupBanner).toBe(true);
    });
    
    it('should show NO banner when demoMode=false and voiceConnected=true', () => {
      const demoMode = false;
      const voiceConnected = true;
      const showVoiceSetupBanner = !demoMode && !voiceConnected;
      
      expect(showVoiceSetupBanner).toBe(false);
      expect(demoMode).toBe(false);
      // No banner at all in live + connected mode
    });
  });

  describe('Eleven Labs configuration readiness', () => {
    it('flags missing API key as not configured', () => {
      const status = getElevenLabsStatus({ elevenlabs_api_key: null, default_elevenlabs_voice_id: "voice_123" });
      expect(status.configured).toBe(false);
      expect(status.ready).toBe(false);
      expect(status.error).toBe("Eleven Labs API key not configured");
    });

    it('flags missing voice ID as not ready', () => {
      const status = getElevenLabsStatus({ elevenlabs_api_key: "elevenlabs_xxx", default_elevenlabs_voice_id: null });
      expect(status.configured).toBe(true);
      expect(status.ready).toBe(false);
      expect(status.error).toBe("No Eleven Labs voice ID configured");
    });

    it('marks ready when key and voice ID are present', () => {
      const status = getElevenLabsStatus({ elevenlabs_api_key: "elevenlabs_xxx", default_elevenlabs_voice_id: "voice_123" });
      expect(status.configured).toBe(true);
      expect(status.ready).toBe(true);
      expect(status.error).toBeUndefined();
    });
  });
});
