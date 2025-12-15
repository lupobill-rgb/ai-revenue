import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Mail, Linkedin, Calendar, Globe, Webhook, Loader2, CheckCircle2, XCircle, Copy, ExternalLink } from "lucide-react";

interface CustomerIntegration {
  id?: string;
  workspace_id: string;
  tenant_id: string;
  email_from_address: string | null;
  email_from_name: string | null;
  email_reply_to: string | null;
  email_domain_verified: boolean;
  linkedin_profile_url: string | null;
  linkedin_daily_connect_limit: number;
  linkedin_daily_message_limit: number;
  calendar_booking_url: string | null;
  calendar_provider: string | null;
  crm_inbound_webhook_url: string | null;
  crm_outbound_webhook_url: string | null;
  crm_webhook_secret: string | null;
  custom_domain: string | null;
  custom_domain_verified: boolean;
}

export function IntegrationsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState<CustomerIntegration | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Form state
  const [emailFromAddress, setEmailFromAddress] = useState("");
  const [emailFromName, setEmailFromName] = useState("");
  const [emailReplyTo, setEmailReplyTo] = useState("");
  const [linkedinProfileUrl, setLinkedinProfileUrl] = useState("");
  const [linkedinConnectLimit, setLinkedinConnectLimit] = useState(20);
  const [linkedinMessageLimit, setLinkedinMessageLimit] = useState(50);
  const [calendarBookingUrl, setCalendarBookingUrl] = useState("");
  const [calendarProvider, setCalendarProvider] = useState("");
  const [crmInboundWebhook, setCrmInboundWebhook] = useState("");
  const [crmOutboundWebhook, setCrmOutboundWebhook] = useState("");
  const [customDomain, setCustomDomain] = useState("");

  useEffect(() => {
    fetchUserAndWorkspace();
  }, []);

  const fetchUserAndWorkspace = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    // Get user's workspace
    const { data: workspaces } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1);

    if (workspaces && workspaces.length > 0) {
      setWorkspaceId(workspaces[0].id);
      fetchIntegration(workspaces[0].id);
    } else {
      // Check workspace_members
      const { data: memberships } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1);

      if (memberships && memberships.length > 0) {
        setWorkspaceId(memberships[0].workspace_id);
        fetchIntegration(memberships[0].workspace_id);
      } else {
        setLoading(false);
      }
    }
  };

  const fetchIntegration = async (wsId: string) => {
    try {
      const { data, error } = await supabase
        .from("customer_integrations")
        .select("*")
        .eq("workspace_id", wsId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setIntegration(data);
        setEmailFromAddress(data.email_from_address || "");
        setEmailFromName(data.email_from_name || "");
        setEmailReplyTo(data.email_reply_to || "");
        setLinkedinProfileUrl(data.linkedin_profile_url || "");
        setLinkedinConnectLimit(data.linkedin_daily_connect_limit || 20);
        setLinkedinMessageLimit(data.linkedin_daily_message_limit || 50);
        setCalendarBookingUrl(data.calendar_booking_url || "");
        setCalendarProvider(data.calendar_provider || "");
        setCrmInboundWebhook(data.crm_inbound_webhook_url || "");
        setCrmOutboundWebhook(data.crm_outbound_webhook_url || "");
        setCustomDomain(data.custom_domain || "");
      }
    } catch (error) {
      console.error("Error fetching integration:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!workspaceId || !userId) return;

    setSaving(true);
    try {
      const payload = {
        workspace_id: workspaceId,
        tenant_id: userId,
        email_from_address: emailFromAddress || null,
        email_from_name: emailFromName || null,
        email_reply_to: emailReplyTo || null,
        linkedin_profile_url: linkedinProfileUrl || null,
        linkedin_daily_connect_limit: linkedinConnectLimit,
        linkedin_daily_message_limit: linkedinMessageLimit,
        calendar_booking_url: calendarBookingUrl || null,
        calendar_provider: calendarProvider || null,
        crm_inbound_webhook_url: crmInboundWebhook || null,
        crm_outbound_webhook_url: crmOutboundWebhook || null,
        custom_domain: customDomain || null,
      };

      if (integration?.id) {
        const { error } = await supabase
          .from("customer_integrations")
          .update(payload)
          .eq("id", integration.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("customer_integrations")
          .insert(payload);
        if (error) throw error;
      }

      toast({
        title: "Settings saved",
        description: "Your integration settings have been updated.",
      });
      
      if (workspaceId) fetchIntegration(workspaceId);
    } catch (error: any) {
      console.error("Error saving integration:", error);
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const [emailProvider, setEmailProvider] = useState("");

  return (
    <div className="space-y-6">
      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Email Settings
          </CardTitle>
          <CardDescription>
            Configure your email sending settings for outbound campaigns. Send emails from your own domain for better deliverability.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email-from-name">Sender Name</Label>
              <Input
                id="email-from-name"
                placeholder="John from Acme"
                value={emailFromName}
                onChange={(e) => setEmailFromName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-from-address">From Address</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="email-from-address"
                  type="email"
                  placeholder="john@company.com"
                  value={emailFromAddress}
                  onChange={(e) => setEmailFromAddress(e.target.value)}
                />
                {integration?.email_domain_verified ? (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                  </Badge>
                ) : emailFromAddress ? (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                    <XCircle className="h-3 w-3 mr-1" /> Unverified
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-reply-to">Reply-To Address</Label>
            <Input
              id="email-reply-to"
              type="email"
              placeholder="replies@company.com"
              value={emailReplyTo}
              onChange={(e) => setEmailReplyTo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Replies to your outbound emails will be sent directly to this address
            </p>
          </div>

          <Separator className="my-4" />

          {/* Email Provider Setup */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email Provider Setup</Label>
              <p className="text-sm text-muted-foreground">
                To send emails from your own domain, you'll need to verify your domain with our email service (Resend). Select your email provider below for specific setup instructions.
              </p>
            </div>

            <Select value={emailProvider} onValueChange={setEmailProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Select your email provider for setup instructions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gmail">Gmail / Google Workspace</SelectItem>
                <SelectItem value="outlook">Outlook.com</SelectItem>
                <SelectItem value="microsoft365">Microsoft 365 / Exchange</SelectItem>
                <SelectItem value="other">Other Provider</SelectItem>
              </SelectContent>
            </Select>

            {emailProvider === "gmail" && (
              <div className="space-y-3 bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
                <div className="flex items-center gap-2">
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="h-4 w-4" />
                  <Label className="text-sm font-medium">Gmail / Google Workspace Setup</Label>
                </div>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Step 1: Add DNS Records to Google Domains or your DNS provider</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                    <li>Go to <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Resend Domains <ExternalLink className="h-3 w-3" /></a> and add your domain</li>
                    <li>Copy the DNS records (SPF, DKIM, DMARC) provided by Resend</li>
                    <li>Go to your <a href="https://domains.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Google Domains <ExternalLink className="h-3 w-3" /></a> or DNS provider</li>
                    <li>Add the TXT records for SPF and DKIM authentication</li>
                    <li>Add the CNAME record for tracking (optional but recommended)</li>
                    <li>Wait 24-48 hours for DNS propagation</li>
                  </ol>
                  <p className="mt-2"><strong>Step 2: Configure Reply Handling</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                    <li>Set your Reply-To address above to your Gmail address</li>
                    <li>Replies will arrive directly in your Gmail inbox</li>
                    <li>Configure a <a href="https://support.google.com/mail/answer/6579?hl=en" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Gmail filter</a> to label/organize campaign replies</li>
                  </ol>
                </div>
              </div>
            )}

            {emailProvider === "outlook" && (
              <div className="space-y-3 bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
                <div className="flex items-center gap-2">
                  <img src="https://outlook.live.com/favicon.ico" alt="Outlook" className="h-4 w-4" />
                  <Label className="text-sm font-medium">Outlook.com Setup</Label>
                </div>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Step 1: Add DNS Records</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                    <li>Go to <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Resend Domains <ExternalLink className="h-3 w-3" /></a> and add your domain</li>
                    <li>Copy the DNS records (SPF, DKIM) provided by Resend</li>
                    <li>Go to your domain registrar's DNS settings</li>
                    <li>Add the TXT records for SPF and DKIM authentication</li>
                    <li>Wait 24-48 hours for DNS propagation</li>
                  </ol>
                  <p className="mt-2"><strong>Step 2: Configure Reply Handling</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                    <li>Set your Reply-To address above to your Outlook email</li>
                    <li>Replies will arrive directly in your Outlook inbox</li>
                    <li>Create <a href="https://support.microsoft.com/en-us/office/manage-email-messages-by-using-rules-c24f5dea-9465-4df4-ad17-a50704d66c59" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Outlook rules</a> to organize campaign replies</li>
                  </ol>
                </div>
              </div>
            )}

            {emailProvider === "microsoft365" && (
              <div className="space-y-3 bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
                <div className="flex items-center gap-2">
                  <img src="https://www.microsoft.com/favicon.ico" alt="Microsoft" className="h-4 w-4" />
                  <Label className="text-sm font-medium">Microsoft 365 / Exchange Setup</Label>
                </div>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Step 1: Add DNS Records in Microsoft 365 Admin Center</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                    <li>Go to <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Resend Domains <ExternalLink className="h-3 w-3" /></a> and add your domain</li>
                    <li>Copy the DNS records (SPF, DKIM) provided</li>
                    <li>Go to <a href="https://admin.microsoft.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Microsoft 365 Admin Center <ExternalLink className="h-3 w-3" /></a></li>
                    <li>Navigate to Settings → Domains → select your domain → DNS records</li>
                    <li>Add the TXT records for SPF authentication</li>
                    <li>Add the CNAME records for DKIM</li>
                    <li>Wait 24-48 hours for DNS propagation</li>
                  </ol>
                  <p className="mt-2"><strong>Important for Exchange:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                    <li>If you have existing SPF records, merge them with Resend's SPF record</li>
                    <li>Example: <code className="bg-muted px-1 rounded">v=spf1 include:spf.protection.outlook.com include:amazonses.com ~all</code></li>
                  </ul>
                  <p className="mt-2"><strong>Step 2: Configure Reply Handling</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                    <li>Set your Reply-To address above to your M365 email</li>
                    <li>Replies will arrive in your Exchange/Outlook inbox</li>
                    <li>Set up <a href="https://support.microsoft.com/en-us/office/manage-email-messages-by-using-rules-c24f5dea-9465-4df4-ad17-a50704d66c59" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">mail flow rules</a> in Exchange Admin Center for team distribution</li>
                  </ol>
                </div>
              </div>
            )}

            {emailProvider === "other" && (
              <div className="space-y-3 bg-muted/50 p-4 rounded-lg border">
                <Label className="text-sm font-medium">General Domain Setup</Label>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong>To send from your own domain:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                    <li>Go to <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Resend Domains <ExternalLink className="h-3 w-3" /></a> and add your domain</li>
                    <li>Add the provided DNS records to your domain registrar:
                      <ul className="list-disc list-inside ml-4 mt-1">
                        <li><strong>SPF Record</strong> (TXT): Authorizes Resend to send on your behalf</li>
                        <li><strong>DKIM Record</strong> (TXT): Adds digital signature for authenticity</li>
                        <li><strong>DMARC Record</strong> (TXT): Optional but recommended for deliverability</li>
                      </ul>
                    </li>
                    <li>Wait 24-48 hours for DNS propagation</li>
                    <li>Verify your domain in Resend dashboard</li>
                    <li>Enter your verified domain email in the "From Address" field above</li>
                  </ol>
                </div>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          {/* Resend Inbound Webhook Setup */}
          <div className="space-y-3 bg-muted/50 p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Email Reply Tracking (Advanced)</Label>
              <Badge variant="outline" className="text-xs">Optional</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              For automatic reply tracking in your CRM, configure Resend Inbound webhooks:
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value="https://nyzgsizvtqhafoxixyrd.supabase.co/functions/v1/outbound-reply-webhook"
                className="font-mono text-xs bg-background"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText("https://nyzgsizvtqhafoxixyrd.supabase.co/functions/v1/outbound-reply-webhook");
                  toast({
                    title: "Copied!",
                    description: "Webhook URL copied to clipboard",
                  });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Setup Steps:</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Go to your <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Resend Dashboard <ExternalLink className="h-3 w-3" /></a></li>
                <li>Navigate to <strong>Inbound</strong> → <strong>Webhooks</strong></li>
                <li>Add the webhook URL above</li>
                <li>Configure MX records to route replies through Resend</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LinkedIn Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Linkedin className="h-5 w-5 text-[#0A66C2]" />
            LinkedIn Settings
          </CardTitle>
          <CardDescription>
            Configure your LinkedIn profile and daily limits for outreach
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linkedin-profile">Your LinkedIn Profile URL</Label>
            <Input
              id="linkedin-profile"
              placeholder="https://www.linkedin.com/in/yourprofile"
              value={linkedinProfileUrl}
              onChange={(e) => setLinkedinProfileUrl(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="linkedin-connect-limit">Daily Connection Limit</Label>
              <Input
                id="linkedin-connect-limit"
                type="number"
                min={1}
                max={100}
                value={linkedinConnectLimit}
                onChange={(e) => setLinkedinConnectLimit(parseInt(e.target.value) || 20)}
              />
              <p className="text-xs text-muted-foreground">
                LinkedIn recommends max 20-25 per day
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin-message-limit">Daily Message Limit</Label>
              <Input
                id="linkedin-message-limit"
                type="number"
                min={1}
                max={150}
                value={linkedinMessageLimit}
                onChange={(e) => setLinkedinMessageLimit(parseInt(e.target.value) || 50)}
              />
              <p className="text-xs text-muted-foreground">
                LinkedIn recommends max 50-75 per day
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Calendar & Booking
          </CardTitle>
          <CardDescription>
            Configure your meeting booking link for outbound campaigns
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="calendar-provider">Calendar Provider</Label>
              <Select value={calendarProvider} onValueChange={setCalendarProvider}>
                <SelectTrigger id="calendar-provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calendly">Calendly</SelectItem>
                  <SelectItem value="hubspot">HubSpot Meetings</SelectItem>
                  <SelectItem value="cal.com">Cal.com</SelectItem>
                  <SelectItem value="google">Google Calendar</SelectItem>
                  <SelectItem value="custom">Custom Link</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-booking-url">Booking URL</Label>
              <Input
                id="calendar-booking-url"
                placeholder="https://calendly.com/yourname/30min"
                value={calendarBookingUrl}
                onChange={(e) => setCalendarBookingUrl(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CRM Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            CRM Webhooks
          </CardTitle>
          <CardDescription>
            Connect your CRM to receive lead events and sync data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="crm-inbound-webhook">Inbound Webhook URL</Label>
            <Input
              id="crm-inbound-webhook"
              placeholder="https://your-crm.com/webhooks/inbound"
              value={crmInboundWebhook}
              onChange={(e) => setCrmInboundWebhook(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Receives events when leads are captured or updated
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-outbound-webhook">Outbound Webhook URL</Label>
            <Input
              id="crm-outbound-webhook"
              placeholder="https://your-crm.com/webhooks/outbound"
              value={crmOutboundWebhook}
              onChange={(e) => setCrmOutboundWebhook(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Receives events when emails are sent, opened, or replied
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Custom Domain */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Custom Domain
          </CardTitle>
          <CardDescription>
            Use your own domain for landing pages and email tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom-domain">Domain</Label>
            <div className="flex items-center gap-2">
              <Input
                id="custom-domain"
                placeholder="campaigns.yourcompany.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
              />
              {integration?.custom_domain_verified ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                </Badge>
              ) : customDomain ? (
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                  <XCircle className="h-3 w-3 mr-1" /> Pending
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Add a CNAME record pointing to campaigns.ubigrowth.ai
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Integration Settings
        </Button>
      </div>
    </div>
  );
}