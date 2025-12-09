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
import { Mail, Linkedin, Calendar, Globe, Webhook, Loader2, CheckCircle2, XCircle } from "lucide-react";

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
            Configure your email sending settings for outbound campaigns
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
              Replies to your outbound emails will be sent to this address
            </p>
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