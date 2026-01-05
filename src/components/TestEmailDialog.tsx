import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Plus, X, Loader2, Mail, AlertTriangle, UserPlus, Check } from "lucide-react";

interface TestEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: {
    id: string;
    name: string;
    content?: any;
  };
  workspaceId?: string;
}

interface EmailSettings {
  sender_name: string;
  from_address: string;
  reply_to_address: string;
}

interface CRMContact {
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export function TestEmailDialog({ open, onOpenChange, asset, workspaceId }: TestEmailDialogProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [testEmails, setTestEmails] = useState<string[]>([""]);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [crmContacts, setCrmContacts] = useState<CRMContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Fetch email settings and CRM contacts when dialog opens
  useEffect(() => {
    if (open && workspaceId) {
      fetchEmailSettings();
      fetchCRMContacts();
    }
  }, [open, workspaceId]);

  const fetchEmailSettings = async () => {
    setLoadingSettings(true);
    try {
      const { data, error } = await supabase
        .from("ai_settings_email")
        .select("sender_name, from_address, reply_to_address")
        .eq("tenant_id", workspaceId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setEmailSettings(data);
      }
    } catch (error) {
      console.error("Error fetching email settings:", error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchCRMContacts = async () => {
    setLoadingContacts(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("email, first_name, last_name")
        .eq("workspace_id", workspaceId)
        .not("email", "is", null)
        .order("first_name", { ascending: true });

      if (error) throw error;

      setCrmContacts(data || []);
    } catch (error) {
      console.error("Error fetching CRM contacts:", error);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Build a set of valid CRM emails (lowercase for comparison)
  const crmEmailSet = useMemo(() => {
    return new Set(crmContacts.map((c) => c.email?.toLowerCase()).filter(Boolean));
  }, [crmContacts]);

  const addEmailField = () => {
    if (testEmails.length < 10) {
      setTestEmails([...testEmails, ""]);
    }
  };

  const removeEmailField = (index: number) => {
    if (testEmails.length > 1) {
      setTestEmails(testEmails.filter((_, i) => i !== index));
    }
  };

  const updateEmail = (index: number, value: string) => {
    const updated = [...testEmails];
    updated[index] = value;
    setTestEmails(updated);
  };

  // Validate emails: must be valid format AND exist in CRM
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateEmails = () => {
    return testEmails
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && emailRegex.test(e) && crmEmailSet.has(e));
  };

  const getEmailStatus = (email: string): "valid" | "invalid" | "not_in_crm" | "empty" => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return "empty";
    if (!emailRegex.test(trimmed)) return "invalid";
    if (!crmEmailSet.has(trimmed)) return "not_in_crm";
    return "valid";
  };

  const nonCrmEmails = testEmails
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e && emailRegex.test(e) && !crmEmailSet.has(e));

  const handleSendTest = async () => {
    const validEmails = validateEmails();

    if (validEmails.length === 0) {
      toast({
        variant: "destructive",
        title: "No Valid CRM Contacts",
        description: "Please enter email addresses of contacts that exist in your CRM.",
      });
      return;
    }

    if (!workspaceId) {
      toast({
        variant: "destructive",
        title: "Workspace Required",
        description: "No workspace selected",
      });
      return;
    }

    setSending(true);
    try {
      // Extract email content from asset
      const subject = asset.content?.subject || `Test: ${asset.name}`;
      const body = asset.content?.body || asset.content?.html || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Test Email Preview</h1>
          <p>This is a test preview of: <strong>${asset.name}</strong></p>
          <hr style="border: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">
            Sent as a test from UbiGrowth
          </p>
        </div>
      `;

      const { data, error } = await supabase.functions.invoke("test-email", {
        body: {
          recipients: validEmails,
          subject,
          body,
          workspaceId,
          assetId: asset.id,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Test Emails Sent",
        description: `Successfully sent to ${data.sentCount || validEmails.length} CRM contact(s)`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error sending test emails:", error);
      toast({
        variant: "destructive",
        title: "Send Failed",
        description: error instanceof Error ? error.message : "Failed to send test emails",
      });
    } finally {
      setSending(false);
    }
  };

  const getContactName = (email: string): string | null => {
    const contact = crmContacts.find((c) => c.email?.toLowerCase() === email.trim().toLowerCase());
    if (!contact) return null;
    return contact.first_name || null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Test Email
          </DialogTitle>
          <DialogDescription>
            Send a test version of "{asset.name}" to CRM contacts to verify personalization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* FROM Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">From</Label>

            {loadingSettings ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading email settings...
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-sm">
                  <span className="font-medium">{emailSettings?.sender_name || "Not configured"}</span>
                  {emailSettings?.from_address && (
                    <span className="text-muted-foreground ml-1">
                      &lt;{emailSettings.from_address}&gt;
                    </span>
                  )}
                </p>
                {!emailSettings?.from_address && (
                  <p className="text-xs text-destructive mt-1">
                    Please configure your email domain in Settings → Integrations
                  </p>
                )}
              </div>
            )}
          </div>

          {/* TO Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">To (CRM Contacts Only)</Label>
              <Badge variant="secondary" className="text-xs">
                {validateEmails().length} valid
              </Badge>
            </div>

            {loadingContacts ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading CRM contacts...
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {testEmails.map((email, index) => {
                    const status = getEmailStatus(email);
                    const contactName = status === "valid" ? getContactName(email) : null;

                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Input
                              type="email"
                              value={email}
                              onChange={(e) => updateEmail(index, e.target.value)}
                              placeholder="Enter CRM contact email..."
                              className={`flex-1 pr-8 ${
                                status === "not_in_crm"
                                  ? "border-amber-500 focus-visible:ring-amber-500"
                                  : status === "invalid"
                                  ? "border-destructive focus-visible:ring-destructive"
                                  : status === "valid"
                                  ? "border-green-500 focus-visible:ring-green-500"
                                  : ""
                              }`}
                            />
                            {status === "valid" && (
                              <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                            )}
                            {status === "not_in_crm" && (
                              <AlertTriangle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                            )}
                          </div>
                          {testEmails.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeEmailField(index)}
                              className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {status === "valid" && contactName && (
                          <p className="text-xs text-green-600 pl-1">
                            ✓ Will personalize as "{contactName}"
                          </p>
                        )}
                        {status === "not_in_crm" && (
                          <p className="text-xs text-amber-600 pl-1">
                            This email is not in your CRM
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {testEmails.length < 10 && (
                  <Button variant="outline" size="sm" onClick={addEmailField} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Recipient
                  </Button>
                )}

                {/* Warning for non-CRM emails */}
                {nonCrmEmails.length > 0 && (
                  <Alert variant="default" className="border-amber-200 bg-amber-50">
                    <UserPlus className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      <strong>Add contacts first:</strong> Test emails can only be sent to contacts in your CRM so personalization tags (like {"{{first_name}}"}) work correctly.
                      <br />
                      <a href="/crm" className="underline font-medium hover:text-amber-900">
                        Go to CRM → Add these contacts
                      </a>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Info about CRM contacts */}
                <p className="text-xs text-muted-foreground">
                  {crmContacts.length} contact{crmContacts.length !== 1 ? "s" : ""} available in your CRM
                </p>
              </>
            )}
          </div>

          {/* Subject Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Subject</Label>
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm">{asset.content?.subject || `Test: ${asset.name}`}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSendTest}
            disabled={sending || validateEmails().length === 0 || loadingContacts}
            className="bg-primary"
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Test
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
