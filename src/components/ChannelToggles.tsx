/**
 * Channel Toggles UI Component
 * Allows users to enable/disable marketing channels (email, social, voice, video, landing pages)
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Share2, Phone, Video, Layout } from "lucide-react";

interface ChannelPreferences {
  email_enabled: boolean;
  social_enabled: boolean;
  voice_enabled: boolean;
  video_enabled: boolean;
  landing_pages_enabled: boolean;
}

const CHANNEL_CONFIG = [
  {
    key: "email_enabled" as keyof ChannelPreferences,
    label: "Email Campaigns",
    description: "Create and deploy email marketing campaigns with AI-generated content",
    icon: Mail,
  },
  {
    key: "social_enabled" as keyof ChannelPreferences,
    label: "Social Media",
    description: "Publish content to Instagram, LinkedIn, Facebook, and TikTok",
    icon: Share2,
  },
  {
    key: "voice_enabled" as keyof ChannelPreferences,
    label: "AI Voice Campaigns",
    description: "Automated outbound calling with AI-generated scripts",
    icon: Phone,
  },
  {
    key: "video_enabled" as keyof ChannelPreferences,
    label: "Video Content",
    description: "AI-generated video ads and promotional content",
    icon: Video,
  },
  {
    key: "landing_pages_enabled" as keyof ChannelPreferences,
    label: "Landing Pages",
    description: "Create and manage conversion-optimized landing pages",
    icon: Layout,
  },
];

export function ChannelToggles() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<ChannelPreferences>({
    email_enabled: true,
    social_enabled: true,
    voice_enabled: true,
    video_enabled: true,
    landing_pages_enabled: true,
  });

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("channel_preferences")
      .select("*")
      .eq("user_id", user.id)
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
    setLoading(false);
  };

  const handleToggle = async (key: keyof ChannelPreferences, enabled: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    const newPreferences = { ...preferences, [key]: enabled };
    setPreferences(newPreferences);

    const { error } = await supabase
      .from("channel_preferences")
      .upsert({
        user_id: user.id,
        ...newPreferences,
      }, {
        onConflict: "user_id",
      });

    setSaving(false);

    if (error) {
      // Revert on error
      setPreferences(preferences);
      toast({
        title: "Error",
        description: "Failed to update channel preferences",
        variant: "destructive",
      });
    } else {
      const config = CHANNEL_CONFIG.find(c => c.key === key);
      toast({
        title: enabled ? "Channel Enabled" : "Channel Disabled",
        description: `${config?.label} has been ${enabled ? "enabled" : "disabled"}.`,
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-primary" />
          Marketing Channels
        </CardTitle>
        <CardDescription>
          Choose which marketing channels to enable. Disabled channels will be hidden from asset creation and deployment options.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {CHANNEL_CONFIG.map((channel) => {
          const Icon = channel.icon;
          const isEnabled = preferences[channel.key];

          return (
            <div
              key={channel.key}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-md bg-primary/10 p-2">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={channel.key} className="font-medium">
                    {channel.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {channel.description}
                  </p>
                </div>
              </div>
              <Switch
                id={channel.key}
                checked={isEnabled}
                onCheckedChange={(checked) => handleToggle(channel.key, checked)}
                disabled={saving}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default ChannelToggles;
