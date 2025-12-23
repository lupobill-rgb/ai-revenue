import { useState, useCallback, useRef, useEffect } from 'react';
import Vapi from '@vapi-ai/web';
import { normalizeError } from '@/lib/normalizeError';

// Structured error payload for 402/paywall detection
export interface VapiErrorPayload {
  statusCode: number | null;
  subscriptionLimits: Record<string, unknown> | null;
  raw: unknown;
}

interface UseVapiConversationOptions {
  publicKey: string;
  onMessage?: (message: any) => void;
  onError?: (message: string) => void; // Always receives string
  onErrorPayload?: (payload: VapiErrorPayload) => void; // Structured payload for 402 detection
}

interface ConversationState {
  status: 'idle' | 'connecting' | 'connected' | 'disconnected';
  isSpeaking: boolean;
  transcript: string[];
  error: string | null; // INVARIANT: Always string | null, never object
}

/**
 * Extract structured error info from any error shape
 */
function extractErrorPayload(error: unknown): VapiErrorPayload {
  if (!error || typeof error !== 'object') {
    return { statusCode: null, subscriptionLimits: null, raw: error };
  }
  
  const anyE = error as Record<string, unknown>;
  const statusCode = (anyE.statusCode as number) ?? 
                     (anyE.error as Record<string, unknown>)?.statusCode as number ?? 
                     null;
  const subscriptionLimits = (anyE.subscriptionLimits as Record<string, unknown>) ?? null;
  
  return { statusCode, subscriptionLimits, raw: error };
}

export const useVapiConversation = ({ 
  publicKey, 
  onMessage, 
  onError,
  onErrorPayload 
}: UseVapiConversationOptions) => {
  const [state, setState] = useState<ConversationState>({
    status: 'idle',
    isSpeaking: false,
    transcript: [],
    error: null,
  });
  
  const vapiRef = useRef<Vapi | null>(null);
  const isInitializedRef = useRef(false);
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onErrorPayloadRef = useRef(onErrorPayload);

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
    onErrorPayloadRef.current = onErrorPayload;
  }, [onMessage, onError, onErrorPayload]);

  /**
   * Unified error handler - ensures state.error is always a string
   */
  const handleError = useCallback((error: unknown, fallbackMessage: string) => {
    const message = normalizeError(error) || fallbackMessage;
    const payload = extractErrorPayload(error);
    
    // State always gets string
    setState(prev => ({ ...prev, error: message, status: 'disconnected' }));
    
    // Callbacks: string for onError, structured for onErrorPayload
    onErrorRef.current?.(message);
    onErrorPayloadRef.current?.(payload);
  }, []);

  useEffect(() => {
    if (!publicKey || isInitializedRef.current) return;
    
    console.log('Initializing Vapi with public key:', publicKey.substring(0, 8) + '...');
    
    const vapi = new Vapi(publicKey);
    vapiRef.current = vapi;
    isInitializedRef.current = true;

    vapi.on('call-start', () => {
      console.log('Vapi call started successfully');
      setState(prev => ({ ...prev, status: 'connected', error: null }));
    });

    vapi.on('call-end', () => {
      console.log('Vapi call ended');
      setState(prev => ({ ...prev, status: 'disconnected', isSpeaking: false }));
    });

    vapi.on('speech-start', () => {
      console.log('Vapi speech started');
      setState(prev => ({ ...prev, isSpeaking: true }));
    });

    vapi.on('speech-end', () => {
      console.log('Vapi speech ended');
      setState(prev => ({ ...prev, isSpeaking: false }));
    });

    vapi.on('message', (message: any) => {
      console.log('Vapi message:', message);
      if (message.type === 'transcript') {
        setState(prev => ({
          ...prev,
          transcript: [...prev.transcript, `${message.role}: ${message.transcript}`],
        }));
      }
      onMessageRef.current?.(message);
    });

    vapi.on('error', (error: any) => {
      console.error('Vapi error:', error);
      const message = normalizeError(error) || 'Connection error';
      const payload = extractErrorPayload(error);
      
      setState(prev => ({ ...prev, error: message, status: 'disconnected' }));
      onErrorRef.current?.(message);
      onErrorPayloadRef.current?.(payload);
    });

    // Only cleanup on unmount, not on re-renders
    return () => {
      console.log('Cleaning up Vapi instance');
      if (vapiRef.current) {
        vapiRef.current.stop();
        vapiRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, [publicKey]);

  const startCall = useCallback(async (assistantId: string, assistantOverrides?: any) => {
    if (!vapiRef.current) {
      console.error('Vapi not initialized');
      setState(prev => ({ ...prev, error: 'Vapi not initialized' }));
      return;
    }

    try {
      console.log('Starting Vapi call with assistant:', assistantId);
      setState(prev => ({ ...prev, status: 'connecting', error: null, transcript: [] }));
      
      // Request microphone permission first
      console.log('Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone permission granted');
      
      // Stop the stream immediately as Vapi will handle it
      stream.getTracks().forEach(track => track.stop());
      
      console.log('Calling vapi.start()...');
      await vapiRef.current.start(assistantId, assistantOverrides);
      console.log('vapi.start() completed');
    } catch (error: unknown) {
      console.error('Failed to start call:', error);
      const message = normalizeError(error) || 'Failed to start call';
      const payload = extractErrorPayload(error);
      
      setState(prev => ({ ...prev, status: 'disconnected', error: message }));
      onErrorRef.current?.(message);
      onErrorPayloadRef.current?.(payload);
    }
  }, []);

  const endCall = useCallback(() => {
    if (vapiRef.current) {
      console.log('Ending Vapi call');
      vapiRef.current.stop();
      setState(prev => ({ ...prev, status: 'disconnected', isSpeaking: false }));
    }
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (vapiRef.current && state.status === 'connected') {
      vapiRef.current.send({
        type: 'add-message',
        message: {
          role: 'user',
          content: message,
        },
      });
    }
  }, [state.status]);

  const setVolume = useCallback((volume: number) => {
    if (vapiRef.current) {
      vapiRef.current.setMuted(volume === 0);
    }
  }, []);

  return {
    ...state,
    startCall,
    endCall,
    sendMessage,
    setVolume,
    isReady: !!vapiRef.current && !!publicKey,
  };
};
