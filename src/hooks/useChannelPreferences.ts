import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceId } from "@/hooks/useWorkspace";

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
  const [preferences, setPreferences] = useState<ChannelPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("channel_preferences")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!error && data) {
      setPreferences({
        email_enabled: data.email_enabled,
        social_enabled: data.social_enabled,
        voice_enabled: data.voice_enabled,
        video_enabled: data.video_enabled,
        landing_pages_enabled: data.landing_pages_enabled,
      });
    }
    setIsLoading(false);
  };

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
