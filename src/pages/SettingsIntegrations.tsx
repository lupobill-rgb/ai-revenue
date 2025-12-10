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
  History, User, Clock, Phone, Mic, RefreshCw, Plus, Trash2
} from "lucide-react";
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
};

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
  const [senderName, setSenderName] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [replyToAddress, setReplyToAddress] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState<number | null>(null);
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpOpen, setSmtpOpen] = useState(false);

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

  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setTenantId(user.id);
    setUserId(user.id);

    // Load all settings and audit logs in parallel
    const [emailRes, linkedinRes, calendarRes, crmRes, domainRes, voiceRes, auditRes] = await Promise.all([
      supabase.from("ai_settings_email").select("*").eq("tenant_id", user.id).maybeSingle(),
      supabase.from("ai_settings_linkedin").select("*").eq("tenant_id", user.id).maybeSingle(),
      supabase.from("ai_settings_calendar").select("*").eq("tenant_id", user.id).maybeSingle(),
      supabase.from("ai_settings_crm_webhooks").select("*").eq("tenant_id", user.id).maybeSingle(),
      supabase.from("ai_settings_domain").select("*").eq("tenant_id", user.id).maybeSingle(),
      supabase.from("ai_settings_voice").select("*").eq("tenant_id", user.id).maybeSingle(),
      supabase.from("integration_audit_log").select("*").eq("tenant_id", user.id).order("created_at", { ascending: false }).limit(20),
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

    // Populate audit logs
    if (auditRes.data) {
      setAuditLogs(auditRes.data as AuditLogEntry[]);
    }

    setLoading(false);
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
    if (!tenantId) return;
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

      const changes = detectChanges(emailSettings || {}, payload);
      const isCreate = !emailSettings;

      if (Object.keys(changes).length === 0) {
        toast({ title: "No changes", description: "No changes were detected to save." });
        setSaving(null);
        return;
      }

      const { error } = await supabase
        .from("ai_settings_email")
        .upsert(payload, { onConflict: "tenant_id" });

      if (error) throw error;

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
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      const payload = {
        tenant_id: tenantId,
        vapi_public_key: vapiPublicKey || null,
        vapi_private_key: vapiPrivateKey || null,
        elevenlabs_api_key: elevenlabsApiKey || null,
        default_vapi_assistant_id: defaultVapiAssistantId || null,
        default_elevenlabs_voice_id: defaultElevenlabsVoiceId || null,
        elevenlabs_model: elevenlabsModel || null,
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
        <main className="flex-1 container mx-auto py-8 px-4">
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
              Configure your email, LinkedIn, calendar, CRM, domain, and voice settings for outbound campaigns.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
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
                </TabsList>

                {/* Email Tab */}
                <TabsContent value="email">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-primary" />
                        Email Configuration
                      </CardTitle>
                      <CardDescription>
                        Configure your outbound email sender identity and optional SMTP settings.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="sender-name">Sender Name *</Label>
                          <Input
                            id="sender-name"
                            placeholder="John from Acme"
                            value={senderName}
                            onChange={(e) => setSenderName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="from-address">From Address *</Label>
                          <Input
                            id="from-address"
                            type="email"
                            placeholder="john@company.com"
                            value={fromAddress}
                            onChange={(e) => setFromAddress(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reply-to">Reply-To Address *</Label>
                        <Input
                          id="reply-to"
                          type="email"
                          placeholder="replies@company.com"
                          value={replyToAddress}
                          onChange={(e) => setReplyToAddress(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Replies to your outbound emails will be sent to this address.
                        </p>
                      </div>

                      <Separator />

                      <Collapsible open={smtpOpen} onOpenChange={setSmtpOpen}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between">
                            <span>Advanced: Custom SMTP Settings</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${smtpOpen ? "rotate-180" : ""}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-4">
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
                        </CollapsibleContent>
                      </Collapsible>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div>
                          {emailSettings?.updated_at && (
                            <p className="text-sm text-muted-foreground">
                              Last updated: {formatUpdatedAt(emailSettings.updated_at)}
                            </p>
                          )}
                        </div>
                        <Button onClick={saveEmailSettings} disabled={saving === "email"}>
                          {saving === "email" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Save Email Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
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
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        Custom Domain
                      </CardTitle>
                      <CardDescription>
                        Use your own domain for landing pages and email tracking links.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="custom-domain">Domain</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="custom-domain"
                            placeholder="campaigns.yourcompany.com"
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                          />
                          {domainSettings?.cname_verified ? (
                            <Badge variant="outline" className="text-green-600 border-green-600 shrink-0">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                            </Badge>
                          ) : domain ? (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-600 shrink-0">
                              <XCircle className="h-3 w-3 mr-1" /> Not Verified
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-medium">DNS Configuration</p>
                        <p className="text-sm text-muted-foreground">
                          Add a CNAME record pointing your subdomain to our servers:
                        </p>
                        <div className="flex items-center gap-2 bg-background rounded border px-3 py-2">
                          <code className="text-sm flex-1">campaigns.ubigrowth.ai</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard("campaigns.ubigrowth.ai")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div>
                          {domainSettings?.updated_at && (
                            <p className="text-sm text-muted-foreground">
                              Last updated: {formatUpdatedAt(domainSettings.updated_at)}
                            </p>
                          )}
                        </div>
                        <Button onClick={saveDomainSettings} disabled={saving === "domain"}>
                          {saving === "domain" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Save Domain Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
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
