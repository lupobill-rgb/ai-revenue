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
  CheckCircle2, XCircle, Copy, ChevronDown, Settings, ArrowLeft
} from "lucide-react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { format } from "date-fns";
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

export default function SettingsIntegrations() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "email");

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

    // Load all settings in parallel
    const [emailRes, linkedinRes, calendarRes, crmRes, domainRes] = await Promise.all([
      supabase.from("ai_settings_email").select("*").eq("tenant_id", user.id).maybeSingle(),
      supabase.from("ai_settings_linkedin").select("*").eq("tenant_id", user.id).maybeSingle(),
      supabase.from("ai_settings_calendar").select("*").eq("tenant_id", user.id).maybeSingle(),
      supabase.from("ai_settings_crm_webhooks").select("*").eq("tenant_id", user.id).maybeSingle(),
      supabase.from("ai_settings_domain").select("*").eq("tenant_id", user.id).maybeSingle(),
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

    setLoading(false);
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

      const { error } = await supabase
        .from("ai_settings_email")
        .upsert(payload, { onConflict: "tenant_id" });

      if (error) throw error;

      setEmailSettings({ ...payload, updated_at: payload.updated_at });
      toast({ title: "Email settings saved", description: "Your email configuration has been updated." });
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

      const { error } = await supabase
        .from("ai_settings_linkedin")
        .upsert(payload, { onConflict: "tenant_id" });

      if (error) throw error;

      setLinkedinSettings({ ...payload, updated_at: payload.updated_at });
      toast({ title: "LinkedIn settings saved", description: "Your LinkedIn configuration has been updated." });
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

      const { error } = await supabase
        .from("ai_settings_calendar")
        .upsert(payload, { onConflict: "tenant_id" });

      if (error) throw error;

      setCalendarSettings({ ...payload, updated_at: payload.updated_at });
      toast({ title: "Calendar settings saved", description: "Your booking configuration has been updated." });
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

      const { error } = await supabase
        .from("ai_settings_crm_webhooks")
        .upsert(payload, { onConflict: "tenant_id" });

      if (error) throw error;

      setCrmSettings({ ...payload, updated_at: payload.updated_at });
      toast({ title: "CRM webhook settings saved", description: "Your webhook configuration has been updated." });
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

      const { error } = await supabase
        .from("ai_settings_domain")
        .upsert(payload, { onConflict: "tenant_id" });

      if (error) throw error;

      setDomainSettings({ ...payload, updated_at: payload.updated_at });
      toast({ title: "Domain settings saved", description: "Your custom domain configuration has been updated." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(null);
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
              Configure your email, LinkedIn, calendar, CRM, and domain settings for outbound campaigns.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
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
          </Tabs>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
