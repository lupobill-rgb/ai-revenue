/**
 * Provider Settings Component
 * Allows users to select and test connection for email, voice, and social providers
 */

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Loader2, TestTube, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProviderSettingsProps {
  workspaceId: string;
  onUpdate?: () => void;
}

interface EmailSettings {
  email_provider: string | null;
  is_connected: boolean;
  last_tested_at: string | null;
  last_test_result: Record<string, unknown>;
  from_address: string;
  sender_name: string;
}

interface VoiceSettings {
  voice_provider: string | null;
  default_phone_number_id: string | null;
  is_connected: boolean;
  last_tested_at: string | null;
  last_test_result: Record<string, unknown>;
}

interface SocialSettings {
  social_provider: string | null;
  is_connected: boolean;
  account_name: string | null;
  last_tested_at: string | null;
  last_test_result: Record<string, unknown>;
}

export function ProviderSettings({ workspaceId, onUpdate }: ProviderSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings | null>(null);
  const [socialSettings, setSocialSettings] = useState<SocialSettings | null>(null);

  const [selectedEmailProvider, setSelectedEmailProvider] = useState<string>("resend");
  const [selectedVoiceProvider, setSelectedVoiceProvider] = useState<string>("elevenlabs");
  const [selectedSocialProvider, setSelectedSocialProvider] = useState<string>("coming_soon");

  const [testingEmail, setTestingEmail] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workspaceId) {
      loadSettings();
    }
  }, [workspaceId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [emailRes, voiceRes, socialRes] = await Promise.all([
        supabase.from("ai_settings_email").select("*").eq("tenant_id", workspaceId).limit(1),
        supabase.from("ai_settings_voice").select("*").eq("tenant_id", workspaceId).limit(1),
        supabase.from("ai_settings_social").select("*").eq("tenant_id", workspaceId).limit(1),
      ]);

      const emailRow = emailRes.data?.[0] as EmailSettings | undefined;
      if (emailRow) {
        const data = emailRow;
        setEmailSettings(data);
        setSelectedEmailProvider(data.email_provider || "resend");
      }

      const voiceRow = voiceRes.data?.[0] as VoiceSettings | undefined;
      if (voiceRow) {
        const data = voiceRow;
        setVoiceSettings(data);
        setSelectedVoiceProvider(data.voice_provider || "elevenlabs");
      }

      const socialRow = socialRes.data?.[0] as SocialSettings | undefined;
      if (socialRow) {
        const data = socialRow;
        setSocialSettings(data);
        setSelectedSocialProvider(data.social_provider || "coming_soon");
      }
    } catch (error) {
      console.error("Error loading provider settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveEmailProvider = async (provider: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ai_settings_email")
        .upsert(
          {
            tenant_id: workspaceId,
            email_provider: provider,
            is_connected: false, // Reset connection status when changing provider
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id" }
        );

      if (error) throw error;

      setSelectedEmailProvider(provider);
      setEmailSettings((prev) =>
        prev ? { ...prev, email_provider: provider, is_connected: false } : null
      );
      toast.success(`Email provider set to ${provider}`);
      onUpdate?.();
    } catch (error) {
      console.error("Error saving email provider:", error);
      toast.error("Failed to save email provider");
    } finally {
      setSaving(false);
    }
  };

  const saveVoiceProvider = async (provider: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ai_settings_voice")
        .upsert(
          {
            tenant_id: workspaceId,
            voice_provider: provider,
            is_connected: false, // Reset connection status when changing provider
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id" }
        );

      if (error) throw error;

      setSelectedVoiceProvider(provider);
      setVoiceSettings((prev) =>
        prev ? { ...prev, voice_provider: provider, is_connected: false } : null
      );
      toast.success(`Voice provider set to ${provider}`);
      onUpdate?.();
    } catch (error) {
      console.error("Error saving voice provider:", error);
      toast.error("Failed to save voice provider");
    } finally {
      setSaving(false);
    }
  };

  const testEmailConnection = async () => {
    setTestingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-email", {
        body: { provider: selectedEmailProvider, workspaceId },
      });

      if (error) throw error;

      const success = data?.success ?? false;
      const testResult = {
        success,
        message: data?.message || (success ? "Connection successful" : "Connection failed"),
        tested_at: new Date().toISOString(),
      };

      // Update settings with test result
      await supabase
        .from("ai_settings_email")
        .update({
          is_connected: success,
          last_tested_at: new Date().toISOString(),
          last_test_result: testResult,
        })
        .eq("tenant_id", workspaceId);

      setEmailSettings((prev) =>
        prev
          ? {
              ...prev,
              is_connected: success,
              last_tested_at: new Date().toISOString(),
              last_test_result: testResult,
            }
          : null
      );

      if (success) {
        toast.success("Email connection verified!");
      } else {
        toast.error(data?.message || "Email connection test failed");
      }
      onUpdate?.();
    } catch (error) {
      console.error("Error testing email:", error);
      toast.error("Failed to test email connection");
    } finally {
      setTestingEmail(false);
    }
  };

  const testVoiceConnection = async () => {
    setTestingVoice(true);
    try {
      let success = false;
      let message = "Connection failed";

      // Test based on selected provider
      if (selectedVoiceProvider === "elevenlabs") {
        const { data, error } = await supabase.functions.invoke("elevenlabs-test-connection", {
          body: { tenantId: workspaceId },
        });
        success = !error && data?.success;
        message = data?.message || error?.message || "ElevenLabs connection failed";
      }

      const testResult = {
        success,
        message,
        tested_at: new Date().toISOString(),
      };

      await supabase
        .from("ai_settings_voice")
        .update({
          is_connected: success,
          last_tested_at: new Date().toISOString(),
          last_test_result: testResult,
        })
        .eq("tenant_id", workspaceId);

      setVoiceSettings((prev) =>
        prev
          ? {
              ...prev,
              is_connected: success,
              last_tested_at: new Date().toISOString(),
              last_test_result: testResult,
            }
          : null
      );

      if (success) {
        toast.success("Voice connection verified!");
      } else {
        toast.error(`Voice connection test failed - ${message}`);
      }
      onUpdate?.();
    } catch (error) {
      console.error("Error testing voice:", error);
      toast.error("Failed to test voice connection");
    } finally {
      setTestingVoice(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Provider */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Email Provider</CardTitle>
              <CardDescription>Select which email service to use for campaigns</CardDescription>
            </div>
            {emailSettings?.is_connected ? (
              <Badge className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={selectedEmailProvider}
            onValueChange={saveEmailProvider}
            disabled={saving}
          >
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
              <RadioGroupItem value="resend" id="resend" />
              <Label htmlFor="resend" className="flex-1 cursor-pointer">
                <span className="font-medium">Resend</span>
                <span className="text-sm text-muted-foreground ml-2">
                  (Recommended - API key in secrets)
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
              <RadioGroupItem value="gmail" id="gmail" />
              <Label htmlFor="gmail" className="flex-1 cursor-pointer">
                <span className="font-medium">Gmail</span>
                <span className="text-sm text-muted-foreground ml-2">
                  (OAuth - connect your account)
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
              <RadioGroupItem value="smtp" id="smtp" />
              <Label htmlFor="smtp" className="flex-1 cursor-pointer">
                <span className="font-medium">Custom SMTP</span>
                <span className="text-sm text-muted-foreground ml-2">
                  (Configure your own SMTP server)
                </span>
              </Label>
            </div>
          </RadioGroup>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              onClick={testEmailConnection}
              disabled={testingEmail}
            >
              {testingEmail ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            <a href="/settings/integrations?tab=email">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </a>
          </div>

          {emailSettings?.last_tested_at && (
            <p className="text-xs text-muted-foreground">
              Last tested: {new Date(emailSettings.last_tested_at).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Voice Provider */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Voice Provider</CardTitle>
              <CardDescription>Select voice AI provider for outbound calls</CardDescription>
            </div>
            {voiceSettings?.is_connected ? (
              <Badge className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={selectedVoiceProvider} onValueChange={saveVoiceProvider} disabled={saving}>
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
              <RadioGroupItem value="elevenlabs" id="elevenlabs" />
              <Label htmlFor="elevenlabs" className="flex-1 cursor-pointer">
                <span className="font-medium">ElevenLabs</span>
                <span className="text-sm text-muted-foreground ml-2">
                  (High-quality voice synthesis & conversational AI)
                </span>
              </Label>
            </div>
          </RadioGroup>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              onClick={testVoiceConnection}
              disabled={testingVoice}
            >
              {testingVoice ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            <a href="/settings/integrations?tab=voice">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </a>
          </div>

          {voiceSettings?.last_tested_at && (
            <p className="text-xs text-muted-foreground">
              Last tested: {new Date(voiceSettings.last_tested_at).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Social Provider */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Social Provider</CardTitle>
              <CardDescription>Social media posting integration</CardDescription>
            </div>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/30 rounded-lg text-center">
            <p className="text-muted-foreground">
              Social media posting is coming soon. LinkedIn, Twitter, and Facebook integrations
              will be available in a future update.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProviderSettings;
