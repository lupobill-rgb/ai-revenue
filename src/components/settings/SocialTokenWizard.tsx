import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Copy,
  Check,
  Instagram,
  Linkedin,
  Facebook,
} from "lucide-react";
import { toast } from "sonner";

interface SocialTokenWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: "instagram" | "linkedin" | "facebook" | "tiktok";
  onComplete: (token: string, accountName: string) => void;
}

const PLATFORM_CONFIG = {
  instagram: {
    name: "Instagram",
    icon: Instagram,
    color: "bg-gradient-to-br from-purple-500 to-pink-500",
    steps: [
      {
        title: "Go to Meta Developer Portal",
        description: "Create or access your Meta for Developers account",
        action: "https://developers.facebook.com/",
        actionLabel: "Open Meta Developer Portal",
      },
      {
        title: "Create an App",
        description: 'Click "Create App" → Select "Business" → Name your app → Add Instagram Basic Display product',
        tips: ["Select 'None' for app type if you don't see Business", "You can use any app name"],
      },
      {
        title: "Configure Instagram Basic Display",
        description: "Go to Instagram Basic Display → Basic Display → Add Instagram Testers",
        tips: [
          "Add your Instagram account as a tester",
          "Accept the tester invite in Instagram Settings → Apps & Websites",
        ],
      },
      {
        title: "Generate Access Token",
        description: "In Basic Display → User Token Generator → Generate Token for your tester account",
        tips: [
          "Login with your Instagram account when prompted",
          "Copy the generated long-lived token",
        ],
      },
    ],
  },
  linkedin: {
    name: "LinkedIn",
    icon: Linkedin,
    color: "bg-[#0077B5]",
    steps: [
      {
        title: "Go to LinkedIn Developer Portal",
        description: "Create or access your LinkedIn Developer account",
        action: "https://www.linkedin.com/developers/apps",
        actionLabel: "Open LinkedIn Developer Portal",
      },
      {
        title: "Create an App",
        description: 'Click "Create App" → Fill in app details → Select your LinkedIn Page',
        tips: [
          "You need a LinkedIn Company Page to create an app",
          "App name can be anything descriptive",
        ],
      },
      {
        title: "Add Products",
        description: "Go to Products tab → Request access to 'Share on LinkedIn' and 'Sign In with LinkedIn'",
        tips: [
          "Approval is usually instant for Share on LinkedIn",
          "This enables posting capabilities",
        ],
      },
      {
        title: "Get Access Token",
        description: "Go to Auth tab → OAuth 2.0 tools → Generate a new access token",
        tips: [
          "Select scopes: r_liteprofile, w_member_social",
          "Copy the access token - it expires in 60 days",
        ],
      },
    ],
  },
  facebook: {
    name: "Facebook",
    icon: Facebook,
    color: "bg-[#1877F2]",
    steps: [
      {
        title: "Go to Meta Developer Portal",
        description: "Create or access your Meta for Developers account",
        action: "https://developers.facebook.com/",
        actionLabel: "Open Meta Developer Portal",
      },
      {
        title: "Create an App",
        description: 'Click "Create App" → Select "Business" → Name your app',
        tips: ["Use your business name for the app", "Add Facebook Login product"],
      },
      {
        title: "Get Page Access Token",
        description: "Go to Tools → Graph API Explorer → Select your Page → Get Token → Page Access Token",
        tips: [
          "Select the Page you want to post to",
          "Add permissions: pages_manage_posts, pages_read_engagement",
        ],
      },
      {
        title: "Generate Long-Lived Token",
        description: "Use the Access Token Debugger to extend your token to 60 days",
        action: "https://developers.facebook.com/tools/debug/accesstoken/",
        actionLabel: "Open Token Debugger",
        tips: [
          "Paste your token → Click 'Extend Access Token'",
          "Copy the new long-lived token",
        ],
      },
    ],
  },
  tiktok: {
    name: "TikTok",
    icon: () => (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>
    ),
    color: "bg-black",
    steps: [
      {
        title: "Go to TikTok Developer Portal",
        description: "Create or access your TikTok for Developers account",
        action: "https://developers.tiktok.com/",
        actionLabel: "Open TikTok Developer Portal",
      },
      {
        title: "Create an App",
        description: "Go to Manage Apps → Create a new app → Select Content Posting API",
        tips: [
          "Select 'Web' as the platform",
          "App must be approved before use",
        ],
      },
      {
        title: "Configure Scopes",
        description: "Add scopes: video.publish, video.list, user.info.basic",
        tips: [
          "Submit app for review",
          "Review typically takes 1-3 business days",
        ],
      },
      {
        title: "Get Access Token",
        description: "After approval, use OAuth flow to get access token, or use Sandbox for testing",
        tips: [
          "Sandbox tokens work for testing",
          "Production requires app approval",
        ],
      },
    ],
  },
};

