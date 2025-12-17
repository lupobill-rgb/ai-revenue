import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Target, FileText, Palette, CheckCircle2 } from "lucide-react";
import { getWorkspaceId } from "@/hooks/useWorkspace";

interface BrandColors {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
}

interface BrandFonts {
  primary?: string;
  secondary?: string;
}

interface BusinessProfile {
  id?: string;
  business_name: string;
  business_description: string;
  unique_selling_points: string[];
  competitive_advantages: string;
  industry: string;
  brand_voice: string;
  brand_tone: string;
  content_tone: string;
  content_length: string;
  imagery_style: string;
  brand_colors?: BrandColors;
  brand_fonts?: BrandFonts;
}

export default function BusinessProfileTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [profile, setProfile] = useState<BusinessProfile>({
    business_name: "",
    business_description: "",
    unique_selling_points: [],
    competitive_advantages: "",
    industry: "",
    brand_voice: "",
    brand_tone: "",
    content_tone: "professional",
    content_length: "medium",
    imagery_style: "",
    brand_colors: {},
    brand_fonts: {},
  });

  const [uspInput, setUspInput] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const wsId = await getWorkspaceId();
    if (!wsId) return;
    setWorkspaceId(wsId);

    const { data, error } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("workspace_id", wsId)
      .maybeSingle();

    if (!error && data) {
      setProfile({
        ...data,
        unique_selling_points: data.unique_selling_points || [],
        brand_colors: (data.brand_colors as BrandColors) || {},
        brand_fonts: (data.brand_fonts as BrandFonts) || {},
      });
      setProfileExists(true);
    }
  };

  const saveProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !workspaceId) {
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("business_profiles")
      .upsert({
        user_id: user.id,
        workspace_id: workspaceId,
        business_name: profile.business_name,
        business_description: profile.business_description,
        unique_selling_points: profile.unique_selling_points,
        competitive_advantages: profile.competitive_advantages,
        industry: profile.industry,
        brand_voice: profile.brand_voice,
        brand_tone: profile.brand_tone,
        content_tone: profile.content_tone,
        content_length: profile.content_length,
        imagery_style: profile.imagery_style,
      }, {
        onConflict: "workspace_id",
      });

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save business profile",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Business profile saved successfully. This information will now be used in all campaign generation.",
      });
      setProfileExists(true);
      fetchProfile();
    }
  };

  const addUSP = () => {
    if (uspInput.trim()) {
      setProfile({
        ...profile,
        unique_selling_points: [...profile.unique_selling_points, uspInput.trim()],
      });
      setUspInput("");
    }
  };

  const removeUSP = (index: number) => {
    setProfile({
      ...profile,
      unique_selling_points: profile.unique_selling_points.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="text-2xl">Business Knowledge Base</CardTitle>
              <CardDescription className="text-base">
                {profileExists 
                  ? "Your business profile is saved. This information automatically enhances all AI-generated campaigns with your brand context."
                  : "Create your business profile once—AI will use this information to generate on-brand campaigns automatically."
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {profileExists && (
        <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-sm text-foreground">
            Active: All campaigns will automatically use your business profile for consistent, on-brand content
          </p>
        </div>
      )}

      {/* Business Details Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Business Details</CardTitle>
          </div>
          <CardDescription>
            Core information about your business that AI will use for context
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-name">Business Name</Label>
            <Input
              id="business-name"
              placeholder="Your Company Name"
              value={profile.business_name}
              onChange={(e) => setProfile({ ...profile, business_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              placeholder="e.g., Biotechnology, Healthcare, Technology, Finance"
              value={profile.industry}
              onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-description">Business Description</Label>
            <Textarea
              id="business-description"
              placeholder="Describe what your business does, who you serve, and what makes you unique..."
              value={profile.business_description}
              onChange={(e) => setProfile({ ...profile, business_description: e.target.value })}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="competitive-advantages">Competitive Advantages</Label>
            <Textarea
              id="competitive-advantages"
              placeholder="What sets you apart from competitors? Why should customers choose you?"
              value={profile.competitive_advantages}
              onChange={(e) => setProfile({ ...profile, competitive_advantages: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Unique Selling Points</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a unique selling point..."
                value={uspInput}
                onChange={(e) => setUspInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addUSP()}
              />
              <Button onClick={addUSP} variant="outline">Add</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {profile.unique_selling_points.map((usp, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => removeUSP(index)}
                >
                  {usp} ×
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand Voice Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Brand Voice & Tone</CardTitle>
          </div>
          <CardDescription>
            How your brand communicates with your audience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand-voice">Brand Voice</Label>
            <Input
              id="brand-voice"
              placeholder="e.g., Professional, Friendly, Energetic, Authoritative"
              value={profile.brand_voice}
              onChange={(e) => setProfile({ ...profile, brand_voice: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              The personality your brand conveys (e.g., "Professional yet approachable")
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand-tone">Brand Tone</Label>
            <Input
              id="brand-tone"
              placeholder="e.g., Warm, Confident, Inspiring, Conversational"
              value={profile.brand_tone}
              onChange={(e) => setProfile({ ...profile, brand_tone: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              The emotion behind your messaging (e.g., "Encouraging and motivating")
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Brand Colors & Fonts Section (from Brand Discovery) */}
      {(profile.brand_colors?.primary || profile.brand_fonts?.primary) && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <CardTitle>Brand Guidelines (Auto-Extracted)</CardTitle>
            </div>
            <CardDescription>
              These colors and fonts were automatically extracted via Brand Discovery
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.brand_colors?.primary && (
              <div className="space-y-2">
                <Label>Brand Colors</Label>
                <div className="flex flex-wrap gap-3">
                  {profile.brand_colors.primary && (
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded border" 
                        style={{ backgroundColor: profile.brand_colors.primary }}
                      />
                      <span className="text-sm">Primary: {profile.brand_colors.primary}</span>
                    </div>
                  )}
                  {profile.brand_colors.secondary && (
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded border" 
                        style={{ backgroundColor: profile.brand_colors.secondary }}
                      />
                      <span className="text-sm">Secondary: {profile.brand_colors.secondary}</span>
                    </div>
                  )}
                  {profile.brand_colors.accent && (
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded border" 
                        style={{ backgroundColor: profile.brand_colors.accent }}
                      />
                      <span className="text-sm">Accent: {profile.brand_colors.accent}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {profile.brand_fonts?.primary && (
              <div className="space-y-2">
                <Label>Brand Fonts</Label>
                <div className="flex flex-wrap gap-4">
                  <span className="text-sm">Primary: <strong>{profile.brand_fonts.primary}</strong></span>
                  {profile.brand_fonts.secondary && (
                    <span className="text-sm">Secondary: <strong>{profile.brand_fonts.secondary}</strong></span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Content Preferences Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Content Preferences</CardTitle>
          </div>
          <CardDescription>
            Style preferences for AI-generated content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content-tone">Content Tone</Label>
            <select
              id="content-tone"
              className="w-full p-2 border border-border rounded-md bg-background text-foreground"
              value={profile.content_tone}
              onChange={(e) => setProfile({ ...profile, content_tone: e.target.value })}
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
              <option value="enthusiastic">Enthusiastic</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content-length">Preferred Content Length</Label>
            <select
              id="content-length"
              className="w-full p-2 border border-border rounded-md bg-background text-foreground"
              value={profile.content_length}
              onChange={(e) => setProfile({ ...profile, content_length: e.target.value })}
            >
              <option value="short">Short (concise and punchy)</option>
              <option value="medium">Medium (balanced detail)</option>
              <option value="long">Long (comprehensive and detailed)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="imagery-style">Imagery Style</Label>
            <Input
              id="imagery-style"
              placeholder="e.g., Action shots, Lifestyle, Modern, Minimal"
              value={profile.imagery_style}
              onChange={(e) => setProfile({ ...profile, imagery_style: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Preferred visual style for images and videos
            </p>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={saveProfile}
        disabled={loading}
        className="w-full"
        size="lg"
      >
        {loading ? "Saving..." : profileExists ? "Update Business Profile" : "Save Business Profile"}
      </Button>
    </div>
  );
}
