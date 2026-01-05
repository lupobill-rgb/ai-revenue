import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { 
  Mail, Linkedin, Calendar, Globe, Webhook, Loader2, 
  CheckCircle2, XCircle, Copy, ChevronDown, Settings, ArrowLeft,
  History, User, Clock, Phone, Mic, RefreshCw, Plus, Trash2,
  CreditCard, Share2, Instagram, Facebook, LogOut, Sparkles,
  Reply, AlertTriangle, HelpCircle
} from "lucide-react";
import { EmailSetupWizard } from "@/components/settings/EmailSetupWizard";
import { EmailReplyToExplainer } from "@/components/settings/EmailReplyToExplainer";
import { DomainVerificationHelper } from "@/components/settings/DomainVerificationHelper";
import { DomainSettingsCard } from "@/components/settings/DomainSettingsCard";
import { SocialTokenWizard } from "@/components/settings/SocialTokenWizard";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { format, formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

// Types for each settings table
interface EmailSettings {
  tenant_id: string;
  sender_name: string;
  from_address: string;
  reply_to_address: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  updated_at: string | null;
}

interface LinkedInSettings {
  tenant_id: string;
  linkedin_profile_url: string;
  daily_connection_limit: number;
  daily_message_limit: number;
  updated_at: string | null;
}

interface CalendarSettings {
  tenant_id: string;
  calendar_provider: string;
  booking_url: string;
  updated_at: string | null;
}

interface CRMWebhookSettings {
  tenant_id: string;
  inbound_webhook_url: string | null;
  outbound_webhook_url: string | null;
  updated_at: string | null;
}

interface DomainSettings {
  tenant_id: string;
  domain: string;
  cname_verified: boolean;
  updated_at: string | null;
}

interface VoiceSettings {
  tenant_id: string;
  vapi_public_key: string | null;
  vapi_private_key: string | null;
  elevenlabs_api_key: string | null;
  default_vapi_assistant_id: string | null;
  default_elevenlabs_voice_id: string | null;
  elevenlabs_model: string | null;
  updated_at: string | null;
}

interface VapiAssistant {
  id: string;
  name: string;
  firstMessage?: string;
  model?: string;
  voice?: string;
}

interface StripeSettings {
  tenant_id: string;
  stripe_publishable_key: string;
  stripe_secret_key_hint: string;
  webhook_secret_hint: string;
  is_connected: boolean;
  account_name: string;
  updated_at: string | null;
}

interface SocialIntegration {
  id: string;
  platform: string;
  access_token: string;
  account_name: string | null;
  is_active: boolean | null;
  workspace_id: string | null;
}

interface AuditLogEntry {
  id: string;
  tenant_id: string;
  user_id: string;
  settings_type: string;
  action: string;
  changes: Record<string, { old: any; new: any }>;
  created_at: string;
}

const SETTINGS_TYPE_LABELS: Record<string, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  calendar: "Calendar",
  crm: "CRM Webhooks",
  domain: "Domain",
  voice: "Voice",
  stripe: "Stripe",
  social: "Social",
};

const SOCIAL_PLATFORMS = [
  { id: "linkedin", name: "LinkedIn", icon: Linkedin },
  { id: "instagram", name: "Instagram", icon: Instagram },
  { id: "facebook", name: "Facebook", icon: Facebook },
  { id: "tiktok", name: "TikTok", icon: Share2 },
];

const ELEVENLABS_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (Default)" },
  { id: "9BWtsMINqrJLrRacOk9x", name: "Aria" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian" },
];

const ELEVENLABS_MODELS = [
  { id: "eleven_multilingual_v2", name: "Multilingual v2 (Best Quality)" },
  { id: "eleven_turbo_v2_5", name: "Turbo v2.5 (Fast, 32 languages)" },
  { id: "eleven_turbo_v2", name: "Turbo v2 (Fast, English only)" },
];

const FIELD_LABELS: Record<string, string> = {
  sender_name: "Sender Name",
  from_address: "From Address",
  reply_to_address: "Reply-To Address",
  smtp_host: "SMTP Host",
  smtp_port: "SMTP Port",
  smtp_username: "SMTP Username",
  smtp_password: "SMTP Password",
  linkedin_profile_url: "Profile URL",
  daily_connection_limit: "Daily Connection Limit",
  daily_message_limit: "Daily Message Limit",
  calendar_provider: "Calendar Provider",
  booking_url: "Booking URL",
  inbound_webhook_url: "Inbound Webhook URL",
  outbound_webhook_url: "Outbound Webhook URL",
  domain: "Domain",
  cname_verified: "CNAME Verified",
  vapi_public_key: "VAPI Public Key",
  vapi_private_key: "VAPI Private Key",
  elevenlabs_api_key: "ElevenLabs API Key",
  default_vapi_assistant_id: "Default Assistant",
  default_elevenlabs_voice_id: "Default Voice",
  elevenlabs_model: "ElevenLabs Model",
  stripe_publishable_key: "Publishable Key",
  stripe_secret_key_hint: "Secret Key",
  webhook_secret_hint: "Webhook Secret",
  account_name: "Account Name",
  access_token: "Access Token",
};