export function SocialTokenWizard({
  open,
  onOpenChange,
  platform,
  onComplete,
}: SocialTokenWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [token, setToken] = useState("");
  const [accountName, setAccountName] = useState("");
  const [copied, setCopied] = useState(false);

  const config = PLATFORM_CONFIG[platform];
  const steps = config.steps;
  const totalSteps = steps.length + 1; // +1 for final input step
  const isLastStep = currentStep === totalSteps - 1;
  const IconComponent = config.icon;

  const handleNext = () => {
    if (isLastStep) {
      if (!token.trim()) {
        toast.error("Please enter your access token");
        return;
      }
      if (!accountName.trim()) {
        toast.error("Please enter your account name");
        return;
      }
      onComplete(token.trim(), accountName.trim());
      onOpenChange(false);
      resetState();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const resetState = () => {
    setCurrentStep(0);
    setToken("");
    setAccountName("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg text-white ${config.color}`}>
              <IconComponent className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Connect {config.name}</DialogTitle>
              <DialogDescription>
                Step {currentStep + 1} of {totalSteps}
              </DialogDescription>
            </div>
          </div>
          {/* Progress bar */}
          <div className="flex gap-1 mt-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= currentStep ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="py-4">
          {!isLastStep ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Badge
                  variant="outline"
                  className="mt-0.5 shrink-0 h-6 w-6 rounded-full p-0 flex items-center justify-center"
                >
                  {currentStep + 1}
                </Badge>
                <div className="space-y-2 flex-1">
                  <h3 className="font-semibold">{steps[currentStep].title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {steps[currentStep].description}
                  </p>
                </div>
              </div>

              {steps[currentStep].action && (
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => window.open(steps[currentStep].action, "_blank")}
                >
                  <span>{steps[currentStep].actionLabel}</span>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}

              {steps[currentStep].tips && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Tips
                  </p>
                  <ul className="space-y-1">
                    {steps[currentStep].tips.map((tip, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Badge
                  variant="outline"
                  className="mt-0.5 shrink-0 h-6 w-6 rounded-full p-0 flex items-center justify-center bg-primary text-primary-foreground"
                >
                  ✓
                </Badge>
                <div className="space-y-1 flex-1">
                  <h3 className="font-semibold">Enter Your Credentials</h3>
                  <p className="text-sm text-muted-foreground">
                    Paste the access token you generated and enter your account name
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="wizard-token">Access Token</Label>
                  <div className="relative">
                    <Input
                      id="wizard-token"
                      type="password"
                      placeholder="Paste your access token here"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="pr-10"
                    />
                    {token && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => copyToClipboard(token)}
                      >
                        {copied ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wizard-account">Account Name</Label>
                  <Input
                    id="wizard-account"
                    placeholder={
                      platform === "facebook"
                        ? "Your Page Name"
                        : "@yourusername"
                    }
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {platform === "facebook"
                      ? "Enter the name of your Facebook Page"
                      : "Enter your username or handle"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button onClick={handleNext}>
            {isLastStep ? (
              "Connect Account"
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
