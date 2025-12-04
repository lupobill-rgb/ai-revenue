import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Instagram, Linkedin, Facebook, Video, CreditCard, Palette, Download, Copy, CheckCircle2, ArrowLeft } from "lucide-react";
import ubigrowthLogo from "@/assets/ubigrowth-logo.png";
import BusinessProfileTab from "@/components/BusinessProfileTab";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import ModuleToggles from "@/components/ModuleToggles";

interface SocialIntegration {
  id: string;
  platform: string;
  access_token: string;
  account_name: string | null;
  is_active: boolean;
}

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<SocialIntegration[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  
  // Brand discovery states
  const [brandWebsiteUrl, setBrandWebsiteUrl] = useState("");
  const [brandLogoFile, setBrandLogoFile] = useState<File | null>(null);
  const [extractingBrand, setExtractingBrand] = useState(false);
  const [extractedGuidelines, setExtractedGuidelines] = useState<any>(null);

  // Form states for each platform
  const [instagramToken, setInstagramToken] = useState("");
  const [instagramAccount, setInstagramAccount] = useState("");
  const [linkedinToken, setLinkedinToken] = useState("");
  const [linkedinAccount, setLinkedinAccount] = useState("");
  const [facebookToken, setFacebookToken] = useState("");
  const [facebookAccount, setFacebookAccount] = useState("");
  const [tiktokToken, setTiktokToken] = useState("");
  const [tiktokAccount, setTiktokAccount] = useState("");
  
  // Stripe credentials state
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeConnected, setStripeConnected] = useState(false);

  useEffect(() => {
    fetchIntegrations();
    fetchStripeSettings();
  }, []);

  const fetchIntegrations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("social_integrations")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load integrations",
        variant: "destructive",
      });
    } else {
      setIntegrations(data || []);
    }
  };

  const fetchStripeSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("social_integrations")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", "stripe")
      .maybeSingle();

    if (!error && data) {
      setStripeConnected(true);
    }
  };

  const saveStripeCredentials = async () => {
    if (!stripeSecretKey.trim()) {
      toast({
        title: "Error",
        description: "Stripe Secret Key is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("social_integrations")
      .upsert({
        user_id: user.id,
        platform: "stripe",
        access_token: stripeSecretKey,
        account_name: stripePublishableKey || null,
        is_active: true,
      }, {
        onConflict: "user_id,platform",
      });

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save Stripe credentials",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Stripe credentials saved successfully",
      });
      setStripeConnected(true);
      setStripeSecretKey("");
      setStripePublishableKey("");
      fetchStripeSettings();
    }
  };

  const deleteStripeCredentials = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("social_integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("platform", "stripe");

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove Stripe credentials",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Stripe credentials removed",
      });
      setStripeConnected(false);
      fetchStripeSettings();
    }
  };

  const saveIntegration = async (platform: string, accessToken: string, accountName: string) => {
    if (!accessToken.trim()) {
      toast({
        title: "Error",
        description: "Access token is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("social_integrations")
      .upsert({
        user_id: user.id,
        platform,
        access_token: accessToken,
        account_name: accountName || null,
        is_active: true,
      }, {
        onConflict: "user_id,platform",
      });

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: `Failed to save ${platform} integration`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `${platform} integration saved successfully`,
      });
      fetchIntegrations();
      
      // Clear form
      if (platform === "instagram") {
        setInstagramToken("");
        setInstagramAccount("");
      } else if (platform === "linkedin") {
        setLinkedinToken("");
        setLinkedinAccount("");
      } else if (platform === "facebook") {
        setFacebookToken("");
        setFacebookAccount("");
      } else if (platform === "tiktok") {
        setTiktokToken("");
        setTiktokAccount("");
      }
    }
  };

  const deleteIntegration = async (platform: string) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("social_integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("platform", platform);

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: `Failed to remove ${platform} integration`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `${platform} integration removed`,
      });
      fetchIntegrations();
    }
  };

  const isConnected = (platform: string) => {
    return integrations.some(i => i.platform === platform && i.is_active);
  };

  const getAccountName = (platform: string) => {
    return integrations.find(i => i.platform === platform)?.account_name;
  };

  const testConnection = async (platform: string) => {
    setTesting(prev => ({ ...prev, [platform]: true }));

    try {
      const { data, error } = await supabase.functions.invoke('social-test-connection', {
        body: { platform }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Connection Successful",
          description: `${platform} credentials are valid${data.accountInfo ? ` - ${data.accountInfo}` : ''}`,
        });
        fetchIntegrations();
      } else {
        toast({
          title: "Connection Failed",
          description: data.message || `${platform} credentials are invalid`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Test Failed",
        description: `Unable to test ${platform} connection: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setTesting(prev => ({ ...prev, [platform]: false }));
    }
  };

  const copyToClipboard = (text: string, colorName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedColor(colorName);
    toast({
      title: "Copied!",
      description: `${colorName} color code copied to clipboard`,
    });
    setTimeout(() => setCopiedColor(null), 2000);
  };

  const handleExtractBrandGuidelines = async () => {
    if (!brandWebsiteUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a website URL",
        variant: "destructive",
      });
      return;
    }

    setExtractingBrand(true);
    setExtractedGuidelines(null);

    try {
      // Convert logo to base64 if provided
      let logoBase64 = undefined;
      if (brandLogoFile) {
        const reader = new FileReader();
        logoBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(brandLogoFile);
        });
      }

      const { data, error } = await supabase.functions.invoke('extract-brand-guidelines', {
        body: {
          websiteUrl: brandWebsiteUrl,
          logoImageBase64: logoBase64,
        }
      });

      if (error) throw error;

      if (data.success) {
        setExtractedGuidelines(data.brandGuidelines);
        toast({
          title: "Success!",
          description: "Brand guidelines extracted successfully. Review and customize below.",
        });
      } else {
        throw new Error(data.error || "Failed to extract brand guidelines");
      }
    } catch (error) {
      console.error("Error extracting brand guidelines:", error);
      toast({
        title: "Extraction Failed",
        description: error instanceof Error ? error.message : "Unable to extract brand guidelines",
        variant: "destructive",
      });
    } finally {
      setExtractingBrand(false);
    }
  };

  const brandColors = [
    { name: "UbiGrowth Cyan", hex: "#00D4FF", rgb: "rgb(0, 212, 255)", description: "Primary brand color for logos and key elements" },
    { name: "UbiGrowth Light", hex: "#66E5FF", rgb: "rgb(102, 229, 255)", description: "Accent color for highlights and hover states" },
    { name: "Dark Background", hex: "#0D1117", rgb: "rgb(13, 17, 23)", description: "Primary background color for dark themes" },
    { name: "Secondary Dark", hex: "#161B22", rgb: "rgb(22, 27, 34)", description: "Card and surface backgrounds" },
    { name: "White", hex: "#FFFFFF", rgb: "rgb(255, 255, 255)", description: "Text on dark backgrounds" },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <main className="flex-1 container mx-auto py-8 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="mb-4 -ml-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground mt-2">Manage your integrations and brand guidelines</p>
            </div>

            <Tabs defaultValue="integrations" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
            <TabsTrigger value="profile">Business Profile</TabsTrigger>
            <TabsTrigger value="discovery">Brand Discovery</TabsTrigger>
            <TabsTrigger value="brand">Brand Guidelines</TabsTrigger>
          </TabsList>

          <TabsContent value="modules" className="space-y-6">
            <ModuleToggles />
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
        {/* Stripe Billing Section */}
        <Card className="bg-accent/5 border-accent/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-2xl">Stripe Billing</CardTitle>
                <CardDescription className="text-base">
                  Connect your Stripe account to track spending and manage your UbiGrowth subscription payments.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!stripeConnected ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="stripe-secret">Stripe Secret Key</Label>
                  <Input
                    id="stripe-secret"
                    type="password"
                    placeholder="sk_live_..."
                    value={stripeSecretKey}
                    onChange={(e) => setStripeSecretKey(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Your Secret Key from the Stripe Dashboard (Developers → API keys)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stripe-publishable">Stripe Publishable Key (Optional)</Label>
                  <Input
                    id="stripe-publishable"
                    type="text"
                    placeholder="pk_live_..."
                    value={stripePublishableKey}
                    onChange={(e) => setStripePublishableKey(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Your Publishable Key (optional, for frontend integration)
                  </p>
                </div>
                <Button
                  onClick={saveStripeCredentials}
                  disabled={loading}
                >
                  Save Stripe Credentials
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="default">Connected</Badge>
                  <span className="text-muted-foreground">Your Stripe account is connected and active</span>
                </div>
                <Button
                  variant="destructive"
                  onClick={deleteStripeCredentials}
                  disabled={loading}
                >
                  Disconnect Stripe
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl">Social Media Integrations</CardTitle>
            <CardDescription className="text-base">
              Connect your social media accounts to enable automated campaign deployment.
              Your access tokens are stored securely and only used to post your approved marketing content.
            </CardDescription>
            <div className="mt-4 text-sm text-foreground">
              <p className="font-semibold">To make sure credentials work, you must paste <span className="underline">valid, active access tokens</span> from each platform:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Instagram:</strong> Use Meta for Developers to generate a long‑lived Instagram token.</li>
                <li><strong>LinkedIn:</strong> Create an app in the LinkedIn Developer Portal and copy the correct access token.</li>
                <li><strong>Facebook:</strong> Use Facebook Business Manager or Meta for Developers to create a Page access token.</li>
                <li><strong>TikTok:</strong> Use TikTok for Developers to generate an access token with publishing permissions.</li>
              </ul>
            </div>
          </CardHeader>
        </Card>

        {/* Connection Status Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Instagram className="h-4 w-4 text-pink-500" />
                <span className="text-sm font-medium">Instagram:</span>
                <Badge variant={isConnected("instagram") ? "default" : "secondary"}>
                  {isConnected("instagram") ? "Connected" : "Not Connected"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">LinkedIn:</span>
                <Badge variant={isConnected("linkedin") ? "default" : "secondary"}>
                  {isConnected("linkedin") ? "Connected" : "Not Connected"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Facebook className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Facebook:</span>
                <Badge variant={isConnected("facebook") ? "default" : "secondary"}>
                  {isConnected("facebook") ? "Connected" : "Not Connected"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                <span className="text-sm font-medium">TikTok:</span>
                <Badge variant={isConnected("tiktok") ? "default" : "secondary"}>
                  {isConnected("tiktok") ? "Connected" : "Not Connected"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instagram */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Instagram className="h-6 w-6 text-pink-500" />
              <div>
                <CardTitle>Instagram</CardTitle>
                <CardDescription>
                  {isConnected("instagram") 
                    ? `Connected as ${getAccountName("instagram") || "Unknown"}`
                    : "Connect your Instagram account"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isConnected("instagram") ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="instagram-token">Access Token</Label>
                  <Input
                    id="instagram-token"
                    type="password"
                    placeholder="Enter Instagram access token"
                    value={instagramToken}
                    onChange={(e) => setInstagramToken(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram-account">Account Name (Optional)</Label>
                  <Input
                    id="instagram-account"
                    placeholder="@youraccount"
                    value={instagramAccount}
                    onChange={(e) => setInstagramAccount(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => saveIntegration("instagram", instagramToken, instagramAccount)}
                  disabled={loading}
                >
                  Connect Instagram
                </Button>
              </>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => testConnection("instagram")}
                  disabled={testing.instagram}
                >
                  {testing.instagram ? "Testing..." : "Test Connection"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteIntegration("instagram")}
                  disabled={loading}
                >
                  Disconnect
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* LinkedIn */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Linkedin className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle>LinkedIn</CardTitle>
                <CardDescription>
                  {isConnected("linkedin") 
                    ? `Connected as ${getAccountName("linkedin") || "Unknown"}`
                    : "Connect your LinkedIn account"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isConnected("linkedin") ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="linkedin-token">Access Token</Label>
                  <Input
                    id="linkedin-token"
                    type="password"
                    placeholder="Enter LinkedIn access token"
                    value={linkedinToken}
                    onChange={(e) => setLinkedinToken(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedin-account">Account Name (Optional)</Label>
                  <Input
                    id="linkedin-account"
                    placeholder="Your Name or Company"
                    value={linkedinAccount}
                    onChange={(e) => setLinkedinAccount(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => saveIntegration("linkedin", linkedinToken, linkedinAccount)}
                  disabled={loading}
                >
                  Connect LinkedIn
                </Button>
              </>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => testConnection("linkedin")}
                  disabled={testing.linkedin}
                >
                  {testing.linkedin ? "Testing..." : "Test Connection"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteIntegration("linkedin")}
                  disabled={loading}
                >
                  Disconnect
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Facebook */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Facebook className="h-6 w-6 text-blue-500" />
              <div>
                <CardTitle>Facebook</CardTitle>
                <CardDescription>
                  {isConnected("facebook") 
                    ? `Connected as ${getAccountName("facebook") || "Unknown"}`
                    : "Connect your Facebook account"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isConnected("facebook") ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="facebook-token">Access Token</Label>
                  <Input
                    id="facebook-token"
                    type="password"
                    placeholder="Enter Facebook access token"
                    value={facebookToken}
                    onChange={(e) => setFacebookToken(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook-account">Account Name (Optional)</Label>
                  <Input
                    id="facebook-account"
                    placeholder="Your Page Name"
                    value={facebookAccount}
                    onChange={(e) => setFacebookAccount(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => saveIntegration("facebook", facebookToken, facebookAccount)}
                  disabled={loading}
                >
                  Connect Facebook
                </Button>
              </>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => testConnection("facebook")}
                  disabled={testing.facebook}
                >
                  {testing.facebook ? "Testing..." : "Test Connection"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteIntegration("facebook")}
                  disabled={loading}
                >
                  Disconnect
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TikTok */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Video className="h-6 w-6" />
              <div>
                <CardTitle>TikTok</CardTitle>
                <CardDescription>
                  {isConnected("tiktok") 
                    ? `Connected as ${getAccountName("tiktok") || "Unknown"}`
                    : "Connect your TikTok account"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isConnected("tiktok") ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tiktok-token">Access Token</Label>
                  <Input
                    id="tiktok-token"
                    type="password"
                    placeholder="Enter TikTok access token"
                    value={tiktokToken}
                    onChange={(e) => setTiktokToken(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktok-account">Account Name (Optional)</Label>
                  <Input
                    id="tiktok-account"
                    placeholder="@youraccount"
                    value={tiktokAccount}
                    onChange={(e) => setTiktokAccount(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => saveIntegration("tiktok", tiktokToken, tiktokAccount)}
                  disabled={loading}
                >
                  Connect TikTok
                </Button>
              </>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => testConnection("tiktok")}
                  disabled={testing.tiktok}
                >
                  {testing.tiktok ? "Testing..." : "Test Connection"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteIntegration("tiktok")}
                  disabled={loading}
                >
                  Disconnect
                </Button>
              </div>
             )}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <BusinessProfileTab />
        </TabsContent>

        <TabsContent value="discovery" className="space-y-6">
          {/* Brand Discovery Tool */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Palette className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle className="text-2xl">Automated Brand Discovery</CardTitle>
                  <CardDescription className="text-base">
                    Automatically extract brand guidelines from your website and logo. Our AI will analyze colors, fonts, messaging, and brand voice.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="brand-url">Website URL</Label>
                  <Input
                    id="brand-url"
                    type="url"
                    placeholder="https://yourcompany.com"
                    value={brandWebsiteUrl}
                    onChange={(e) => setBrandWebsiteUrl(e.target.value)}
                    disabled={extractingBrand}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your company website to analyze brand colors, fonts, and messaging
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand-logo">Logo Upload (Optional)</Label>
                  <Input
                    id="brand-logo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setBrandLogoFile(e.target.files?.[0] || null)}
                    disabled={extractingBrand}
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload your logo for more accurate color extraction
                  </p>
                </div>

                <Button
                  onClick={handleExtractBrandGuidelines}
                  disabled={extractingBrand || !brandWebsiteUrl.trim()}
                  className="w-full"
                >
                  {extractingBrand ? (
                    <>
                      <span className="animate-spin mr-2">⚙️</span>
                      Analyzing Brand...
                    </>
                  ) : (
                    "Extract Brand Guidelines"
                  )}
                </Button>
              </div>

              {extractedGuidelines && (
                <div className="space-y-4 pt-6 border-t">
                  <h3 className="text-lg font-semibold text-foreground">Extracted Brand Guidelines</h3>
                  
                  <div className="space-y-3">
                    <div className="p-4 border border-border rounded-lg bg-card">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Brand Name</p>
                      <p className="text-xl font-bold text-foreground">{extractedGuidelines.brandName}</p>
                    </div>

                    <div className="p-4 border border-border rounded-lg bg-card">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Industry</p>
                      <p className="text-foreground">{extractedGuidelines.industry}</p>
                    </div>

                    <div className="p-4 border border-border rounded-lg bg-card">
                      <p className="text-sm font-medium text-muted-foreground mb-3">Brand Colors</p>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {Object.entries({
                          'Primary': extractedGuidelines.primaryColor,
                          'Secondary': extractedGuidelines.secondaryColor,
                          'Accent': extractedGuidelines.accentColor,
                          'Background': extractedGuidelines.backgroundColor,
                          'Text': extractedGuidelines.textColor,
                        }).map(([name, color]) => (
                          <div key={name} className="space-y-2">
                            <div
                              className="w-full h-16 rounded-md border-2 border-border shadow-sm"
                              style={{ backgroundColor: color as string }}
                            />
                            <p className="text-xs font-medium text-foreground">{name}</p>
                            <p className="text-xs font-mono text-muted-foreground">{color as string}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 border border-border rounded-lg bg-card">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Typography</p>
                      <div className="space-y-2">
                        <p className="text-sm"><span className="font-medium">Primary Font:</span> {extractedGuidelines.primaryFont}</p>
                        <p className="text-sm"><span className="font-medium">Secondary Font:</span> {extractedGuidelines.secondaryFont}</p>
                      </div>
                    </div>

                    <div className="p-4 border border-border rounded-lg bg-card">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Brand Voice</p>
                      <p className="text-sm text-foreground">{extractedGuidelines.brandVoice}</p>
                    </div>

                    <div className="p-4 border border-border rounded-lg bg-card">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Key Messaging</p>
                      <ul className="list-disc list-inside space-y-1">
                        {extractedGuidelines.keyMessaging?.map((msg: string, idx: number) => (
                          <li key={idx} className="text-sm text-foreground">{msg}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button variant="outline" onClick={() => setExtractedGuidelines(null)}>
                        Extract Again
                      </Button>
                      <Button onClick={async () => {
                        try {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) {
                            toast({
                              title: "Error",
                              description: "You must be logged in to apply guidelines",
                              variant: "destructive",
                            });
                            return;
                          }

                          const brandColors = {
                            primary: extractedGuidelines.primaryColor,
                            secondary: extractedGuidelines.secondaryColor,
                            accent: extractedGuidelines.accentColor,
                            background: extractedGuidelines.backgroundColor,
                            text: extractedGuidelines.textColor,
                          };

                          const brandFonts = {
                            primary: extractedGuidelines.primaryFont,
                            secondary: extractedGuidelines.secondaryFont,
                          };

                          const { error } = await supabase
                            .from("business_profiles")
                            .upsert({
                              user_id: user.id,
                              business_name: extractedGuidelines.brandName,
                              brand_colors: brandColors,
                              brand_fonts: brandFonts,
                              brand_voice: extractedGuidelines.brandVoice,
                              messaging_pillars: extractedGuidelines.keyMessaging,
                              industry: extractedGuidelines.industry,
                              updated_at: new Date().toISOString(),
                            }, {
                              onConflict: "user_id",
                            });

                          if (error) throw error;

                          toast({
                            title: "Guidelines Applied",
                            description: "Brand guidelines have been saved to your business profile and will be used in campaign generation.",
                          });
                        } catch (error) {
                          console.error("Error applying guidelines:", error);
                          toast({
                            title: "Error",
                            description: "Failed to apply guidelines. Please try again.",
                            variant: "destructive",
                          });
                        }
                      }}>
                        Apply Guidelines
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brand" className="space-y-6">
            {/* Logo Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Palette className="h-6 w-6 text-primary" />
                  <div>
                    <CardTitle className="text-2xl">UbiGrowth Brand Guidelines</CardTitle>
                    <CardDescription className="text-base">
                      Official logo usage guidelines and brand colors for all UbiGrowth marketing materials
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Logo Display */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Official Logo</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">Light Backgrounds</p>
                      <div className="bg-white border border-border rounded-lg p-8 flex items-center justify-center">
                        <img src={ubigrowthLogo} alt="UbiGrowth Logo" className="h-16 w-auto" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">Dark Backgrounds</p>
                      <div className="bg-gray-900 border border-border rounded-lg p-8 flex items-center justify-center">
                        <img src={ubigrowthLogo} alt="UbiGrowth Logo" className="h-16 w-auto" />
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="mt-2">
                    <Download className="mr-2 h-4 w-4" />
                    Download Logo Assets
                  </Button>
                </div>

                {/* Logo Usage Guidelines */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Logo Usage Guidelines</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">Always maintain clear space around the logo equal to the height of the "P" letter</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">Use official brand colors only - never alter logo colors</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">Ensure logo is visible and legible on all backgrounds</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">Minimum size: 120px width for digital, 1 inch for print</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Brand Colors */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Brand Colors</h3>
                  <p className="text-sm text-muted-foreground">
                    Official UbiGrowth brand color palette. Click any color code to copy.
                  </p>
                  <div className="grid gap-4">
                    {brandColors.map((color) => (
                      <div key={color.name} className="flex items-center gap-4 p-4 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                        <div
                          className="w-16 h-16 rounded-md border-2 border-border shadow-sm flex-shrink-0"
                          style={{ backgroundColor: color.hex }}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground">{color.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{color.description}</p>
                          <div className="flex gap-3 mt-2 flex-wrap">
                            <button
                              onClick={() => copyToClipboard(color.hex, `${color.name} HEX`)}
                              className="inline-flex items-center gap-1.5 text-xs font-mono bg-secondary px-2 py-1 rounded hover:bg-secondary/80 transition-colors"
                            >
                              {copiedColor === `${color.name} HEX` ? (
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              {color.hex}
                            </button>
                            <button
                              onClick={() => copyToClipboard(color.rgb, `${color.name} RGB`)}
                              className="inline-flex items-center gap-1.5 text-xs font-mono bg-secondary px-2 py-1 rounded hover:bg-secondary/80 transition-colors"
                            >
                              {copiedColor === `${color.name} RGB` ? (
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              {color.rgb}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Typography Guidelines */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Typography</h3>
                  <div className="space-y-3">
                    <div className="p-4 border border-border rounded-lg bg-card">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Primary Font</p>
                      <p className="text-2xl font-bold text-foreground">Inter (Bold, Semibold, Regular)</p>
                      <p className="text-xs text-muted-foreground mt-2">Used for headlines, titles, and body text</p>
                    </div>
                  </div>
                </div>

                {/* Brand Voice */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Brand Voice & Messaging</h3>
                  <div className="space-y-3 text-sm">
                    <div className="p-4 border border-border rounded-lg bg-card">
                      <p className="font-medium text-foreground mb-2">AI-Powered Marketing</p>
                      <p className="text-muted-foreground">
                        UbiGrowth AI delivers intelligent marketing automation that adapts to your business needs. 
                        Our platform learns from your campaigns to continuously optimize performance across all channels.
                      </p>
                    </div>
                    <div className="p-4 border border-border rounded-lg bg-card">
                      <p className="font-medium text-foreground mb-2">Tone</p>
                      <p className="text-muted-foreground">
                        Professional, innovative, data-driven, and results-focused. We combine cutting-edge AI 
                        with proven marketing strategies to deliver measurable growth for your business.
                      </p>
                    </div>
                    <div className="p-4 border border-border rounded-lg bg-card">
                      <p className="font-medium text-foreground mb-2">Key Messaging</p>
                      <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        <li>AI-powered marketing automation</li>
                        <li>Multi-channel campaign orchestration</li>
                        <li>Real-time performance analytics</li>
                        <li>Scalable growth solutions for any business</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
            </Tabs>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}