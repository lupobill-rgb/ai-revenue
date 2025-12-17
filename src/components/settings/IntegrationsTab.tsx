import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Mail, Linkedin, Calendar, Globe, Webhook, Loader2, CheckCircle2, XCircle, Copy, ExternalLink, LogOut } from "lucide-react";

export function IntegrationsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Gmail OAuth state
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailDisconnecting, setGmailDisconnecting] = useState(false);

  // Form state - Email
  const [emailFromAddress, setEmailFromAddress] = useState("");
  const [emailFromName, setEmailFromName] = useState("");
  const [emailReplyTo, setEmailReplyTo] = useState("");
  const [emailProvider, setEmailProvider] = useState("");

  // Form state - LinkedIn
  const [linkedinProfileUrl, setLinkedinProfileUrl] = useState("");
  const [linkedinConnectLimit, setLinkedinConnectLimit] = useState(20);
  const [linkedinMessageLimit, setLinkedinMessageLimit] = useState(50);

  // Form state - Calendar
  const [calendarBookingUrl, setCalendarBookingUrl] = useState("");
  const [calendarProvider, setCalendarProvider] = useState("");

  // Form state - CRM Webhooks
  const [crmInboundWebhook, setCrmInboundWebhook] = useState("");
  const [crmOutboundWebhook, setCrmOutboundWebhook] = useState("");

  // Form state - Domain
  const [customDomain, setCustomDomain] = useState("");
  const [domainVerified, setDomainVerified] = useState(false);

  useEffect(() => {
    fetchUserAndSettings();
    
    // Handle OAuth callback query params
    const gmailConnected = searchParams.get("gmail_connected");
    const gmailError = searchParams.get("gmail_error");
    
    if (gmailConnected === "true") {
      toast({
        title: "Gmail Connected",
        description: "Your Gmail account has been connected successfully.",
      });
      // Clear the query params
      setSearchParams({});
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
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const fetchUserAndSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      
      // Get the user's workspace_id (settings are now keyed by workspace_id)
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      
      if (workspaceError || !workspace?.id) {
        // Try to get workspace from workspace_members if not owner
        const { data: memberWorkspace } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        
        if (memberWorkspace?.workspace_id) {
          setTenantId(memberWorkspace.workspace_id);
          await fetchAllSettings(memberWorkspace.workspace_id);
        } else {
          console.error("No workspace found for user");
        }
      } else {
        setTenantId(workspace.id);
        await fetchAllSettings(workspace.id);
      }
      
      // Fetch Gmail connection status
      await fetchGmailStatus();
    } catch (error) {
      console.error("Error fetching user:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSettings = async (tid: string) => {
    try {
      // Fetch all settings in parallel
      const [emailRes, linkedinRes, calendarRes, crmRes, domainRes] = await Promise.all([
        supabase.from("ai_settings_email").select("*").eq("tenant_id", tid).maybeSingle(),
        supabase.from("ai_settings_linkedin").select("*").eq("tenant_id", tid).maybeSingle(),
        supabase.from("ai_settings_calendar").select("*").eq("tenant_id", tid).maybeSingle(),
        supabase.from("ai_settings_crm_webhooks").select("*").eq("tenant_id", tid).maybeSingle(),
        supabase.from("ai_settings_domain").select("*").eq("tenant_id", tid).maybeSingle(),
      ]);

      // Email settings
      if (emailRes.data) {
        setEmailFromAddress(emailRes.data.from_address || "");
        setEmailFromName(emailRes.data.sender_name || "");
        setEmailReplyTo(emailRes.data.reply_to_address || "");
      }

      // LinkedIn settings
      if (linkedinRes.data) {
        setLinkedinProfileUrl(linkedinRes.data.linkedin_profile_url || "");
        setLinkedinConnectLimit(linkedinRes.data.daily_connection_limit || 20);
        setLinkedinMessageLimit(linkedinRes.data.daily_message_limit || 50);
      }

      // Calendar settings
      if (calendarRes.data) {
        setCalendarBookingUrl(calendarRes.data.booking_url || "");
        setCalendarProvider(calendarRes.data.calendar_provider || "");
      }

      // CRM webhook settings
      if (crmRes.data) {
        setCrmInboundWebhook(crmRes.data.inbound_webhook_url || "");
        setCrmOutboundWebhook(crmRes.data.outbound_webhook_url || "");
      }

      // Domain settings
      if (domainRes.data) {
        setCustomDomain(domainRes.data.domain || "");
        setDomainVerified(domainRes.data.cname_verified || false);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
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

  const handleSave = async () => {
    if (!tenantId) return;

    setSaving(true);
    try {
      // Upsert all settings in parallel
      const operations = [];

      // Email settings
      operations.push(
        supabase.from("ai_settings_email").upsert({
          tenant_id: tenantId,
          from_address: emailFromAddress || "",
          sender_name: emailFromName || "",
          reply_to_address: emailReplyTo || "",
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id" })
      );

      // LinkedIn settings
      operations.push(
        supabase.from("ai_settings_linkedin").upsert({
          tenant_id: tenantId,
          linkedin_profile_url: linkedinProfileUrl || "",
          daily_connection_limit: linkedinConnectLimit,
          daily_message_limit: linkedinMessageLimit,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id" })
      );

      // Calendar settings
      operations.push(
        supabase.from("ai_settings_calendar").upsert({
          tenant_id: tenantId,
          booking_url: calendarBookingUrl || "",
          calendar_provider: calendarProvider || "",
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id" })
      );

      // CRM webhook settings
      operations.push(
        supabase.from("ai_settings_crm_webhooks").upsert({
          tenant_id: tenantId,
          inbound_webhook_url: crmInboundWebhook || null,
          outbound_webhook_url: crmOutboundWebhook || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id" })
      );

      // Domain settings
      operations.push(
        supabase.from("ai_settings_domain").upsert({
          tenant_id: tenantId,
          domain: customDomain || "",
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id" })
      );

      const results = await Promise.all(operations);
      
      // Check for errors
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        console.error("Errors saving settings:", errors);
        throw new Error(errors[0].error?.message || "Failed to save settings");
      }

      toast({
        title: "Settings saved",
        description: "Your integration settings have been updated.",
      });
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
            Configure your email sending settings for outbound campaigns. Send emails from your own domain for better deliverability.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email-from-name">Sender Name</Label>
              <Input
                id="email-from-name"
                placeholder="Your Company Name"
                value={emailFromName}
                onChange={(e) => setEmailFromName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-from">From Email Address</Label>
              <Input
                id="email-from"
                type="email"
                placeholder="noreply@yourdomain.com"
                value={emailFromAddress}
                onChange={(e) => setEmailFromAddress(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-reply-to">Reply-To Email Address</Label>
            <Input
              id="email-reply-to"
              type="email"
              placeholder="sales@yourdomain.com"
              value={emailReplyTo}
              onChange={(e) => setEmailReplyTo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Replies to your campaigns will be sent to this address
            </p>
          </div>

          <Separator className="my-4" />

          <Separator className="my-4" />

          {/* Gmail OAuth Connection */}
          <div className="space-y-3">
            <Label>Connect Gmail Account</Label>
            <p className="text-sm text-muted-foreground">
              Connect your Gmail account to send emails directly from your inbox with better deliverability.
            </p>
            
            {gmailConnected ? (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Gmail Connected</p>
                    <p className="text-sm text-muted-foreground">{gmailEmail}</p>
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
                variant="outline"
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

          <Separator className="my-4" />

          <div className="space-y-2">
            <Label>Alternative: Custom Domain Setup</Label>
            <Select value={emailProvider} onValueChange={setEmailProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Select setup method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom Domain (Resend)</SelectItem>
                <SelectItem value="outlook">Outlook / Microsoft 365</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {emailProvider && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <h4 className="font-medium text-sm">Setup Instructions</h4>
              {emailProvider === "outlook" && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>To send from Outlook/Microsoft 365:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Contact support to verify your domain</li>
                    <li>We'll configure DNS records for email authentication</li>
                    <li>Enter your @yourdomain.com address above</li>
                  </ol>
                </div>
              )}
              {emailProvider === "custom" && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>To send from a custom domain via Resend:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Go to <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">resend.com/domains</a></li>
                    <li>Add and verify your domain with DNS records</li>
                    <li>Once verified, enter your from address above</li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* LinkedIn Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Linkedin className="h-5 w-5 text-primary" />
            LinkedIn Settings
          </CardTitle>
          <CardDescription>
            Configure your LinkedIn outreach settings and daily limits to comply with LinkedIn's terms of service.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linkedin-url">LinkedIn Profile URL</Label>
            <Input
              id="linkedin-url"
              placeholder="https://linkedin.com/in/yourprofile"
              value={linkedinProfileUrl}
              onChange={(e) => setLinkedinProfileUrl(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="linkedin-connect-limit">Daily Connection Request Limit</Label>
              <Input
                id="linkedin-connect-limit"
                type="number"
                min={1}
                max={100}
                value={linkedinConnectLimit}
                onChange={(e) => setLinkedinConnectLimit(parseInt(e.target.value) || 20)}
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 20-30 per day to avoid restrictions
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
                Recommended: 50-75 per day to avoid restrictions
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
            Calendar & Booking Settings
          </CardTitle>
          <CardDescription>
            Connect your calendar for meeting scheduling in campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Calendar Provider</Label>
            <Select value={calendarProvider} onValueChange={setCalendarProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Select calendar provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calendly">Calendly</SelectItem>
                <SelectItem value="hubspot">HubSpot Meetings</SelectItem>
                <SelectItem value="google">Google Calendar</SelectItem>
                <SelectItem value="outlook">Outlook Calendar</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="booking-url">Booking URL</Label>
            <Input
              id="booking-url"
              placeholder="https://calendly.com/yourname/30min"
              value={calendarBookingUrl}
              onChange={(e) => setCalendarBookingUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This URL will be included in campaign emails and voice scripts for booking meetings
            </p>
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
            Connect your external CRM to receive real-time updates when prospects engage with your campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="crm-outbound">Outbound Webhook URL</Label>
            <Input
              id="crm-outbound"
              placeholder="https://yourcrm.com/webhook/inbound"
              value={crmOutboundWebhook}
              onChange={(e) => setCrmOutboundWebhook(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              We'll POST events to this URL when emails are sent, opened, clicked, or replied to
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-inbound">Inbound Webhook URL (Your Endpoint)</Label>
            <Input
              id="crm-inbound"
              placeholder="https://yourcrm.com/webhook/outbound"
              value={crmInboundWebhook}
              onChange={(e) => setCrmInboundWebhook(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Configure your CRM to POST to our endpoint when you want to trigger actions
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
            Use your own domain for landing pages and tracking links.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom-domain">Custom Domain</Label>
            <div className="flex gap-2">
              <Input
                id="custom-domain"
                placeholder="pages.yourdomain.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
              />
              {domainVerified ? (
                <Badge variant="outline" className="whitespace-nowrap bg-green-500/10 text-green-500 border-green-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              ) : customDomain ? (
                <Badge variant="outline" className="whitespace-nowrap bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                  <XCircle className="h-3 w-3 mr-1" />
                  Pending
                </Badge>
              ) : null}
            </div>
          </div>
          
          {customDomain && !domainVerified && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <h4 className="font-medium text-sm">DNS Configuration Required</h4>
              <p className="text-sm text-muted-foreground">
                Add the following CNAME record to your DNS settings:
              </p>
              <div className="bg-background p-3 rounded border font-mono text-sm">
                <div className="flex items-center justify-between">
                  <span>
                    <span className="text-muted-foreground">Type:</span> CNAME
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6"
                    onClick={() => {
                      navigator.clipboard.writeText("CNAME");
                      toast({ title: "Copied to clipboard" });
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span>
                    <span className="text-muted-foreground">Name:</span> {customDomain.split('.')[0]}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6"
                    onClick={() => {
                      navigator.clipboard.writeText(customDomain.split('.')[0]);
                      toast({ title: "Copied to clipboard" });
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span>
                    <span className="text-muted-foreground">Value:</span> cname.vercel-dns.com
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6"
                    onClick={() => {
                      navigator.clipboard.writeText("cname.vercel-dns.com");
                      toast({ title: "Copied to clipboard" });
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                DNS changes can take up to 48 hours to propagate. We'll automatically verify your domain once the records are detected.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Integration Settings
        </Button>
      </div>
    </div>
  );
}
