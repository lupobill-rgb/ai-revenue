import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Logo from "@/components/Logo";
import { Globe, Sparkles, Building2, Loader2, Check, Upload } from "lucide-react";

const VERTICALS = [
  "Accounting & Finance",
  "Advertising & Marketing",
  "Aerospace & Defense",
  "Agriculture & Farming",
  "Automotive",
  "Banking & Financial Services",
  "Biotechnology & Pharmaceuticals",
  "Construction & Engineering",
  "Consulting & Professional Services",
  "Consumer Goods & Retail",
  "E-commerce",
  "Education & Training",
  "Energy & Utilities",
  "Entertainment & Media",
  "Environmental Services",
  "Food & Beverage",
  "Government & Public Sector",
  "Healthcare & Medical",
  "Hospitality & Tourism",
  "Human Resources & Staffing",
  "Information Technology",
  "Insurance",
  "Legal Services",
  "Logistics & Transportation",
  "Manufacturing",
  "Non-Profit & NGO",
  "Real Estate & Property",
  "Restaurants & Food Service",
  "SaaS & Software",
  "Sports & Recreation",
  "Telecommunications",
  "Travel & Leisure",
  "Other",
];

interface BrandGuidelines {
  brandName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  headingFont?: string;
  bodyFont?: string;
  brandVoice?: string;
  brandTone?: string;
  messagingPillars?: string[];
  industry?: string;
}

const Onboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  
  // Step 1: Business basics
  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [vertical, setVertical] = useState("");
  
  // Step 2: Extracted brand guidelines
  const [brandGuidelines, setBrandGuidelines] = useState<BrandGuidelines | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/signup");
      }
    });
  }, [navigate]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const extractBrandGuidelines = async () => {
    if (!websiteUrl) {
      toast({
        variant: "destructive",
        title: "Website URL required",
        description: "Please enter your website URL to extract brand guidelines.",
      });
      return;
    }

    setIsExtracting(true);
    try {
      let logoBase64 = null;
      if (logoFile) {
        const reader = new FileReader();
        logoBase64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(logoFile);
        });
      }

      const { data, error } = await supabase.functions.invoke('extract-brand-guidelines', {
        body: { 
          websiteUrl,
          logoImageBase64: logoBase64
        }
      });

      if (error) throw error;

      if (data?.brandGuidelines) {
        setBrandGuidelines(data.brandGuidelines);
        if (data.brandGuidelines.brandName && !businessName) {
          setBusinessName(data.brandGuidelines.brandName);
        }
        if (data.brandGuidelines.industry && !vertical) {
          const matchedVertical = VERTICALS.find(v => 
            v.toLowerCase().includes(data.brandGuidelines.industry?.toLowerCase() || '')
          );
          if (matchedVertical) setVertical(matchedVertical);
        }
        toast({
          title: "Brand guidelines extracted!",
          description: "We've analyzed your website and extracted your brand details.",
        });
        setStep(2);
      }
    } catch (error) {
      console.error('Error extracting brand guidelines:', error);
      toast({
        variant: "destructive",
        title: "Extraction failed",
        description: "Could not extract brand guidelines. You can continue with manual setup.",
      });
      setStep(2);
    } finally {
      setIsExtracting(false);
    }
  };

  const saveBusinessProfile = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let uploadedLogoUrl: string | null = null;

      // Upload logo to storage if provided
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${user.id}/logo.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('cmo-assets')
          .upload(fileName, logoFile, { upsert: true });
        
        if (uploadError) {
          console.error('Logo upload error:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('cmo-assets')
            .getPublicUrl(fileName);
          uploadedLogoUrl = urlData.publicUrl;
        }
      }

      const profileData = {
        user_id: user.id,
        business_name: businessName,
        industry: vertical,
        brand_voice: brandGuidelines?.brandVoice || "Professional and friendly",
        brand_tone: brandGuidelines?.brandTone || "Approachable yet authoritative",
        brand_colors: {
          primary: brandGuidelines?.primaryColor || "#00d4ff",
          secondary: brandGuidelines?.secondaryColor || "#1a1a2e",
          accent: brandGuidelines?.accentColor || "#00d4ff",
        },
        brand_fonts: {
          heading: brandGuidelines?.headingFont || "Inter",
          body: brandGuidelines?.bodyFont || "Inter",
        },
        messaging_pillars: brandGuidelines?.messagingPillars || [],
        business_description: `${businessName} - ${vertical}`,
        logo_url: uploadedLogoUrl,
      };

      const { error } = await supabase
        .from('business_profiles')
        .upsert(profileData, { onConflict: 'user_id' });

      if (error) throw error;

      toast({
        title: "Setup complete!",
        description: "Your business profile has been created. Let's start marketing!",
      });
      navigate("/dashboard");
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save your business profile. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg animate-fade-in border-border bg-card">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <Logo className="h-10" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {step === 1 ? "Let's Set Up Your Business" : "Review Your Brand"}
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              {step === 1 
                ? "Enter your website and we'll extract your brand guidelines automatically"
                : "Confirm your brand details to personalize your marketing"
              }
            </CardDescription>
          </div>
          
          {/* Progress indicator */}
          <div className="flex justify-center gap-2 pt-2">
            <div className={`h-2 w-16 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-16 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="businessName" className="text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Business Name
                </Label>
                <Input
                  id="businessName"
                  type="text"
                  placeholder="Your Company Name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  disabled={isExtracting}
                  className="bg-background border-input text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="websiteUrl" className="text-foreground flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Website URL
                </Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  placeholder="https://yourcompany.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  disabled={isExtracting}
                  className="bg-background border-input text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  We'll analyze your website to extract colors, fonts, and brand voice
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vertical" className="text-foreground">
                  Industry Vertical
                </Label>
                <Select value={vertical} onValueChange={setVertical} disabled={isExtracting}>
                  <SelectTrigger className="bg-background border-input text-foreground">
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {VERTICALS.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Logo (Optional)
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={isExtracting}
                    className="bg-background border-input text-foreground"
                  />
                  {logoPreview && (
                    <img src={logoPreview} alt="Logo preview" className="h-10 w-10 object-contain rounded" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload your logo to extract brand colors
                </p>
              </div>

              <Button
                onClick={extractBrandGuidelines}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isExtracting || !businessName}
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing your brand...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Extract Brand Guidelines
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={() => setStep(2)}
                className="w-full text-muted-foreground"
                disabled={isExtracting}
              >
                Skip and set up manually
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Business Details
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="text-foreground">{businessName || "Not set"}</span>
                    <span className="text-muted-foreground">Industry:</span>
                    <span className="text-foreground">{vertical || "Not set"}</span>
                  </div>
                </div>

                {brandGuidelines && (
                  <>
                    <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
                      <h3 className="font-semibold text-foreground">Brand Colors</h3>
                      <div className="flex gap-3">
                        {brandGuidelines.primaryColor && (
                          <div className="flex flex-col items-center gap-1">
                            <div 
                              className="h-8 w-8 rounded-full border border-border" 
                              style={{ backgroundColor: brandGuidelines.primaryColor }}
                            />
                            <span className="text-xs text-muted-foreground">Primary</span>
                          </div>
                        )}
                        {brandGuidelines.secondaryColor && (
                          <div className="flex flex-col items-center gap-1">
                            <div 
                              className="h-8 w-8 rounded-full border border-border" 
                              style={{ backgroundColor: brandGuidelines.secondaryColor }}
                            />
                            <span className="text-xs text-muted-foreground">Secondary</span>
                          </div>
                        )}
                        {brandGuidelines.accentColor && (
                          <div className="flex flex-col items-center gap-1">
                            <div 
                              className="h-8 w-8 rounded-full border border-border" 
                              style={{ backgroundColor: brandGuidelines.accentColor }}
                            />
                            <span className="text-xs text-muted-foreground">Accent</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {brandGuidelines.brandVoice && (
                      <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
                        <h3 className="font-semibold text-foreground">Brand Voice</h3>
                        <p className="text-sm text-muted-foreground">{brandGuidelines.brandVoice}</p>
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="editBusinessName" className="text-foreground">
                    Business Name
                  </Label>
                  <Input
                    id="editBusinessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="bg-background border-input text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editVertical" className="text-foreground">
                    Industry Vertical
                  </Label>
                  <Select value={vertical} onValueChange={setVertical}>
                    <SelectTrigger className="bg-background border-input text-foreground">
                      <SelectValue placeholder="Select your industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {VERTICALS.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1"
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button
                  onClick={saveBusinessProfile}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isLoading || !businessName || !vertical}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Complete Setup"
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
