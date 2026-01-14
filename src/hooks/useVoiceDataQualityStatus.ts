/**
 * useVoiceDataQualityStatus - Canonical gating hook for Voice Analytics
 * 
 * HARD RULE: Voice KPIs must never show sample data in live mode.
 * 
 * Returns:
 * - status: 'DEMO_MODE' | 'LIVE_OK' | 'NO_VOICE_PROVIDER_CONNECTED'
 * - voiceConnected: Whether a voice provider (VAPI/ElevenLabs) is connected
 * - isDemoMode: Whether demo mode is active
 * - canShowVoiceMetrics: True only when DEMO_MODE or LIVE_OK
 * - loading: Whether the status is still being determined
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export type VoiceDataQualityStatus = 
  | 'DEMO_MODE' 
  | 'LIVE_OK' 
  | 'NO_VOICE_PROVIDER_CONNECTED';

export interface VoiceDataQualityState {
  status: VoiceDataQualityStatus;
  voiceConnected: boolean;
  isDemoMode: boolean;
  canShowVoiceMetrics: boolean;
  loading: boolean;
  error: string | null;
}

export function useVoiceDataQualityStatus(workspaceId?: string | null): VoiceDataQualityState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [voiceConnected, setVoiceConnected] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch workspace demo_mode ONLY (do NOT use workspaces.tenant_id for joins)
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .select("demo_mode")
        .eq("id", workspaceId)
        .limit(1);

      if (workspaceError) {
        console.error("[useVoiceDataQualityStatus] Workspace query error:", workspaceError);
        throw new Error("Failed to fetch workspace settings");
      }

      const workspaceRow = workspace?.[0];
      setIsDemoMode(workspaceRow?.demo_mode === true);

      // 2. Check voice provider connectivity from ai_settings_voice
      // IMPORTANT: ai_settings_voice was migrated from tenant_id → workspace_id.
      // Prefer workspace_id; fall back to tenant_id for older/local schemas.
      const selectCols = "is_connected, elevenlabs_api_key, voice_provider";
      let voiceSettingsData: any[] | null = null;
      let voiceError: any = null;
      {
        const res = await supabase
          .from("ai_settings_voice")
          .select(selectCols)
          .eq("workspace_id", workspaceId)
          .limit(1);
        voiceSettingsData = res.data as any[] | null;
        voiceError = res.error;

        const msg = String((voiceError as any)?.message || "");
        // Fallback: older schema uses tenant_id (some dev/staging snapshots).
        if (voiceError && msg.toLowerCase().includes("workspace_id")) {
          const fallback = await supabase
            .from("ai_settings_voice")
            .select(selectCols)
            .eq("tenant_id", workspaceId)
            .limit(1);
          voiceSettingsData = fallback.data as any[] | null;
          voiceError = fallback.error;
        }
      }

      const voiceSettings = voiceSettingsData?.[0];

      if (voiceError) {
        console.error("[useVoiceDataQualityStatus] Voice settings query error:", voiceError);
        // Don't throw - just mark as not connected
      }

      // Voice is connected if:
      // - PRIMARY: is_connected === true (authoritative signal from SettingsIntegrations)
      // - FALLBACK: check for key presence (migration resilience for older rows)
      const isExplicitlyConnected = voiceSettings?.is_connected === true;
      const hasElevenLabs = !!voiceSettings?.elevenlabs_api_key;
      
      // Primary signal is is_connected; key-presence is fallback only
      setVoiceConnected(isExplicitlyConnected || hasElevenLabs);

    } catch (err) {
      console.error("[useVoiceDataQualityStatus] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      // On error in live mode: treat as not connected (show zeros)
      setVoiceConnected(false);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]); // Only re-fetch when workspaceId changes

  // Derive status from isDemoMode and voiceConnected
  const status: VoiceDataQualityStatus = useMemo(() => {
    if (isDemoMode) return 'DEMO_MODE';
    if (voiceConnected) return 'LIVE_OK';
    return 'NO_VOICE_PROVIDER_CONNECTED';
  }, [isDemoMode, voiceConnected]);

  // Can show metrics only in demo mode or when voice provider is connected
  const canShowVoiceMetrics = useMemo(() => {
    return isDemoMode || voiceConnected;
  }, [isDemoMode, voiceConnected]);

  return {
    status,
    voiceConnected,
    isDemoMode,
    canShowVoiceMetrics,
    loading,
    error,
  };
}
