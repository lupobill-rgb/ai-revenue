import { useState, useCallback, useRef, useEffect } from 'react';
import Vapi from '@vapi-ai/web';

interface UseVapiConversationOptions {
  publicKey: string;
  onMessage?: (message: any) => void;
  onError?: (error: any) => void;
}

interface ConversationState {
  status: 'idle' | 'connecting' | 'connected' | 'disconnected';
  isSpeaking: boolean;
  transcript: string[];
  error: string | null;
}

export const useVapiConversation = ({ publicKey, onMessage, onError }: UseVapiConversationOptions) => {
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

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
  }, [onMessage, onError]);

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
      // HARDENED: Always extract string message, never store raw object
      const errorMessage = typeof error === 'string' 
        ? error 
        : error?.message || error?.error?.message || 'Connection error';
      setState(prev => ({ ...prev, error: errorMessage, status: 'disconnected' }));
      // Pass normalized error to callback, but also include raw for statusCode checks
      onErrorRef.current?.(error);
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
    } catch (error: any) {
      console.error('Failed to start call:', error);
      setState(prev => ({ 
        ...prev, 
        status: 'disconnected', 
        error: error?.message || 'Failed to start call' 
      }));
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
