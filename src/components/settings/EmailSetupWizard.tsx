/**
 * Email Setup Wizard
 * A step-by-step guided setup for first-time email configuration.
 * Makes email setup as easy as popular CRMs.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Mail,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Globe,
  Send,
  Reply,
  Shield,
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface EmailSetupWizardProps {
  workspaceId: string;
  onComplete: () => void;
  onSkip: () => void;
}

type WizardStep = "welcome" | "method" | "sender" | "domain" | "test" | "complete";

export function EmailSetupWizard({ workspaceId, onComplete, onSkip }: EmailSetupWizardProps) {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [emailMethod, setEmailMethod] = useState<"gmail" | "resend">("gmail");
  const [senderName, setSenderName] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [replyToAddress, setReplyToAddress] = useState("");
  
  // Gmail OAuth state
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  
  // Domain verification state
  const [domainVerified, setDomainVerified] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const [domainStatus, setDomainStatus] = useState<"unknown" | "verified" | "unverified">("unknown");
  
  // Test email state
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailSent, setTestEmailSent] = useState(false);

  const steps: WizardStep[] = ["welcome", "method", "sender", "domain", "test", "complete"];
  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex) / (steps.length - 1)) * 100;

  useEffect(() => {
    checkGmailStatus();
  }, []);

  const checkGmailStatus = async () => {
    try {
      const { data } = await supabase
        .from("user_gmail_tokens")
        .select("email")
        .maybeSingle();
      
      if (data) {
        setGmailConnected(true);
        setGmailEmail(data.email);
        setFromAddress(data.email);
        setReplyToAddress(data.email);
      }
    } catch (error) {
      console.error("Error checking Gmail status:", error);
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
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to start Gmail connection");
      setGmailConnecting(false);
    }
  };

  const extractDomain = (email: string): string => {
    const match = email.match(/@([^@]+)$/);
    return match ? match[1] : "";
  };

  const verifyDomain = async () => {
    const domain = extractDomain(fromAddress);
    if (!domain) {
      toast.error("Please enter a valid email address first");
      return;
    }

    setVerifyingDomain(true);
    try {
      // For Gmail, domain is automatically verified
      if (emailMethod === "gmail" && gmailConnected) {
        setDomainVerified(true);
        setDomainStatus("verified");
        toast.success("Gmail domain verified automatically!");
        return;
      }

      // For Resend, check if domain is verified
      // This would typically call an API to check Resend domain status
      // For now, we'll show guidance
      setDomainStatus("unverified");
      toast.info(`Please verify ${domain} in your Resend dashboard`);
    } catch (error) {
      toast.error("Failed to verify domain");
    } finally {
      setVerifyingDomain(false);
    }
  };

  const sendTestEmail = async () => {
    if (!replyToAddress) {
      toast.error("Please enter a reply-to address");
      return;
    }

    setTestingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-email", {
        body: {
          recipients: [{ email: replyToAddress, name: senderName }],
          subject: "Test Email - Your Email Setup is Complete! 🎉",
          body: `Hi ${senderName || "there"},\n\nThis is a test email to confirm your email settings are working correctly.\n\nIf you're reading this, your email is configured properly!\n\nBest,\nYour CRM`,
          workspaceId,
        },
      });

      if (error) throw error;
      
      setTestEmailSent(true);
      toast.success("Test email sent! Check your inbox.");
    } catch (error: any) {
      toast.error(error.message || "Failed to send test email");
    } finally {
      setTestingEmail(false);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("ai_settings_email")
        .upsert({
          tenant_id: workspaceId,
          sender_name: senderName,
          from_address: fromAddress,
          reply_to_address: replyToAddress,
          email_provider: emailMethod,
          is_connected: gmailConnected || domainVerified,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id" });

      if (error) throw error;
      
      setStep("complete");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  const canProceed = (): boolean => {
    switch (step) {
      case "welcome":
        return true;
      case "method":
        return emailMethod === "gmail" ? gmailConnected : true;
      case "sender":
        return !!senderName && !!fromAddress && !!replyToAddress;
      case "domain":
        return emailMethod === "gmail" || domainStatus !== "unknown";
      case "test":
        return true;
      default:
        return true;
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <Badge variant="outline" className="text-xs">
            Step {currentStepIndex + 1} of {steps.length}
          </Badge>
          {step !== "welcome" && step !== "complete" && (
            <Button variant="ghost" size="sm" onClick={onSkip}>
              Skip setup
            </Button>
          )}
        </div>
        <Progress value={progress} className="h-2" />
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Welcome Step */}
        {step === "welcome" && (
          <div className="text-center py-8 space-y-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Let's Set Up Your Email</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Configure your email in under 2 minutes. We'll guide you through connecting your email
                and making sure replies come to the right place.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm max-w-md mx-auto">
              <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Send className="h-5 w-5 text-primary" />
                <span>Send emails</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Reply className="h-5 w-5 text-primary" />
                <span>Get replies</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Shield className="h-5 w-5 text-primary" />
                <span>Stay secure</span>
              </div>
            </div>
            <Button onClick={goNext} size="lg" className="mt-4">
              Get Started
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Method Selection Step */}
        {step === "method" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">How do you want to send emails?</h2>
              <p className="text-muted-foreground">
                Choose the easiest option for your setup
              </p>
            </div>

            <div className="grid gap-4">
              {/* Gmail Option - Featured */}
              <button
                type="button"
                onClick={() => setEmailMethod("gmail")}
                className={`p-6 rounded-xl border-2 text-left transition-all relative ${
                  emailMethod === "gmail"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Badge className="absolute top-3 right-3 bg-green-500">Recommended</Badge>
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="h-6 w-6" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Connect Gmail</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      One-click connection. Emails appear in your sent folder. Best deliverability.
                    </p>
                    {gmailConnected ? (
                      <div className="flex items-center gap-2 mt-3">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-600">Connected as {gmailEmail}</span>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={(e) => {
                          e.stopPropagation();
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
                    )}
                  </div>
                </div>
              </button>

              {/* Resend Option */}
              <button
                type="button"
                onClick={() => setEmailMethod("resend")}
                className={`p-6 rounded-xl border-2 text-left transition-all ${
                  emailMethod === "resend"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-6 w-6 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Use Resend</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Send from your own domain. Requires domain verification in Resend.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={goBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={goNext} disabled={!canProceed()}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Sender Identity Step */}
        {step === "sender" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">Who are emails from?</h2>
              <p className="text-muted-foreground">
                Set up your sender identity and where replies go
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wizard-sender-name">
                  Sender Name
                  <span className="text-muted-foreground text-xs ml-2">How recipients see you</span>
                </Label>
                <Input
                  id="wizard-sender-name"
                  placeholder="e.g., John from Acme Inc"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wizard-from-address">
                  From Email Address
                  <span className="text-muted-foreground text-xs ml-2">The address emails are sent from</span>
                </Label>
                <Input
                  id="wizard-from-address"
                  type="email"
                  placeholder="e.g., john@company.com"
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                  disabled={emailMethod === "gmail" && gmailConnected}
                />
                {emailMethod === "gmail" && gmailConnected && (
                  <p className="text-xs text-muted-foreground">
                    Using your connected Gmail address
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="wizard-reply-to" className="flex items-center gap-2">
                  <Reply className="h-4 w-4 text-primary" />
                  Reply-To Address
                  <span className="text-muted-foreground text-xs">Where replies go</span>
                </Label>
                <Input
                  id="wizard-reply-to"
                  type="email"
                  placeholder="e.g., replies@company.com"
                  value={replyToAddress}
                  onChange={(e) => setReplyToAddress(e.target.value)}
                />
                <Alert className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Important</AlertTitle>
                  <AlertDescription>
                    All customer replies will be sent to <strong>{replyToAddress || "this address"}</strong>.
                    Make sure this is the email you want to receive responses at!
                  </AlertDescription>
                </Alert>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={goBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={goNext} disabled={!canProceed()}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Domain Verification Step */}
        {step === "domain" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">Verify Your Domain</h2>
              <p className="text-muted-foreground">
                {emailMethod === "gmail"
                  ? "Gmail handles domain verification automatically"
                  : "Verify your sending domain in Resend for best deliverability"
                }
              </p>
            </div>

            {emailMethod === "gmail" ? (
              <div className="p-6 rounded-xl border-2 border-green-500/30 bg-green-500/5 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Domain Verified Automatically</h3>
                <p className="text-sm text-muted-foreground">
                  Since you're using Gmail, your domain is automatically trusted by email providers.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3 mb-3">
                    <Globe className="h-5 w-5 text-primary" />
                    <span className="font-medium">Domain: {extractDomain(fromAddress) || "Not set"}</span>
                  </div>
                  
                  {domainStatus === "verified" ? (
                    <Badge className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : domainStatus === "unverified" ? (
                    <div className="space-y-3">
                      <Badge variant="outline" className="text-amber-500 border-amber-500">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Not Verified
                      </Badge>
                      <Alert>
                        <AlertDescription className="text-sm">
                          <p className="mb-2">To verify your domain in Resend:</p>
                          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                            <li>Go to <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary underline">resend.com/domains</a></li>
                            <li>Add <strong>{extractDomain(fromAddress)}</strong></li>
                            <li>Add the DNS records to your domain</li>
                            <li>Wait for verification (usually 1-24 hours)</li>
                          </ol>
                        </AlertDescription>
                      </Alert>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open("https://resend.com/domains", "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Resend Dashboard
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={verifyDomain}
                      disabled={verifyingDomain || !fromAddress}
                    >
                      {verifyingDomain ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        "Check Domain Status"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={goBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={goNext} disabled={!canProceed()}>
                {emailMethod === "resend" && domainStatus === "unverified"
                  ? "Continue Anyway"
                  : "Continue"
                }
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Test Email Step */}
        {step === "test" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">Send a Test Email</h2>
              <p className="text-muted-foreground">
                Let's make sure everything works before you go live
              </p>
            </div>

            <div className="p-6 rounded-xl border bg-muted/30 text-center space-y-4">
              {testEmailSent ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                  <div>
                    <h3 className="font-semibold">Test Email Sent!</h3>
                    <p className="text-sm text-muted-foreground">
                      Check your inbox at <strong>{replyToAddress}</strong>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Mail className="h-12 w-12 text-primary mx-auto" />
                  <div>
                    <h3 className="font-semibold">Ready to Test</h3>
                    <p className="text-sm text-muted-foreground">
                      We'll send a test email to <strong>{replyToAddress}</strong>
                    </p>
                  </div>
                  <Button onClick={sendTestEmail} disabled={testingEmail}>
                    {testingEmail ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Test Email
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={goBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={saveSettings} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Complete Step */}
        {step === "complete" && (
          <div className="text-center py-8 space-y-6">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <Sparkles className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">You're All Set! 🎉</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Your email is configured and ready to send. Replies will go to{" "}
                <strong>{replyToAddress}</strong>.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50 text-left max-w-md mx-auto">
              <h3 className="font-medium mb-2">Your settings:</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Sender: {senderName} &lt;{fromAddress}&gt;</li>
                <li>• Replies go to: {replyToAddress}</li>
                <li>• Method: {emailMethod === "gmail" ? "Gmail" : "Resend"}</li>
              </ul>
            </div>

            <Button onClick={onComplete} size="lg">
              Start Sending Emails
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default EmailSetupWizard;
