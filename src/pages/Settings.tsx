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
import { Palette, Copy, CheckCircle2, ArrowLeft } from "lucide-react";
import BusinessProfileTab from "@/components/BusinessProfileTab";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import ModuleToggles from "@/components/ModuleToggles";
import ChannelToggles from "@/components/ChannelToggles";
import TeamManagement from "@/components/TeamManagement";

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [brandSubSection, setBrandSubSection] = useState<'profile' | 'discovery' | 'guidelines'>('profile');
  
  // Brand discovery states
  const [brandWebsiteUrl, setBrandWebsiteUrl] = useState("");
  const [brandLogoFile, setBrandLogoFile] = useState<File | null>(null);
  const [extractingBrand, setExtractingBrand] = useState(false);
  const [extractedGuidelines, setExtractedGuidelines] = useState<any>(null);
  
  // Customer business profile state
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    initializeWorkspace();
  }, []);

  const initializeWorkspace = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get workspace ID
    const { data: ownedWorkspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    let wsId = ownedWorkspace?.id;

    if (!wsId) {
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .maybeSingle();
      wsId = membership?.workspace_id;
    }

    if (wsId) {
      setWorkspaceId(wsId);
      fetchBusinessProfile(wsId);
    }
  };

  const fetchBusinessProfile = async (wsId: string) => {
    setLoadingProfile(true);

    const { data, error } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("workspace_id", wsId)
      .maybeSingle();

    if (!error && data) {
      setBusinessProfile(data);
    }
    setLoadingProfile(false);
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

  const applyExtractedGuidelines = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !workspaceId) {
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
          workspace_id: workspaceId,
          business_name: extractedGuidelines.brandName,
          brand_colors: brandColors,
          brand_fonts: brandFonts,
          brand_voice: extractedGuidelines.brandVoice,
          messaging_pillars: extractedGuidelines.keyMessaging,
          industry: extractedGuidelines.industry,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "workspace_id",
        });

      if (error) throw error;

      await fetchBusinessProfile(workspaceId);
      setProfileRefreshKey(prev => prev + 1);

      toast({
        title: "Guidelines Applied",
        description: "Brand guidelines have been saved to your business profile.",
      });
    } catch (error) {
      console.error("Error applying guidelines:", error);
      toast({
        title: "Error",
        description: "Failed to apply guidelines. Please try again.",
        variant: "destructive",
      });
    }
  };

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
              <p className="text-muted-foreground mt-2">Manage your team, channels, modules and brand guidelines</p>
            </div>

            <Tabs defaultValue="team" className="space-y-6">
              <TabsList className="w-full flex gap-1 h-auto flex-wrap justify-start p-1">
                <TabsTrigger value="team" className="px-4">Team</TabsTrigger>
                <TabsTrigger value="channels" className="px-4">Channels</TabsTrigger>
                <TabsTrigger value="modules" className="px-4">Modules</TabsTrigger>
                <TabsTrigger value="brand" className="px-4">Brand</TabsTrigger>
              </TabsList>

              {/* Team Tab */}
              <TabsContent value="team" className="space-y-6">
                <TeamManagement />
              </TabsContent>

              {/* Channels Tab */}
              <TabsContent value="channels" className="space-y-6">
                <ChannelToggles />
              </TabsContent>

              {/* Modules Tab */}
              <TabsContent value="modules" className="space-y-6">
                <ModuleToggles />
              </TabsContent>

              {/* Brand Tab */}
              <TabsContent value="brand" className="space-y-6">
                <div className="flex gap-2 mb-6">
                  <Button
                    variant={brandSubSection === 'profile' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBrandSubSection('profile')}
                  >
                    Business Profile
                  </Button>
                  <Button
                    variant={brandSubSection === 'discovery' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBrandSubSection('discovery')}
                  >
                    Brand Discovery
                  </Button>
                  <Button
                    variant={brandSubSection === 'guidelines' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBrandSubSection('guidelines')}
                  >
                    Brand Guidelines
                  </Button>
                </div>

                {brandSubSection === 'profile' && (
                  <BusinessProfileTab key={profileRefreshKey} />
                )}

                {brandSubSection === 'discovery' && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <Palette className="h-6 w-6 text-primary" />
                        <div>
                          <CardTitle className="text-2xl">Automated Brand Discovery</CardTitle>
                          <CardDescription className="text-base">
                            Extract brand guidelines from your website and logo using AI.
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
                        </div>

                        <Button
                          onClick={handleExtractBrandGuidelines}
                          disabled={extractingBrand || !brandWebsiteUrl.trim()}
                          className="w-full"
                        >
                          {extractingBrand ? "Analyzing Brand..." : "Extract Brand Guidelines"}
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

                            <div className="flex gap-2 pt-4">
                              <Button variant="outline" onClick={() => setExtractedGuidelines(null)}>
                                Extract Again
                              </Button>
                              <Button onClick={applyExtractedGuidelines}>
                                Apply Guidelines
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {brandSubSection === 'guidelines' && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <Palette className="h-6 w-6 text-primary" />
                        <div>
                          <CardTitle className="text-2xl">
                            {businessProfile?.business_name ? `${businessProfile.business_name} Brand Guidelines` : "Your Brand Guidelines"}
                          </CardTitle>
                          <CardDescription className="text-base">
                            Your brand colors, typography, and messaging for all marketing materials
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-8">
                      {loadingProfile ? (
                        <div className="text-center py-8 text-muted-foreground">Loading brand guidelines...</div>
                      ) : !businessProfile?.brand_colors && !businessProfile?.brand_voice ? (
                        <div className="text-center py-12 space-y-4">
                          <Palette className="h-12 w-12 text-muted-foreground mx-auto" />
                          <h3 className="text-lg font-semibold text-foreground">No Brand Guidelines Set</h3>
                          <p className="text-muted-foreground max-w-md mx-auto">
                            Use Brand Discovery to automatically extract your brand guidelines.
                          </p>
                          <Button onClick={() => setBrandSubSection('discovery')}>
                            Go to Brand Discovery
                          </Button>
                        </div>
                      ) : (
                        <>
                          {businessProfile?.logo_url && (
                            <div className="space-y-4">
                              <h3 className="text-lg font-semibold text-foreground">Logo</h3>
                              <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                  <p className="text-sm font-medium text-muted-foreground">Light Backgrounds</p>
                                  <div className="bg-white border border-border rounded-lg p-8 flex items-center justify-center">
                                    <img src={businessProfile.logo_url} alt="Logo" className="h-16 w-auto max-w-full object-contain" />
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <p className="text-sm font-medium text-muted-foreground">Dark Backgrounds</p>
                                  <div className="bg-gray-900 border border-border rounded-lg p-8 flex items-center justify-center">
                                    <img src={businessProfile.logo_url} alt="Logo" className="h-16 w-auto max-w-full object-contain" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {businessProfile?.brand_colors && Object.keys(businessProfile.brand_colors).length > 0 && (
                            <div className="space-y-4">
                              <h3 className="text-lg font-semibold text-foreground">Brand Colors</h3>
                              <div className="grid gap-4">
                                {Object.entries(businessProfile.brand_colors).map(([name, hex]) => (
                                  <div key={name} className="flex items-center gap-4 p-4 border border-border rounded-lg bg-card">
                                    <div
                                      className="w-16 h-16 rounded-md border-2 border-border shadow-sm flex-shrink-0"
                                      style={{ backgroundColor: hex as string }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-semibold text-foreground capitalize">{name}</h4>
                                      <button
                                        onClick={() => copyToClipboard(hex as string, `${name} color`)}
                                        className="inline-flex items-center gap-1.5 text-xs font-mono bg-secondary px-2 py-1 rounded mt-2"
                                      >
                                        {copiedColor === `${name} color` ? (
                                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                                        ) : (
                                          <Copy className="h-3 w-3" />
                                        )}
                                        {hex as string}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {businessProfile?.brand_voice && (
                            <div className="space-y-4">
                              <h3 className="text-lg font-semibold text-foreground">Brand Voice</h3>
                              <div className="p-4 border border-border rounded-lg bg-card">
                                <p className="text-muted-foreground">{businessProfile.brand_voice}</p>
                              </div>
                            </div>
                          )}

                          {businessProfile?.industry && (
                            <div className="space-y-4">
                              <h3 className="text-lg font-semibold text-foreground">Industry</h3>
                              <div className="p-4 border border-border rounded-lg bg-card">
                                <Badge variant="secondary">{businessProfile.industry}</Badge>
                              </div>
                            </div>
                          )}

                          <div className="pt-4 border-t">
                            <Button variant="outline" onClick={() => setBrandSubSection('discovery')}>
                              Update Brand Guidelines
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
