import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, FileText, Mail, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company?: string;
}

interface EmailOutreachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onEmailSent?: () => void;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

type SendVia = "resend" | "gmail";

// Dynamic templates that will use business name from profile
const getEmailTemplates = (businessName: string = "Our Team"): EmailTemplate[] => [
  {
    id: "intro",
    name: "Introduction",
    subject: "Quick question about {{company}}",
    body: `Hi {{first_name}},

I came across {{company}} and was impressed by what you're building. I wanted to reach out because we help businesses like yours increase customer engagement through innovative marketing experiences.

Would you be open to a quick 15-minute call this week to explore if there's a fit?

Best regards,
${businessName}`,
  },
  {
    id: "follow-up",
    name: "Follow Up",
    subject: "Following up on {{company}}",
    body: `Hi {{first_name}},

I wanted to follow up on my previous message. I know you're busy, but I truly believe we can help {{company}} stand out with our marketing automation solutions.

Our clients typically see a 40% increase in campaign performance within the first 3 months.

Do you have 10 minutes for a quick chat?

Best,
${businessName}`,
  },
  {
    id: "value-prop",
    name: "Value Proposition",
    subject: "Boost engagement at {{company}}",
    body: `Hi {{first_name}},

Did you know that AI-powered marketing drives 3x more conversions than traditional methods?

We specialize in creating intelligent marketing automation that:
• Increases campaign ROI by up to 50%
• Boosts customer engagement rates
• Generates authentic multi-channel reach

I'd love to show you how {{company}} could benefit. Are you available for a brief demo this week?

Cheers,
${businessName}`,
  },
  {
    id: "special-offer",
    name: "Special Offer",
    subject: "Exclusive offer for {{company}}",
    body: `Hi {{first_name}},

I'm reaching out with a special offer for {{company}}.

For a limited time, we're offering new partners:
✓ Free consultation and strategy session
✓ 20% off your first campaign
✓ Dedicated success manager

This offer expires at the end of the month. Want to learn more?

Best,
${businessName}`,
  },
];

export function EmailOutreachDialog({ open, onOpenChange, lead, onEmailSent }: EmailOutreachDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(getEmailTemplates());
  const [fromEmail, setFromEmail] = useState<string>("");
  const [senderName, setSenderName] = useState<string>("");
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [sendVia, setSendVia] = useState<SendVia>("resend");

  // Fetch business profile, email settings, and Gmail status when dialog opens
  useEffect(() => {
    if (!open) return;
    
    const fetchSettings = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch Gmail token status
      const { data: gmailToken } = await supabase
        .from("user_gmail_tokens")
        .select("email")
        .maybeSingle();
      
      if (gmailToken?.email) {
        setGmailConnected(true);
        setGmailEmail(gmailToken.email);
      } else {
        setGmailConnected(false);
        setGmailEmail(null);
        setSendVia("resend"); // Reset to resend if Gmail not connected
      }

      // Get workspace ID
      const { data: ownedWorkspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      let workspaceId = ownedWorkspace?.id;

      if (!workspaceId) {
        const { data: membership } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", user.id)
          .maybeSingle();
        workspaceId = membership?.workspace_id;
      }

      if (workspaceId) {
        // Fetch business profile for templates
        const { data: profile } = await supabase
          .from('business_profiles')
          .select('business_name')
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        
        if (profile?.business_name) {
          setEmailTemplates(getEmailTemplates(profile.business_name));
        }

        // Fetch email settings for from address
        const { data: emailSettings } = await supabase
          .from('ai_settings_email')
          .select('from_address, sender_name')
          .eq('tenant_id', workspaceId)
          .maybeSingle();

        if (emailSettings) {
          setFromEmail(emailSettings.from_address || "onboarding@resend.dev");
          setSenderName(emailSettings.sender_name || "");
        } else {
          setFromEmail("onboarding@resend.dev");
          setSenderName("");
        }
      }
    };
    
    fetchSettings();
  }, [open]);

  const replaceVariables = (text: string): string => {
    if (!lead) return text;
    return text
      .replace(/\{\{first_name\}\}/g, lead.first_name || "there")
      .replace(/\{\{last_name\}\}/g, lead.last_name || "")
      .replace(/\{\{company\}\}/g, lead.company || "your company")
      .replace(/\{\{email\}\}/g, lead.email || "");
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = emailTemplates.find(t => t.id === templateId);
    if (template) {
      setSubject(replaceVariables(template.subject));
      setBody(replaceVariables(template.body));
    }
  };

  const handleSend = async () => {
    if (!lead || !subject.trim() || !body.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setSending(true);
    try {
      const htmlBody = body.replace(/\n/g, "<br>");
      
      const { data, error } = await supabase.functions.invoke("send-lead-email", {
        body: {
          leadId: lead.id,
          subject: subject.trim(),
          body: htmlBody,
          templateId: selectedTemplate || "custom",
          sendVia: sendVia,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Email sent to ${lead.first_name} ${lead.last_name}`);
      onOpenChange(false);
      setSelectedTemplate("");
      setSubject("");
      setBody("");
      onEmailSent?.();
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedTemplate("");
    setSubject("");
    setBody("");
  };

  const getFromDisplayText = () => {
    if (sendVia === "gmail" && gmailEmail) {
      return gmailEmail;
    }
    return senderName ? `${senderName} <${fromEmail}>` : fromEmail || "Loading...";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Send Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto py-4">
          {/* From Address */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              From
            </Label>
            {gmailConnected ? (
              <Select value={sendVia} onValueChange={(value: SendVia) => setSendVia(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resend">
                    <span className="flex items-center gap-2">
                      {senderName ? `${senderName} <${fromEmail}>` : fromEmail || "Default sender"}
                    </span>
                  </SelectItem>
                  <SelectItem value="gmail">
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22 6L12 13L2 6V4L12 11L22 4V6Z" fill="#EA4335"/>
                        <path d="M22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6L12 13L22 6Z" fill="#4285F4"/>
                      </svg>
                      {gmailEmail}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="px-3 py-2 bg-muted rounded-md text-sm text-muted-foreground">
                {getFromDisplayText()}
              </div>
            )}
          </div>

          {/* To Address */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              To
            </Label>
            <div className="px-3 py-2 bg-muted rounded-md text-sm text-muted-foreground">
              {lead ? `${lead.first_name} ${lead.last_name} <${lead.email}>` : "No lead selected"}
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Quick Templates
            </Label>
            <div className="flex flex-wrap gap-2">
              {emailTemplates.map((template) => (
                <Badge
                  key={template.id}
                  variant={selectedTemplate === template.id ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => handleTemplateSelect(template.id)}
                >
                  {template.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Email subject line..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              placeholder="Write your message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              disabled={sending}
              className="resize-none"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Variables like {"{{first_name}}"}, {"{{company}}"} are automatically replaced when using templates.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
