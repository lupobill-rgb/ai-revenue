import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Plus, X, Loader2, Mail } from "lucide-react";

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

export function TestEmailDialog({ open, onOpenChange, asset, workspaceId }: TestEmailDialogProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [testEmails, setTestEmails] = useState<string[]>([""]);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);

  // Fetch email settings when dialog opens
  useEffect(() => {
    if (open && workspaceId) {
      fetchEmailSettings();
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

  const validateEmails = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = testEmails.filter(e => e.trim() && emailRegex.test(e.trim()));
    return validEmails;
  };

  const handleSendTest = async () => {
    const validEmails = validateEmails();
    
    if (validEmails.length === 0) {
      toast({
        variant: "destructive",
        title: "No Valid Emails",
        description: "Please enter at least one valid email address",
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

      // Send workspaceId so backend fetches the user's configured email settings
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

      toast({
        title: "Test Emails Sent",
        description: `Successfully sent to ${data.sentCount || validEmails.length} recipient(s)`,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Test Email
          </DialogTitle>
          <DialogDescription>
            Send a test version of "{asset.name}" to verify before deploying.
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
              <Label className="text-sm font-medium">To (Test Recipients)</Label>
              <Badge variant="secondary" className="text-xs">
                {validateEmails().length} valid
              </Badge>
            </div>
            
            <div className="space-y-2">
              {testEmails.map((email, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => updateEmail(index, e.target.value)}
                    placeholder="email@example.com"
                    className="flex-1"
                  />
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
              ))}
            </div>

            {testEmails.length < 10 && (
              <Button
                variant="outline"
                size="sm"
                onClick={addEmailField}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Recipient
              </Button>
            )}
          </div>

          {/* Subject Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Subject</Label>
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm">
                {asset.content?.subject || `Test: ${asset.name}`}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSendTest}
            disabled={sending || validateEmails().length === 0}
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
