import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspaceId } from "@/contexts/WorkspaceContext";

export interface ChannelPreferences {
  email_enabled: boolean;
  social_enabled: boolean;
  voice_enabled: boolean;
  video_enabled: boolean;
  landing_pages_enabled: boolean;
}

const DEFAULT_PREFERENCES: ChannelPreferences = {
  email_enabled: true,
  social_enabled: true,
  voice_enabled: true,
  video_enabled: true,
  landing_pages_enabled: true,
};

export function useChannelPreferences() {
  const workspaceId = useActiveWorkspaceId();
  const [preferences, setPreferences] = useState<ChannelPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("channel_preferences")
      .select("*")
      .eq("workspace_id", workspaceId)
      .limit(1);

    const row = data?.[0];

    if (!error && row) {
      setPreferences({
        email_enabled: row.email_enabled,
        social_enabled: row.social_enabled,
        voice_enabled: row.voice_enabled,
        video_enabled: row.video_enabled,
        landing_pages_enabled: row.landing_pages_enabled,
      });
    }
    setIsLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    fetchPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]); // Only re-fetch when workspaceId changes

  const isChannelEnabled = (channel: keyof ChannelPreferences) => {
    return preferences[channel];
  };

  return {
    preferences,
    isLoading,
    isChannelEnabled,
    refetch: fetchPreferences,
  };
}

export default useChannelPreferences;