export default function SettingsIntegrations() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "email");
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Email state
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [emailMethod, setEmailMethod] = useState<"resend" | "gmail" | "smtp">("resend");
  const [senderName, setSenderName] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [replyToAddress, setReplyToAddress] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState<number | null>(null);
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [showEmailWizard, setShowEmailWizard] = useState(false);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);

  // Integration test states
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testingCalendar, setTestingCalendar] = useState(false);
  const [testingStripe, setTestingStripe] = useState(false);
  const [testingLinkedIn, setTestingLinkedIn] = useState(false);
  const [testingVapi, setTestingVapi] = useState(false);
  const [testingElevenLabs, setTestingElevenLabs] = useState(false);
  const [testingDomain, setTestingDomain] = useState(false);
  const [testingSocial, setTestingSocial] = useState<string | null>(null);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [calendarTestResult, setCalendarTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [stripeTestResult, setStripeTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [linkedInTestResult, setLinkedInTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [vapiTestResult, setVapiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [elevenLabsTestResult, setElevenLabsTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [domainTestResult, setDomainTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [socialTestResults, setSocialTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  // Gmail OAuth state
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailDisconnecting, setGmailDisconnecting] = useState(false);

  // LinkedIn state
  const [linkedinSettings, setLinkedinSettings] = useState<LinkedInSettings | null>(null);
  const [linkedinProfileUrl, setLinkedinProfileUrl] = useState("");
  const [dailyConnectionLimit, setDailyConnectionLimit] = useState(20);
  const [dailyMessageLimit, setDailyMessageLimit] = useState(50);

  // Calendar state
  const [calendarSettings, setCalendarSettings] = useState<CalendarSettings | null>(null);
  const [calendarProvider, setCalendarProvider] = useState("google");
  const [bookingUrl, setBookingUrl] = useState("");

  // CRM Webhooks state
  const [crmSettings, setCrmSettings] = useState<CRMWebhookSettings | null>(null);
  const [inboundWebhookUrl, setInboundWebhookUrl] = useState("");
  const [outboundWebhookUrl, setOutboundWebhookUrl] = useState("");

  // Domain state
  const [domainSettings, setDomainSettings] = useState<DomainSettings | null>(null);
  const [domain, setDomain] = useState("");

  // Voice state
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings | null>(null);
  const [vapiPublicKey, setVapiPublicKey] = useState("");
  const [vapiPrivateKey, setVapiPrivateKey] = useState("");
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState("");
  const [defaultVapiAssistantId, setDefaultVapiAssistantId] = useState("");
  const [defaultElevenlabsVoiceId, setDefaultElevenlabsVoiceId] = useState("EXAVITQu4vr4xnSDxMaL");
  const [elevenlabsModel, setElevenlabsModel] = useState("eleven_multilingual_v2");
  const [vapiAssistants, setVapiAssistants] = useState<VapiAssistant[]>([]);
  const [loadingAssistants, setLoadingAssistants] = useState(false);
  const [creatingAssistant, setCreatingAssistant] = useState(false);
  const [newAssistantName, setNewAssistantName] = useState("");
  const [newAssistantPrompt, setNewAssistantPrompt] = useState("You are a helpful AI assistant.");

  // Stripe state
  const [stripeSettings, setStripeSettings] = useState<StripeSettings | null>(null);
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeSecretKeyHint, setStripeSecretKeyHint] = useState("");
  const [stripeWebhookSecretHint, setStripeWebhookSecretHint] = useState("");
  const [stripeAccountName, setStripeAccountName] = useState("");
  const [stripeIsConnected, setStripeIsConnected] = useState(false);

  // Social integrations state
  const [socialIntegrations, setSocialIntegrations] = useState<SocialIntegration[]>([]);
  const [socialTokens, setSocialTokens] = useState<Record<string, { token: string; accountName: string }>>({});
  const [socialWizardOpen, setSocialWizardOpen] = useState(false);
  const [socialWizardPlatform, setSocialWizardPlatform] = useState<"instagram" | "linkedin" | "facebook" | "tiktok">("instagram");

  useEffect(() => {
    loadAllSettings();
    
    // Handle Gmail OAuth callback query params
    const gmailConnectedParam = searchParams.get("gmail_connected");
    const gmailError = searchParams.get("gmail_error");
    
    if (gmailConnectedParam === "true") {
      toast({
        title: "Gmail Connected",
        description: "Your Gmail account has been connected successfully.",
      });
      // Clear the query params - use navigate to avoid full page reload
      navigate("/settings/integrations", { replace: true });
      fetchGmailStatus();
    } else if (gmailError) {
      const errorMessages: Record<string, string> = {
        invalid_state: "Invalid OAuth state. Please try again.",
        no_code: "No authorization code received. Please try again.",
        token_exchange_failed: "Failed to exchange authorization code. Please try again.",
        no_refresh_token: "No refresh token received. Please revoke access at myaccount.google.com and try again.",
        no_email: "Could not retrieve email from Google.",
        storage_failed: "Failed to store credentials. Please try again.",
      };
      toast({
        title: "Gmail Connection Failed",
        description: errorMessages[gmailError] || "An unknown error occurred.",
        variant: "destructive",
      });
      navigate("/settings/integrations", { replace: true });
    }
  }, [searchParams]);

  const loadAllSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    // Get workspace ID (user may be owner or member)
    // NOTE: user can have multiple workspaces, so avoid maybeSingle() without a LIMIT.
    const { data: ownedWorkspace, error: ownedErr } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (ownedErr) {
      console.error("Failed to load owned workspace:", ownedErr);
    }

    let workspaceId = ownedWorkspace?.id;

    if (!workspaceId) {
      const { data: membership, error: memberErr } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (memberErr) {
        console.error("Failed to load workspace membership:", memberErr);
      }

      workspaceId = membership?.workspace_id;
    }

    if (!workspaceId) {
      console.error("No workspace found for user");
      setLoading(false);
      return;
    }

    setTenantId(workspaceId);

    // Fetch Gmail connection status
    await fetchGmailStatus();

    // Load all settings and audit logs in parallel using workspace_id
    const [emailRes, linkedinRes, calendarRes, crmRes, domainRes, voiceRes, stripeRes, socialRes, auditRes] = await Promise.all([
      supabase.from("ai_settings_email").select("*").eq("tenant_id", workspaceId).maybeSingle(),
      supabase.from("ai_settings_linkedin").select("*").eq("tenant_id", workspaceId).maybeSingle(),
      supabase.from("ai_settings_calendar").select("*").eq("tenant_id", workspaceId).maybeSingle(),
      supabase.from("ai_settings_crm_webhooks").select("*").eq("tenant_id", workspaceId).maybeSingle(),
      supabase.from("ai_settings_domain").select("*").eq("tenant_id", workspaceId).maybeSingle(),
      supabase.from("ai_settings_voice").select("*").eq("tenant_id", workspaceId).maybeSingle(),
      supabase.from("ai_settings_stripe").select("*").eq("tenant_id", workspaceId).maybeSingle(),
      supabase.from("social_integrations").select("*").eq("workspace_id", workspaceId),
      supabase.from("integration_audit_log").select("*").eq("tenant_id", workspaceId).order("created_at", { ascending: false }).limit(20),
    ]);

    // Populate email
    if (emailRes.data) {
      setEmailSettings(emailRes.data);
      setSenderName(emailRes.data.sender_name || "");
      setFromAddress(emailRes.data.from_address || "");
      setReplyToAddress(emailRes.data.reply_to_address || "");
      setSmtpHost(emailRes.data.smtp_host || "");
      setSmtpPort(emailRes.data.smtp_port);
      setSmtpUsername(emailRes.data.smtp_username || "");
      setSmtpPassword(emailRes.data.smtp_password || "");
      setIsFirstTimeSetup(false);
    } else {
      // First-time setup - show wizard
      setIsFirstTimeSetup(true);
      setShowEmailWizard(true);
    }

    // Populate LinkedIn
    if (linkedinRes.data) {
      setLinkedinSettings(linkedinRes.data);
      setLinkedinProfileUrl(linkedinRes.data.linkedin_profile_url || "");
      setDailyConnectionLimit(linkedinRes.data.daily_connection_limit || 20);
      setDailyMessageLimit(linkedinRes.data.daily_message_limit || 50);
    }

    // Populate Calendar
    if (calendarRes.data) {
      setCalendarSettings(calendarRes.data);
      setCalendarProvider(calendarRes.data.calendar_provider || "google");
      setBookingUrl(calendarRes.data.booking_url || "");
    }

    // Populate CRM
    if (crmRes.data) {
      setCrmSettings(crmRes.data);
      setInboundWebhookUrl(crmRes.data.inbound_webhook_url || "");
      setOutboundWebhookUrl(crmRes.data.outbound_webhook_url || "");
    }

    // Populate Domain
    if (domainRes.data) {
      setDomainSettings(domainRes.data);
      setDomain(domainRes.data.domain || "");
    }

    // Populate Voice
    if (voiceRes.data) {
      setVoiceSettings(voiceRes.data as VoiceSettings);
      setVapiPublicKey(voiceRes.data.vapi_public_key || "");
      setVapiPrivateKey(voiceRes.data.vapi_private_key || "");
      setElevenlabsApiKey(voiceRes.data.elevenlabs_api_key || "");
      setDefaultVapiAssistantId(voiceRes.data.default_vapi_assistant_id || "");
      setDefaultElevenlabsVoiceId(voiceRes.data.default_elevenlabs_voice_id || "EXAVITQu4vr4xnSDxMaL");
      setElevenlabsModel(voiceRes.data.elevenlabs_model || "eleven_multilingual_v2");
    }

    // Populate Stripe
    if (stripeRes.data) {
      setStripeSettings(stripeRes.data as StripeSettings);
      setStripePublishableKey(stripeRes.data.stripe_publishable_key || "");
      setStripeSecretKeyHint(stripeRes.data.stripe_secret_key_hint || "");
      setStripeWebhookSecretHint(stripeRes.data.webhook_secret_hint || "");
      setStripeAccountName(stripeRes.data.account_name || "");
      setStripeIsConnected(stripeRes.data.is_connected || false);
    }

    // Populate Social integrations
    if (socialRes.data) {
      setSocialIntegrations(socialRes.data as SocialIntegration[]);
      const tokens: Record<string, { token: string; accountName: string }> = {};
      (socialRes.data as SocialIntegration[]).forEach((integration) => {
        tokens[integration.platform] = {
          token: integration.access_token || "",
          accountName: integration.account_name || "",
        };
      });
      setSocialTokens(tokens);
    }

    // Populate audit logs
    if (auditRes.data) {
      setAuditLogs(auditRes.data as AuditLogEntry[]);
    }

    setLoading(false);
  };

  const fetchGmailStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("user_gmail_tokens")
        .select("email")
        .maybeSingle();
      
      if (data && !error) {
        setGmailConnected(true);
        setGmailEmail(data.email);
      } else {
        setGmailConnected(false);
        setGmailEmail(null);
      }
    } catch (error) {
      console.error("Error fetching Gmail status:", error);
    }
  };

  const handleConnectGmail = async () => {
    setGmailConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-oauth-start", {
        body: { redirectUrl: window.location.href.split("?")[0] },
      });

      if (error) throw error;
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error("No auth URL returned");
      }
    } catch (error: any) {
      console.error("Error starting Gmail OAuth:", error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to start Gmail connection",
        variant: "destructive",
      });
      setGmailConnecting(false);
    }
  };

  const handleDisconnectGmail = async () => {
    setGmailDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke("gmail-disconnect");
      
      if (error) throw error;
      
      setGmailConnected(false);
      setGmailEmail(null);
      toast({
        title: "Gmail Disconnected",
        description: "Your Gmail account has been disconnected.",
      });
    } catch (error: any) {
      console.error("Error disconnecting Gmail:", error);
      toast({
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect Gmail",
        variant: "destructive",
      });
    } finally {
      setGmailDisconnecting(false);
    }
  };

  const detectChanges = (oldValues: Record<string, any>, newValues: Record<string, any>): Record<string, { old: any; new: any }> => {
    const changes: Record<string, { old: any; new: any }> = {};
    for (const key of Object.keys(newValues)) {
      if (key === 'tenant_id' || key === 'updated_at') continue;
      const oldVal = oldValues?.[key] ?? null;
      const newVal = newValues[key] ?? null;
      // Normalize empty strings to null for comparison
      const normalizedOld = oldVal === '' ? null : oldVal;
      const normalizedNew = newVal === '' ? null : newVal;
      if (normalizedOld !== normalizedNew) {
        changes[key] = { 
          old: key.includes('password') ? (oldVal ? '••••••••' : null) : oldVal, 
          new: key.includes('password') ? (newVal ? '••••••••' : null) : newVal 
        };
      }
    }
    return changes;
  };

  const logAuditEntry = async (settingsType: string, changes: Record<string, { old: any; new: any }>, isCreate: boolean) => {
    if (!tenantId || !userId || Object.keys(changes).length === 0) return;
    
    const { data, error } = await supabase.from("integration_audit_log").insert({
      tenant_id: tenantId,
      user_id: userId,
      settings_type: settingsType,
      action: isCreate ? 'create' : 'update',
      changes,
    }).select().single();

    if (!error && data) {
      setAuditLogs(prev => [data as AuditLogEntry, ...prev.slice(0, 19)]);
    }
  };

  const formatChangesList = (changes: Record<string, { old: any; new: any }>): string[] => {
    return Object.entries(changes).map(([field, { old: oldVal, new: newVal }]) => {
      const label = FIELD_LABELS[field] || field;
      if (oldVal === null || oldVal === '' || oldVal === undefined) {
        return `Set ${label} to "${newVal}"`;
      }
      return `Changed ${label} from "${oldVal}" to "${newVal}"`;
    });
  };

  const saveEmailSettings = async () => {
    if (!tenantId) {
      toast({ 
        title: "Error", 
        description: "Workspace not found. Please refresh the page.", 
        variant: "destructive" 
      });
      return;
    }
    setSaving("email");

    try {
      const payload = {
        tenant_id: tenantId,
        sender_name: senderName,
        from_address: fromAddress,
        reply_to_address: replyToAddress,
        smtp_host: smtpHost || null,
        smtp_port: smtpPort,
        smtp_username: smtpUsername || null,
        smtp_password: smtpPassword || null,
        updated_at: new Date().toISOString(),
      };

      console.log("[saveEmailSettings] tenantId:", tenantId);
      console.log("[saveEmailSettings] payload:", payload);

      const changes = detectChanges(emailSettings || {}, payload);
      const isCreate = !emailSettings;

      console.log("[saveEmailSettings] changes:", changes, "isCreate:", isCreate);

      if (Object.keys(changes).length === 0) {
        toast({ title: "No changes", description: "No changes were detected to save." });
        setSaving(null);
        return;
      }

      const { data, error } = await supabase
        .from("ai_settings_email")
        .upsert(payload, { onConflict: "tenant_id" })
        .select();

      console.log("[saveEmailSettings] upsert result:", { data, error });

      if (error) {
        console.error("[saveEmailSettings] upsert error:", error);
        throw error;
      }

      await logAuditEntry('email', changes, isCreate);

      setEmailSettings({ ...payload, updated_at: payload.updated_at });
      
      const changesList = formatChangesList(changes);
      toast({ 
        title: "✓ Email Settings Updated", 
        description: (
          <div className="mt-2 space-y-1">
            {changesList.map((change, i) => (
              <div key={i} className="text-sm">• {change}</div>
            ))}
            <div className="text-xs text-muted-foreground mt-2">
              Saved at {format(new Date(), "h:mm a")}
            </div>
          </div>
        ),
      });
    } catch (error: any) {
      console.error("[saveEmailSettings] error:", error);
      toast({ 
        title: "Error saving email settings", 
        description: error.message || "An unexpected error occurred", 
        variant: "destructive" 
      });
    } finally {
      setSaving(null);
    }
  };

  const saveLinkedInSettings = async () => {
    if (!tenantId) return;
    setSaving("linkedin");

    try {
      const payload = {
        tenant_id: tenantId,
        linkedin_profile_url: linkedinProfileUrl,
        daily_connection_limit: dailyConnectionLimit,
        daily_message_limit: dailyMessageLimit,
        updated_at: new Date().toISOString(),
      };

      const changes = detectChanges(linkedinSettings || {}, payload);
      const isCreate = !linkedinSettings;

      if (Object.keys(changes).length === 0) {
        toast({ title: "No changes", description: "No changes were detected to save." });
        setSaving(null);
        return;
      }

      const { error } = await supabase
        .from("ai_settings_linkedin")
        .upsert(payload, { onConflict: "tenant_id" });

      if (error) throw error;

      await logAuditEntry('linkedin', changes, isCreate);

      setLinkedinSettings({ ...payload, updated_at: payload.updated_at });
      
      const changesList = formatChangesList(changes);
      toast({ 
        title: "✓ LinkedIn Settings Updated", 
        description: (
          <div className="mt-2 space-y-1">
            {changesList.map((change, i) => (
              <div key={i} className="text-sm">• {change}</div>
            ))}
            <div className="text-xs text-muted-foreground mt-2">
              Saved at {format(new Date(), "h:mm a")}
            </div>
          </div>
        ),
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const saveCalendarSettings = async () => {
    if (!tenantId) return;
    setSaving("calendar");

    try {
      const payload = {
        tenant_id: tenantId,
        calendar_provider: calendarProvider,
        booking_url: bookingUrl,
        updated_at: new Date().toISOString(),
      };

      const changes = detectChanges(calendarSettings || {}, payload);
      const isCreate = !calendarSettings;

      if (Object.keys(changes).length === 0) {
        toast({ title: "No changes", description: "No changes were detected to save." });
        setSaving(null);
        return;
      }

      const { error } = await supabase
        .from("ai_settings_calendar")
        .upsert(payload, { onConflict: "tenant_id" });

      if (error) throw error;

      await logAuditEntry('calendar', changes, isCreate);

      setCalendarSettings({ ...payload, updated_at: payload.updated_at });
      
      const changesList = formatChangesList(changes);
      toast({ 
        title: "✓ Calendar Settings Updated", 
        description: (
          <div className="mt-2 space-y-1">
            {changesList.map((change, i) => (
              <div key={i} className="text-sm">• {change}</div>
            ))}
            <div className="text-xs text-muted-foreground mt-2">
              Saved at {format(new Date(), "h:mm a")}
            </div>
          </div>
        ),
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const saveCRMSettings = async () => {
    if (!tenantId) return;
    setSaving("crm");

    try {
      const payload = {
        tenant_id: tenantId,
        inbound_webhook_url: inboundWebhookUrl || null,
        outbound_webhook_url: outboundWebhookUrl || null,
        updated_at: new Date().toISOString(),
      };

      const changes = detectChanges(crmSettings || {}, payload);
      const isCreate = !crmSettings;

      if (Object.keys(changes).length === 0) {
        toast({ title: "No changes", description: "No changes were detected to save." });
        setSaving(null);
        return;
      }

      const { error } = await supabase
        .from("ai_settings_crm_webhooks")
        .upsert(payload, { onConflict: "tenant_id" });

      if (error) throw error;

      await logAuditEntry('crm', changes, isCreate);

      setCrmSettings({ ...payload, updated_at: payload.updated_at });
      
      const changesList = formatChangesList(changes);
      toast({ 
        title: "✓ CRM Webhook Settings Updated", 
        description: (
          <div className="mt-2 space-y-1">
            {changesList.map((change, i) => (
              <div key={i} className="text-sm">• {change}</div>
            ))}
            <div className="text-xs text-muted-foreground mt-2">
              Saved at {format(new Date(), "h:mm a")}
            </div>
          </div>
        ),
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const saveDomainSettings = async () => {
    if (!tenantId) return;
    setSaving("domain");

    try {
      const payload = {
        tenant_id: tenantId,
        domain: domain,
        cname_verified: domainSettings?.cname_verified || false,
        updated_at: new Date().toISOString(),
      };

      const changes = detectChanges(domainSettings || {}, payload);
      const isCreate = !domainSettings;

      if (Object.keys(changes).length === 0) {
        toast({ title: "No changes", description: "No changes were detected to save." });
        setSaving(null);
        return;
      }

      const { error } = await supabase
        .from("ai_settings_domain")
        .upsert(payload, { onConflict: "tenant_id" });

      if (error) throw error;

      await logAuditEntry('domain', changes, isCreate);

      setDomainSettings({ ...payload, updated_at: payload.updated_at });
      
      const changesList = formatChangesList(changes);
      toast({ 
        title: "✓ Domain Settings Updated", 
        description: (
          <div className="mt-2 space-y-1">
            {changesList.map((change, i) => (
              <div key={i} className="text-sm">• {change}</div>
            ))}
            <div className="text-xs text-muted-foreground mt-2">
              Saved at {format(new Date(), "h:mm a")}
            </div>
          </div>
        ),
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const saveVoiceSettings = async () => {
    if (!tenantId) return;
    setSaving("voice");

    try {
      // Determine if voice is connected based on having valid API keys
      const hasVoiceKeys = !!(vapiPrivateKey || elevenlabsApiKey);
      
      const payload = {
        tenant_id: tenantId,
        vapi_public_key: vapiPublicKey || null,
        vapi_private_key: vapiPrivateKey || null,
        elevenlabs_api_key: elevenlabsApiKey || null,
        default_vapi_assistant_id: defaultVapiAssistantId || null,
        default_elevenlabs_voice_id: defaultElevenlabsVoiceId || null,
        elevenlabs_model: elevenlabsModel || null,
        is_connected: hasVoiceKeys, // Set connected status based on key presence
        updated_at: new Date().toISOString(),
      };

      const changes = detectChanges(voiceSettings || {}, payload);
      const isCreate = !voiceSettings;

      if (Object.keys(changes).length === 0) {
        toast({ title: "No changes", description: "No changes were detected to save." });
        setSaving(null);
        return;
      }

      const { error } = await supabase
        .from("ai_settings_voice")
        .upsert(payload, { onConflict: "tenant_id" });

      if (error) throw error;

      await logAuditEntry('voice', changes, isCreate);

      setVoiceSettings({ ...payload, updated_at: payload.updated_at });
      
      const changesList = formatChangesList(changes);
      toast({ 
        title: "✓ Voice Settings Updated", 
        description: (
          <div className="mt-2 space-y-1">
            {changesList.map((change, i) => (
              <div key={i} className="text-sm">• {change}</div>
            ))}
            <div className="text-xs text-muted-foreground mt-2">
              Saved at {format(new Date(), "h:mm a")}
            </div>
          </div>
        ),
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const saveStripeSettings = async () => {
    if (!tenantId) return;
    setSaving("stripe");

    try {
      const payload = {
        tenant_id: tenantId,
        stripe_publishable_key: stripePublishableKey,
        stripe_secret_key_hint: stripeSecretKeyHint,
        webhook_secret_hint: stripeWebhookSecretHint,
        account_name: stripeAccountName,
        is_connected: stripeIsConnected,
        updated_at: new Date().toISOString(),
      };

      const changes = detectChanges(stripeSettings || {}, payload);
      const isCreate = !stripeSettings;

      if (Object.keys(changes).length === 0) {
        toast({ title: "No changes", description: "No changes were detected to save." });
        setSaving(null);
        return;
      }

      const { error } = await supabase
        .from("ai_settings_stripe")
        .upsert(payload, { onConflict: "tenant_id" });

      if (error) throw error;

      await logAuditEntry('stripe', changes, isCreate);

      setStripeSettings({ ...payload, updated_at: payload.updated_at });
      
      const changesList = formatChangesList(changes);
      toast({ 
        title: "✓ Stripe Settings Updated", 
        description: (
          <div className="mt-2 space-y-1">
            {changesList.map((change, i) => (
              <div key={i} className="text-sm">• {change}</div>
            ))}
            <div className="text-xs text-muted-foreground mt-2">
              Saved at {format(new Date(), "h:mm a")}
            </div>
          </div>
        ),
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const saveSocialIntegration = async (platform: string) => {
    if (!tenantId || !userId) return;
    setSaving(`social-${platform}`);

    try {
      const tokenData = socialTokens[platform] || { token: "", accountName: "" };
      
      // Check if integration already exists
      const existing = socialIntegrations.find(i => i.platform === platform);
      
      const payload = {
        workspace_id: tenantId,
        user_id: userId,
        platform,
        access_token: tokenData.token,
        account_name: tokenData.accountName,
        is_active: !!tokenData.token,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (existing) {
        const result = await supabase
          .from("social_integrations")
          .update(payload)
          .eq("id", existing.id);
        error = result.error;
      } else {
        const result = await supabase
          .from("social_integrations")
          .insert(payload);
        error = result.error;
      }

      if (error) throw error;

      await logAuditEntry('social', { 
        [`${platform}_access_token`]: { old: existing?.access_token ? '••••••••' : null, new: tokenData.token ? '••••••••' : null },
        [`${platform}_account_name`]: { old: existing?.account_name, new: tokenData.accountName }
      }, !existing);

      // Refresh social integrations
      const { data: refreshed } = await supabase
        .from("social_integrations")
        .select("*")
        .eq("workspace_id", tenantId);
      
      if (refreshed) {
        setSocialIntegrations(refreshed as SocialIntegration[]);
      }
      
      toast({ 
        title: `✓ ${platform.charAt(0).toUpperCase() + platform.slice(1)} Settings Saved`, 
        description: `Connection ${tokenData.token ? 'configured' : 'cleared'}`,
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const loadVapiAssistants = async () => {
    if (!vapiPrivateKey) {
      toast({ title: "Missing Key", description: "Please save your VAPI Private Key first", variant: "destructive" });
      return;
    }
    
    setLoadingAssistants(true);
    try {
      const { data, error } = await supabase.functions.invoke('vapi-list-assistants');
      if (error) throw error;
      if (data?.assistants) {
        setVapiAssistants(data.assistants);
        toast({ title: "Loaded", description: `Found ${data.assistants.length} VAPI assistants` });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoadingAssistants(false);
    }
  };

  const createVapiAssistant = async () => {
    if (!newAssistantName.trim()) {
      toast({ title: "Error", description: "Please enter an assistant name", variant: "destructive" });
      return;
    }
    
    setCreatingAssistant(true);
    try {
      const { data, error } = await supabase.functions.invoke('vapi-manage-assistant', {
        body: {
          action: 'create',
          assistantData: {
            name: newAssistantName,
            firstMessage: "Hello! How can I help you today?",
            model: {
              provider: "openai",
              model: "gpt-4o",
              messages: [{ role: "system", content: newAssistantPrompt }]
            },
            voice: {
              provider: "11labs",
              voiceId: defaultElevenlabsVoiceId,
              model: elevenlabsModel
            }
          }
        }
      });
      
      if (error) throw error;
      
      toast({ title: "Success", description: `Assistant "${newAssistantName}" created successfully` });
      setNewAssistantName("");
      setNewAssistantPrompt("You are a helpful AI assistant.");
      
      // Reload assistants list
      await loadVapiAssistants();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCreatingAssistant(false);
    }
  };

  const deleteVapiAssistant = async (assistantId: string) => {
    try {
      const { error } = await supabase.functions.invoke('vapi-manage-assistant', {
        body: { action: 'delete', assistantId }
      });
      
      if (error) throw error;
      
      setVapiAssistants(prev => prev.filter(a => a.id !== assistantId));
      if (defaultVapiAssistantId === assistantId) {
        setDefaultVapiAssistantId("");
      }
      toast({ title: "Deleted", description: "Assistant deleted successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Value copied to clipboard" });
  };

  const formatUpdatedAt = (date: string | null) => {
    if (!date) return null;
    return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
  };

  // Test connection functions
  const testSmtpConnection = async () => {
    if (!smtpHost || !smtpPort) {
      toast({ title: "Missing Configuration", description: "Please enter SMTP host and port", variant: "destructive" });
      return;
    }
    
    setTestingSmtp(true);
    setSmtpTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-integration', {
        body: {
          integrationType: 'smtp',
          config: { host: smtpHost, port: smtpPort, username: smtpUsername, password: smtpPassword }
        }
      });
      
      if (error) throw error;
      setSmtpTestResult({ success: data.success, message: data.message });
      
      if (data.success) {
        toast({ title: "SMTP Test Passed", description: data.message });
      } else {
        toast({ title: "SMTP Test Failed", description: data.details || data.message, variant: "destructive" });
      }
    } catch (error: any) {
      const message = error.message || "Connection test failed";
      setSmtpTestResult({ success: false, message });
      toast({ title: "Test Failed", description: message, variant: "destructive" });
    } finally {
      setTestingSmtp(false);
    }
  };

  const testCalendarUrl = async () => {
    if (!bookingUrl) {
      toast({ title: "Missing URL", description: "Please enter a booking URL", variant: "destructive" });
      return;
    }
    
    setTestingCalendar(true);
    setCalendarTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-integration', {
        body: { integrationType: 'calendar', config: { bookingUrl } }
      });
      
      if (error) throw error;
      setCalendarTestResult({ success: data.success, message: data.message });
      
      if (data.success) {
        toast({ title: "Calendar Test Passed", description: data.message });
      } else {
        toast({ title: "Calendar Test Failed", description: data.details || data.message, variant: "destructive" });
      }
    } catch (error: any) {
      const message = error.message || "Validation failed";
      setCalendarTestResult({ success: false, message });
      toast({ title: "Test Failed", description: message, variant: "destructive" });
    } finally {
      setTestingCalendar(false);
    }
  };

  const testStripeConnection = async () => {
    if (!stripePublishableKey) {
      toast({ title: "Missing Key", description: "Please enter a Stripe publishable key", variant: "destructive" });
      return;
    }
    
    setTestingStripe(true);
    setStripeTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-integration', {
        body: { integrationType: 'stripe', config: { publishableKey: stripePublishableKey, secretKey: stripeSecretKeyHint } }
      });
      
      if (error) throw error;
      setStripeTestResult({ success: data.success, message: data.message });
      
      if (data.success) {
        toast({ title: "Stripe Test Passed", description: data.message });
      } else {
        toast({ title: "Stripe Test Failed", description: data.details || data.message, variant: "destructive" });
      }
    } catch (error: any) {
      const message = error.message || "Validation failed";
      setStripeTestResult({ success: false, message });
      toast({ title: "Test Failed", description: message, variant: "destructive" });
    } finally {
      setTestingStripe(false);
    }
  };

  const testLinkedInProfile = async () => {
    if (!linkedinProfileUrl) {
      toast({ title: "Missing URL", description: "Please enter your LinkedIn profile URL", variant: "destructive" });
      return;
    }
    
    setTestingLinkedIn(true);
    setLinkedInTestResult(null);
    
    try {
      // Validate URL format
      const url = new URL(linkedinProfileUrl);
      const isLinkedIn = url.hostname.includes('linkedin.com');
      const hasProfile = url.pathname.includes('/in/') || url.pathname.includes('/company/');
      
      if (!isLinkedIn) {
        setLinkedInTestResult({ success: false, message: "Not a valid LinkedIn URL" });
        toast({ title: "Invalid URL", description: "Please enter a linkedin.com URL", variant: "destructive" });
        return;
      }

      if (!hasProfile) {
        setLinkedInTestResult({ success: false, message: "URL should point to a profile (/in/) or company (/company/)" });
        toast({ title: "Invalid Profile URL", description: "URL should contain /in/yourname or /company/name", variant: "destructive" });
        return;
      }

      setLinkedInTestResult({ success: true, message: `Valid LinkedIn profile URL detected` });
      toast({ title: "LinkedIn URL Valid", description: "Profile URL format is correct" });
    } catch (error: any) {
      setLinkedInTestResult({ success: false, message: "Invalid URL format" });
      toast({ title: "Invalid URL", description: "Please enter a valid URL", variant: "destructive" });
    } finally {
      setTestingLinkedIn(false);
    }
  };

  const testVapiConnection = async () => {
    if (!vapiPrivateKey) {
      toast({ title: "Missing Key", description: "Please enter your VAPI Private Key", variant: "destructive" });
      return;
    }
    
    setTestingVapi(true);
    setVapiTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('vapi-list-assistants');
      
      if (error) throw error;
      
      if (data?.assistants) {
        setVapiTestResult({ success: true, message: `Connected - ${data.assistants.length} assistants found` });
        setVapiAssistants(data.assistants);
        toast({ title: "VAPI Connected", description: `Found ${data.assistants.length} assistants` });
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      const message = error.message || "Connection failed";
      setVapiTestResult({ success: false, message });
      toast({ title: "VAPI Connection Failed", description: message, variant: "destructive" });
    } finally {
      setTestingVapi(false);
    }
  };

  const testElevenLabsConnection = async () => {
    if (!elevenlabsApiKey) {
      toast({ title: "Missing Key", description: "Please enter your ElevenLabs API Key", variant: "destructive" });
      return;
    }
    
    setTestingElevenLabs(true);
    setElevenLabsTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-test-connection', {
        body: { tenantId }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        setElevenLabsTestResult({ success: true, message: data.message });
        toast({ title: "ElevenLabs Connected", description: data.message });
      } else {
        throw new Error(data?.error || data?.message || "Connection failed");
      }
    } catch (error: any) {
      const message = error.message || "Connection failed";
      setElevenLabsTestResult({ success: false, message });
      toast({ title: "ElevenLabs Connection Failed", description: message, variant: "destructive" });
    } finally {
      setTestingElevenLabs(false);
    }
  };

  const testDomainDns = async () => {
    if (!domain) {
      toast({ title: "Missing Domain", description: "Please enter a domain", variant: "destructive" });
      return;
    }
    
    setTestingDomain(true);
    setDomainTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('verify-domain-dns', {
        body: { domain, tenantId }
      });
      
      if (error) throw error;
      
      setDomainTestResult({ success: data.verified, message: data.message });
      
      if (data.verified) {
        // Update local state to reflect verification
        setDomainSettings(prev => prev ? { ...prev, cname_verified: true } : prev);
        toast({ title: "Domain Verified", description: data.message });
      } else {
        toast({ title: "Domain Not Verified", description: data.message, variant: "destructive" });
      }
    } catch (error: any) {
      const message = error.message || "Verification failed";
      setDomainTestResult({ success: false, message });
      toast({ title: "Verification Failed", description: message, variant: "destructive" });
    } finally {
      setTestingDomain(false);
    }
  };

  const testSocialConnection = async (platform: string) => {
    const tokenData = socialTokens[platform];
    if (!tokenData?.token) {
      toast({ title: "Missing Token", description: `Please enter an access token for ${platform}`, variant: "destructive" });
      return;
    }
    
    setTestingSocial(platform);
    setSocialTestResults(prev => ({ ...prev, [platform]: { success: false, message: "Testing..." } }));
    
    try {
      // First save the token, then test
      await saveSocialIntegration(platform);
      
      const { data, error } = await supabase.functions.invoke('social-test-connection', {
        body: { platform }
      });
      
      if (error) throw error;
      
      const result = { success: data.success, message: data.message || data.error };
      setSocialTestResults(prev => ({ ...prev, [platform]: result }));
      
      if (data.success) {
        // Refresh integrations to get updated account info
        const { data: refreshed } = await supabase
          .from("social_integrations")
          .select("*")
          .eq("workspace_id", tenantId);
        
        if (refreshed) {
          setSocialIntegrations(refreshed as SocialIntegration[]);
        }
        toast({ title: `${platform} Connected`, description: data.message });
      } else {
        toast({ title: `${platform} Connection Failed`, description: data.error || data.message, variant: "destructive" });
      }
    } catch (error: any) {
      const message = error.message || "Connection test failed";
      setSocialTestResults(prev => ({ ...prev, [platform]: { success: false, message } }));
      toast({ title: "Test Failed", description: message, variant: "destructive" });
    } finally {
      setTestingSocial(null);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex flex-col bg-background">
          <NavBar />
          <main className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </main>
          <Footer />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-background">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/settings")}
              className="mb-4 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
            <div className="flex items-center gap-3 mb-2">
              <Settings className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Integrations</h1>
            </div>
            <p className="text-muted-foreground">
              Configure your email, social platforms, calendar, CRM, domain, voice, and Stripe settings for campaigns.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex lg:flex-wrap">
                  <TabsTrigger value="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span className="hidden sm:inline">Email</span>
                  </TabsTrigger>
                  <TabsTrigger value="linkedin" className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4" />
                    <span className="hidden sm:inline">LinkedIn</span>
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="hidden sm:inline">Calendar</span>
                  </TabsTrigger>
                  <TabsTrigger value="crm" className="flex items-center gap-2">
                    <Webhook className="h-4 w-4" />
                    <span className="hidden sm:inline">CRM</span>
                  </TabsTrigger>
                  <TabsTrigger value="domain" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <span className="hidden sm:inline">Domain</span>
                  </TabsTrigger>
                  <TabsTrigger value="voice" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span className="hidden sm:inline">Voice</span>
                  </TabsTrigger>
                  <TabsTrigger value="stripe" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    <span className="hidden sm:inline">Stripe</span>
                  </TabsTrigger>
                  <TabsTrigger value="social" className="flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Social</span>
                  </TabsTrigger>
                </TabsList>

                {/* Email Tab */}
                <TabsContent value="email">
                  {/* Show wizard for first-time setup or when explicitly requested */}
                  {showEmailWizard && tenantId ? (
                    <EmailSetupWizard
                      workspaceId={tenantId}
                      onComplete={() => {
                        setShowEmailWizard(false);
                        loadAllSettings();
                      }}
                      onSkip={() => setShowEmailWizard(false)}
                    />
                  ) : (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Mail className="h-5 w-5 text-primary" />
                              Email Configuration
                            </CardTitle>
                            <CardDescription>
                              Configure how emails are sent and where replies go
                            </CardDescription>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowEmailWizard(true)}
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Setup Wizard
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Quick Setup Banner for Gmail */}
                        {!gmailConnected && emailMethod !== "gmail" && (
                          <div className="p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
                            <div className="flex items-start gap-4">
                              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                <svg className="h-5 w-5" viewBox="0 0 24 24">
                                  <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                                </svg>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium">Quick Setup: Connect Gmail</h4>
                                  <Badge variant="secondary" className="text-xs">Recommended</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-3">
                                  One-click connection. Better deliverability. Emails appear in your sent folder.
                                </p>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setEmailMethod("gmail");
                                    handleConnectGmail();
                                  }}
                                  disabled={gmailConnecting}
                                >
                                  {gmailConnecting ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Connecting...
                                    </>
                                  ) : (
                                    "Connect Gmail"
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Email Method Selection */}
                        <div className="space-y-3">
                          <Label className="flex items-center gap-2">
                            Email Delivery Method
                            <Badge variant="outline" className="text-xs font-normal">Required</Badge>
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Choose how emails will be sent from your outbound campaigns.
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <button
                              type="button"
                              onClick={() => setEmailMethod("gmail")}
                              className={`p-4 rounded-lg border-2 text-left transition-all relative ${
                                emailMethod === "gmail" 
                                  ? "border-primary bg-primary/5" 
                                  : "border-border hover:border-muted-foreground/50"
                              }`}
                            >
                              <Badge className="absolute -top-2 right-2 bg-green-500 text-xs">Best</Badge>
                              <div className="font-medium">Gmail OAuth</div>
                              <p className="text-xs text-muted-foreground mt-1">
                                One-click connection. Best deliverability.
                              </p>
                              {gmailConnected && emailMethod === "gmail" && (
                                <Badge className="mt-2 bg-green-500/10 text-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Connected
                                </Badge>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEmailMethod("resend")}
                              className={`p-4 rounded-lg border-2 text-left transition-all ${
                                emailMethod === "resend" 
                                  ? "border-primary bg-primary/5" 
                                  : "border-border hover:border-muted-foreground/50"
                              }`}
                            >
                              <div className="font-medium">Resend</div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Send from your own domain
                              </p>
                              {emailMethod === "resend" && (
                                <Badge className="mt-2" variant="outline">Active</Badge>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEmailMethod("smtp")}
                              className={`p-4 rounded-lg border-2 text-left transition-all ${
                                emailMethod === "smtp" 
                                  ? "border-primary bg-primary/5" 
                                  : "border-border hover:border-muted-foreground/50"
                              }`}
                            >
                              <div className="font-medium">Custom SMTP</div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Your own mail server
                              </p>
                              {smtpTestResult?.success && emailMethod === "smtp" && (
                                <Badge className="mt-2 bg-green-500/10 text-green-600">Verified</Badge>
                              )}
                            </button>
                          </div>
                        </div>

                        <Separator />

                        {/* Sender Identity Section */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">Sender Identity</h3>
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="sender-name">Sender Name</Label>
                              <Input
                                id="sender-name"
                                placeholder="e.g., John from Acme"
                                value={senderName}
                                onChange={(e) => setSenderName(e.target.value)}
                              />
                              <p className="text-xs text-muted-foreground">
                                How recipients see you in their inbox
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="from-address">From Address</Label>
                              <Input
                                id="from-address"
                                type="email"
                                placeholder="e.g., john@company.com"
                                value={fromAddress}
                                onChange={(e) => setFromAddress(e.target.value)}
                                disabled={emailMethod === "gmail" && gmailConnected}
                              />
                              <p className="text-xs text-muted-foreground">
                                {emailMethod === "gmail" && gmailConnected 
                                  ? "Using your Gmail address" 
                                  : "The address emails are sent from"}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Reply-To Section - CRITICAL */}
                        <div className="space-y-4 p-4 rounded-lg border-2 border-amber-500/30 bg-amber-500/5">
                          <div className="flex items-center gap-2">
                            <Reply className="h-5 w-5 text-amber-600" />
                            <h3 className="font-medium text-amber-700">Where Do Replies Go?</h3>
                            <Badge variant="outline" className="text-amber-600 border-amber-500">Critical</Badge>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="reply-to" className="text-amber-700">Reply-To Address</Label>
                            <Input
                              id="reply-to"
                              type="email"
                              placeholder="e.g., replies@company.com"
                              value={replyToAddress}
                              onChange={(e) => setReplyToAddress(e.target.value)}
                              className="border-amber-300 focus:ring-amber-500"
                            />
                            <div className="flex items-start gap-2 text-sm text-amber-700">
                              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                              <p>
                                <strong>All customer replies</strong> will be sent to this address. 
                                Make sure this is an inbox you actively monitor!
                              </p>
                            </div>
                          </div>
                          
                          {/* Visual Email Flow Diagram */}
                          <EmailReplyToExplainer
                            fromAddress={fromAddress}
                            replyToAddress={replyToAddress}
                            senderName={senderName}
                          />
                        </div>

                        {/* Gmail OAuth Connection */}
                        {emailMethod === "gmail" && (
                          <div className="space-y-3">
                            <Separator className="mb-4" />
                            <Label>Gmail Connection</Label>
                            
                            {gmailConnected ? (
                              <div className="flex items-center justify-between p-4 bg-green-500/5 border border-green-500/30 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm text-green-700">Gmail Connected</p>
                                    <p className="text-sm text-green-600">{gmailEmail}</p>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleDisconnectGmail}
                                  disabled={gmailDisconnecting}
                                >
                                  {gmailDisconnecting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <LogOut className="h-4 w-4 mr-2" />
                                      Disconnect
                                    </>
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <Button
                                onClick={handleConnectGmail}
                                disabled={gmailConnecting}
                                className="w-full sm:w-auto"
                              >
                                {gmailConnecting ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Connecting...
                                  </>
                                ) : (
                                  <>
                                    <Mail className="h-4 w-4 mr-2" />
                                    Connect Gmail Account
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Domain Verification - For Resend */}
                        {emailMethod === "resend" && fromAddress && (
                          <div className="space-y-3">
                            <Separator className="mb-4" />
                            <div className="flex items-center gap-2">
                              <Globe className="h-5 w-5 text-primary" />
                              <h3 className="font-medium">Domain Verification</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Verify your sending domain for better deliverability
                            </p>
                            <DomainVerificationHelper
                              domain={fromAddress.split("@")[1] || ""}
                              emailMethod={emailMethod}
                              isGmailConnected={gmailConnected}
                            />
                          </div>
                        )}

                        {/* SMTP Settings */}
                        {emailMethod === "smtp" && (
                          <div className="space-y-4">
                            <Separator className="mb-4" />
                            <h3 className="font-medium">SMTP Server Settings</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="smtp-host">SMTP Host</Label>
                                <Input
                                  id="smtp-host"
                                  placeholder="smtp.example.com"
                                  value={smtpHost}
                                  onChange={(e) => setSmtpHost(e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="smtp-port">SMTP Port</Label>
                                <Input
                                  id="smtp-port"
                                  type="number"
                                  placeholder="587"
                                  value={smtpPort || ""}
                                  onChange={(e) => setSmtpPort(e.target.value ? parseInt(e.target.value) : null)}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="smtp-username">SMTP Username</Label>
                                <Input
                                  id="smtp-username"
                                  placeholder="username"
                                  value={smtpUsername}
                                  onChange={(e) => setSmtpUsername(e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="smtp-password">SMTP Password</Label>
                                <Input
                                  id="smtp-password"
                                  type="password"
                                  placeholder="••••••••"
                                  value={smtpPassword}
                                  onChange={(e) => setSmtpPassword(e.target.value)}
                                />
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              onClick={testSmtpConnection}
                              disabled={testingSmtp}
                            >
                              {testingSmtp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                              Test SMTP Connection
                            </Button>
                            {smtpTestResult && (
                              <div className={`p-3 rounded-lg text-sm ${smtpTestResult.success ? "bg-green-500/10 text-green-700" : "bg-destructive/10 text-destructive"}`}>
                                {smtpTestResult.message}
                              </div>
                            )}
                          </div>
                        )}

                        <Separator />

                        <div className="flex items-center justify-between">
                          <div>
                            {emailSettings?.updated_at && (
                              <p className="text-sm text-muted-foreground">
                                Last updated: {formatUpdatedAt(emailSettings.updated_at)}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log("[ui] Save Email Settings click");
                              void saveEmailSettings();
                            }}
                            disabled={saving === "email"}
                          >
                            {saving === "email" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Email Settings
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* LinkedIn Tab */}
                <TabsContent value="linkedin">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                        LinkedIn Configuration
                      </CardTitle>
                      <CardDescription>
                        Configure your LinkedIn profile and daily outreach limits.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="linkedin-url">LinkedIn Profile URL *</Label>
                        <Input
                          id="linkedin-url"
                          placeholder="https://www.linkedin.com/in/yourprofile"
                          value={linkedinProfileUrl}
                          onChange={(e) => setLinkedinProfileUrl(e.target.value)}
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={testLinkedInProfile}
                            disabled={testingLinkedIn || !linkedinProfileUrl}
                          >
                            {testingLinkedIn ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            Validate URL
                          </Button>
                          {linkedInTestResult && (
                            <span className={`text-sm ${linkedInTestResult.success ? "text-green-600" : "text-destructive"}`}>
                              {linkedInTestResult.success ? "✓ " : "✕ "}{linkedInTestResult.message}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="conn-limit">Daily Connection Limit</Label>
                          <Input
                            id="conn-limit"
                            type="number"
                            min={1}
                            max={100}
                            value={dailyConnectionLimit}
                            onChange={(e) => setDailyConnectionLimit(parseInt(e.target.value) || 20)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="msg-limit">Daily Message Limit</Label>
                          <Input
                            id="msg-limit"
                            type="number"
                            min={1}
                            max={150}
                            value={dailyMessageLimit}
                            onChange={(e) => setDailyMessageLimit(parseInt(e.target.value) || 50)}
                          />
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">LinkedIn Best Practices</p>
                        <p>LinkedIn recommends ~20–25 connection requests per day and ~50–75 messages per day to avoid account restrictions.</p>
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div>
                          {linkedinSettings?.updated_at && (
                            <p className="text-sm text-muted-foreground">
                              Last updated: {formatUpdatedAt(linkedinSettings.updated_at)}
                            </p>
                          )}
                        </div>
                        <Button onClick={saveLinkedInSettings} disabled={saving === "linkedin"}>
                          {saving === "linkedin" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Save LinkedIn Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Calendar Tab */}
                <TabsContent value="calendar">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Calendar & Booking
                      </CardTitle>
                      <CardDescription>
                        Configure your meeting booking link for outbound sequences.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cal-provider">Calendar Provider *</Label>
                          <Select value={calendarProvider} onValueChange={setCalendarProvider}>
                            <SelectTrigger id="cal-provider">
                              <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="google">Google Calendar</SelectItem>
                              <SelectItem value="outlook">Microsoft Outlook</SelectItem>
                              <SelectItem value="calendly">Calendly</SelectItem>
                              <SelectItem value="hubspot">HubSpot Meetings</SelectItem>
                              <SelectItem value="cal.com">Cal.com</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="booking-url">Booking URL *</Label>
                          <Input
                            id="booking-url"
                            placeholder="https://calendly.com/yourname/30min"
                            value={bookingUrl}
                            onChange={(e) => setBookingUrl(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          onClick={testCalendarUrl}
                          disabled={testingCalendar || !bookingUrl}
                        >
                          {testingCalendar ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                          Test Booking URL
                        </Button>
                        {calendarTestResult && (
                          <span className={`text-sm ${calendarTestResult.success ? "text-green-600" : "text-destructive"}`}>
                            {calendarTestResult.success ? "✓ " : "✕ "}{calendarTestResult.message}
                          </span>
                        )}
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div>
                          {calendarSettings?.updated_at && (
                            <p className="text-sm text-muted-foreground">
                              Last updated: {formatUpdatedAt(calendarSettings.updated_at)}
                            </p>
                          )}
                        </div>
                        <Button onClick={saveCalendarSettings} disabled={saving === "calendar"}>
                          {saving === "calendar" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Save Calendar Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* CRM Webhooks Tab */}
                <TabsContent value="crm">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Webhook className="h-5 w-5 text-primary" />
                        CRM Webhooks
                      </CardTitle>
                      <CardDescription>
                        Connect your CRM to receive real-time events from your outbound campaigns.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="inbound-webhook">Inbound Webhook URL</Label>
                        <Input
                          id="inbound-webhook"
                          placeholder="https://your-crm.com/webhooks/inbound"
                          value={inboundWebhookUrl}
                          onChange={(e) => setInboundWebhookUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Receives events when leads are captured, qualified, or updated in the system.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="outbound-webhook">Outbound Webhook URL</Label>
                        <Input
                          id="outbound-webhook"
                          placeholder="https://your-crm.com/webhooks/outbound"
                          value={outboundWebhookUrl}
                          onChange={(e) => setOutboundWebhookUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Receives events when emails are sent, opened, clicked, or replied to.
                        </p>
                      </div>

                      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">Webhook Testing</p>
                        <p>After saving your webhook URLs, use a service like <a href="https://webhook.site" target="_blank" rel="noopener noreferrer" className="text-primary underline">webhook.site</a> or <a href="https://requestbin.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">RequestBin</a> to test and debug your webhook endpoints.</p>
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div>
                          {crmSettings?.updated_at && (
                            <p className="text-sm text-muted-foreground">
                              Last updated: {formatUpdatedAt(crmSettings.updated_at)}
                            </p>
                          )}
                        </div>
                        <Button onClick={saveCRMSettings} disabled={saving === "crm"}>
                          {saving === "crm" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Save Webhook Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Domain Tab */}
                <TabsContent value="domain">
                  <DomainSettingsCard 
                    domain={domain}
                    setDomain={setDomain}
                    domainSettings={domainSettings}
                    setDomainSettings={setDomainSettings}
                    tenantId={tenantId}
                    saving={saving}
                    setSaving={setSaving}
                    copyToClipboard={copyToClipboard}
                    formatUpdatedAt={formatUpdatedAt}
                    detectChanges={detectChanges}
                    logAuditEntry={logAuditEntry}
                    formatChangesList={formatChangesList}
                  />
                </TabsContent>

                {/* Voice Tab */}
                <TabsContent value="voice">
                  <div className="space-y-6">
                    {/* VAPI Configuration */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Phone className="h-5 w-5 text-primary" />
                          VAPI Configuration
                        </CardTitle>
                        <CardDescription>
                          Configure your VAPI API keys for AI voice calling.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="vapi-public-key">VAPI Public Key</Label>
                          <Input
                            id="vapi-public-key"
                            placeholder="pk_..."
                            value={vapiPublicKey}
                            onChange={(e) => setVapiPublicKey(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Used for client-side voice interactions
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="vapi-private-key">VAPI Private Key</Label>
                          <Input
                            id="vapi-private-key"
                            type="password"
                            placeholder="sk_..."
                            value={vapiPrivateKey}
                            onChange={(e) => setVapiPrivateKey(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Used for creating and managing assistants
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          onClick={testVapiConnection}
                          disabled={testingVapi || !vapiPrivateKey}
                          className="w-full sm:w-auto"
                        >
                          {testingVapi ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                          Test VAPI Connection
                        </Button>
                        {vapiTestResult && (
                          <div className={`p-3 rounded-lg text-sm ${vapiTestResult.success ? "bg-green-500/10 text-green-700" : "bg-destructive/10 text-destructive"}`}>
                            {vapiTestResult.message}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* ElevenLabs Configuration */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Mic className="h-5 w-5 text-primary" />
                          ElevenLabs Configuration
                        </CardTitle>
                        <CardDescription>
                          Configure ElevenLabs for high-quality voice synthesis.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="elevenlabs-key">ElevenLabs API Key</Label>
                          <Input
                            id="elevenlabs-key"
                            type="password"
                            placeholder="xi_..."
                            value={elevenlabsApiKey}
                            onChange={(e) => setElevenlabsApiKey(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Default Voice</Label>
                            <Select value={defaultElevenlabsVoiceId} onValueChange={setDefaultElevenlabsVoiceId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a voice" />
                              </SelectTrigger>
                              <SelectContent>
                                {ELEVENLABS_VOICES.map(voice => (
                                  <SelectItem key={voice.id} value={voice.id}>
                                    {voice.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Model</Label>
                            <Select value={elevenlabsModel} onValueChange={setElevenlabsModel}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a model" />
                              </SelectTrigger>
                              <SelectContent>
                                {ELEVENLABS_MODELS.map(model => (
                                  <SelectItem key={model.id} value={model.id}>
                                    {model.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          onClick={testElevenLabsConnection}
                          disabled={testingElevenLabs || !elevenlabsApiKey}
                          className="w-full sm:w-auto"
                        >
                          {testingElevenLabs ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                          Test ElevenLabs Connection
                        </Button>
                        {elevenLabsTestResult && (
                          <div className={`p-3 rounded-lg text-sm ${elevenLabsTestResult.success ? "bg-green-500/10 text-green-700" : "bg-destructive/10 text-destructive"}`}>
                            {elevenLabsTestResult.message}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* VAPI Assistant Management */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Settings className="h-5 w-5 text-primary" />
                            VAPI Assistants
                          </span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={loadVapiAssistants}
                            disabled={loadingAssistants || !vapiPrivateKey}
                          >
                            {loadingAssistants ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            <span className="ml-2">Refresh</span>
                          </Button>
                        </CardTitle>
                        <CardDescription>
                          Create and manage AI voice assistants via VAPI API.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Create New Assistant */}
                        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                          <p className="text-sm font-medium">Create New Assistant</p>
                          <div className="grid grid-cols-1 gap-3">
                            <Input
                              placeholder="Assistant Name"
                              value={newAssistantName}
                              onChange={(e) => setNewAssistantName(e.target.value)}
                            />
                            <Input
                              placeholder="System Prompt"
                              value={newAssistantPrompt}
                              onChange={(e) => setNewAssistantPrompt(e.target.value)}
                            />
                            <Button 
                              onClick={createVapiAssistant} 
                              disabled={creatingAssistant || !vapiPrivateKey || !newAssistantName}
                              className="w-full"
                            >
                              {creatingAssistant ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4 mr-2" />
                              )}
                              Create Assistant
                            </Button>
                          </div>
                        </div>

                        {/* Existing Assistants */}
                        {vapiAssistants.length > 0 && (
                          <div className="space-y-2">
                            <Label>Select Default Assistant</Label>
                            {vapiAssistants.map(assistant => (
                              <div 
                                key={assistant.id} 
                                className={`flex items-center justify-between p-3 rounded-lg border ${
                                  defaultVapiAssistantId === assistant.id ? 'border-primary bg-primary/5' : ''
                                }`}
                              >
                                <div 
                                  className="flex-1 cursor-pointer"
                                  onClick={() => setDefaultVapiAssistantId(assistant.id)}
                                >
                                  <p className="font-medium text-sm">{assistant.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {assistant.model || 'gpt-4o'} • {assistant.voice || 'default'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {defaultVapiAssistantId === assistant.id && (
                                    <Badge variant="secondary" className="text-xs">Default</Badge>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteVapiAssistant(assistant.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        {voiceSettings?.updated_at && (
                          <p className="text-sm text-muted-foreground">
                            Last updated: {formatUpdatedAt(voiceSettings.updated_at)}
                          </p>
                        )}
                      </div>
                      <Button onClick={saveVoiceSettings} disabled={saving === "voice"}>
                        {saving === "voice" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Save Voice Settings
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Stripe Tab */}
                <TabsContent value="stripe">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <CreditCard className="h-5 w-5 text-primary" />
                          Stripe Configuration
                        </CardTitle>
                        <CardDescription>
                          Configure your Stripe integration for payments and subscriptions.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-2">
                          <Label htmlFor="stripe-account">Account Name</Label>
                          <Input
                            id="stripe-account"
                            placeholder="My Business Stripe Account"
                            value={stripeAccountName}
                            onChange={(e) => setStripeAccountName(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="stripe-publishable">Publishable Key</Label>
                          <Input
                            id="stripe-publishable"
                            placeholder="pk_live_..."
                            value={stripePublishableKey}
                            onChange={(e) => setStripePublishableKey(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Your Stripe publishable key (starts with pk_live_ or pk_test_)
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="stripe-secret">Secret Key (hint only)</Label>
                          <Input
                            id="stripe-secret"
                            type="password"
                            placeholder="sk_live_...xxxx (last 4 chars for reference)"
                            value={stripeSecretKeyHint}
                            onChange={(e) => setStripeSecretKeyHint(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Store only last 4 characters for reference. Full key should be in secure environment variables.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="stripe-webhook">Webhook Secret (hint only)</Label>
                          <Input
                            id="stripe-webhook"
                            type="password"
                            placeholder="whsec_...xxxx (last 4 chars for reference)"
                            value={stripeWebhookSecretHint}
                            onChange={(e) => setStripeWebhookSecretHint(e.target.value)}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="stripe-connected"
                            checked={stripeIsConnected}
                            onChange={(e) => setStripeIsConnected(e.target.checked)}
                            className="h-4 w-4"
                          />
                          <Label htmlFor="stripe-connected" className="cursor-pointer">
                            Mark as connected
                          </Label>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-4">
                          <Button 
                            variant="outline" 
                            onClick={testStripeConnection}
                            disabled={testingStripe || !stripePublishableKey}
                          >
                            {testingStripe ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            Test Stripe Keys
                          </Button>
                          {stripeTestResult && (
                            <span className={`text-sm ${stripeTestResult.success ? "text-green-600" : "text-destructive"}`}>
                              {stripeTestResult.success ? "✓ " : "✕ "}{stripeTestResult.message}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        {stripeSettings?.updated_at && (
                          <p className="text-sm text-muted-foreground">
                            Last updated: {formatUpdatedAt(stripeSettings.updated_at)}
                          </p>
                        )}
                      </div>
                      <Button onClick={saveStripeSettings} disabled={saving === "stripe"}>
                        {saving === "stripe" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Save Stripe Settings
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Social Tab */}
                <TabsContent value="social">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Share2 className="h-5 w-5 text-primary" />
                          Social Platforms
                        </CardTitle>
                        <CardDescription>
                          Configure access tokens for your social media platforms. Need help getting your token?{" "}
                          Use the setup wizard for step-by-step guidance.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {SOCIAL_PLATFORMS.map((platform) => {
                          const IconComponent = platform.icon;
                          const existingIntegration = socialIntegrations.find(i => i.platform === platform.id);
                          const tokenData = socialTokens[platform.id] || { token: "", accountName: "" };
                          
                          return (
                            <div key={platform.id} className="border rounded-lg p-4 space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <IconComponent className="h-5 w-5 text-primary" />
                                  <span className="font-medium">{platform.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {existingIntegration?.is_active && (
                                    <Badge variant="secondary" className="flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                                      Connected
                                    </Badge>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSocialWizardPlatform(platform.id as any);
                                      setSocialWizardOpen(true);
                                    }}
                                  >
                                    <Sparkles className="h-4 w-4 mr-1" />
                                    Setup Wizard
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor={`${platform.id}-token`}>Access Token</Label>
                                  <Input
                                    id={`${platform.id}-token`}
                                    type="password"
                                    placeholder="Enter access token"
                                    value={tokenData.token}
                                    onChange={(e) => setSocialTokens(prev => ({
                                      ...prev,
                                      [platform.id]: { ...tokenData, token: e.target.value }
                                    }))}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`${platform.id}-account`}>Account Name</Label>
                                  <Input
                                    id={`${platform.id}-account`}
                                    placeholder="@username or Page Name"
                                    value={tokenData.accountName}
                                    onChange={(e) => setSocialTokens(prev => ({
                                      ...prev,
                                      [platform.id]: { ...tokenData, accountName: e.target.value }
                                    }))}
                                  />
                                </div>
                              </div>
                              
                              {socialTestResults[platform.id] && (
                                <div className={`p-2 rounded text-sm ${socialTestResults[platform.id].success ? "bg-green-500/10 text-green-700" : "bg-destructive/10 text-destructive"}`}>
                                  {socialTestResults[platform.id].message}
                                </div>
                              )}
                              
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="outline"
                                  size="sm" 
                                  onClick={() => testSocialConnection(platform.id)}
                                  disabled={testingSocial === platform.id || !tokenData.token}
                                >
                                  {testingSocial === platform.id ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                  )}
                                  Test Connection
                                </Button>
                                <Button 
                                  size="sm" 
                                  onClick={() => saveSocialIntegration(platform.id)}
                                  disabled={saving === `social-${platform.id}`}
                                >
                                  {saving === `social-${platform.id}` && (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  )}
                                  Save {platform.name}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Social Token Wizard */}
                  <SocialTokenWizard
                    open={socialWizardOpen}
                    onOpenChange={setSocialWizardOpen}
                    platform={socialWizardPlatform}
                    onComplete={(token, accountName) => {
                      setSocialTokens(prev => ({
                        ...prev,
                        [socialWizardPlatform]: { token, accountName }
                      }));
                      saveSocialIntegration(socialWizardPlatform);
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Change History Sidebar */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <History className="h-5 w-5 text-primary" />
                    Change History
                  </CardTitle>
                  <CardDescription>
                    Recent changes to your integration settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {auditLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No changes recorded yet
                    </p>
                  ) : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="border-b pb-3 last:border-0 last:pb-0">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="secondary" className="text-xs">
                              {SETTINGS_TYPE_LABELS[log.settings_type] || log.settings_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <div className="space-y-1 mt-2">
                            {Object.entries(log.changes).map(([field, { old: oldVal, new: newVal }]) => (
                              <div key={field} className="text-xs">
                                <span className="text-muted-foreground">{FIELD_LABELS[field] || field}:</span>
                                {oldVal === null || oldVal === '' || oldVal === undefined ? (
                                  <span className="ml-1 text-green-600">Set to "{newVal}"</span>
                                ) : (
                                  <span className="ml-1">
                                    <span className="text-red-500 line-through">{String(oldVal)}</span>
                                    <span className="mx-1">→</span>
                                    <span className="text-green-600">{String(newVal)}</span>
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
