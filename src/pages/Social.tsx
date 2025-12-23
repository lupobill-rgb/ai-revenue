import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDemoMode } from "@/hooks/useDemoMode";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Share2, Heart, MessageCircle, Repeat2, Eye, TrendingUp, Database, Instagram, Linkedin, Facebook, Construction } from "lucide-react";
import AIAssistant from "@/components/AIAssistant";
import AIPromptCard from "@/components/AIPromptCard";

// Social channel is blocked as "Coming Soon" until full E2E provider integration is complete
const SOCIAL_COMING_SOON = true;

const SAMPLE_POSTS = [
  {
    id: "social-1",
    name: "Team Highlights Reel",
    platform: "Instagram",
    content: "🏆 What an incredible quarter! Swipe to see our team's best moments and achievements →",
    status: "live",
    likes: 2450,
    comments: 187,
    shares: 89,
    impressions: 45200,
    engagement: 6.1,
    thumbnail: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=450&fit=crop",
    created_at: "2024-11-22",
  },
  {
    id: "social-2",
    name: "Industry Thought Leadership",
    platform: "LinkedIn",
    content: "Our industry is evolving rapidly. Here are 5 trends that will shape 2025 and how we're adapting...",
    status: "live",
    likes: 892,
    comments: 67,
    shares: 234,
    impressions: 18900,
    engagement: 6.3,
    thumbnail: "https://images.unsplash.com/photo-1553028826-f4804a6dba3b?w=800&h=450&fit=crop",
    created_at: "2024-11-20",
  },
  {
    id: "social-3",
    name: "New Year Promo Announcement",
    platform: "Facebook",
    content: "🎉 Our biggest promotion of the year is HERE! Limited availability for early 2025...",
    status: "approved",
    likes: 0,
    comments: 0,
    shares: 0,
    impressions: 0,
    engagement: 0,
    thumbnail: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=450&fit=crop",
    created_at: "2024-11-25",
  },
  {
    id: "social-4",
    name: "Behind the Scenes",
    platform: "Instagram",
    content: "Take a peek behind the curtain! Here's how our team prepares for each project 🎬",
    status: "review",
    likes: 0,
    comments: 0,
    shares: 0,
    impressions: 0,
    engagement: 0,
    thumbnail: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&h=450&fit=crop",
    created_at: "2024-11-26",
  },
];

const verticals = [
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
];

const platforms = ["Instagram", "LinkedIn", "Facebook", "TikTok"];

const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case "Instagram": return <Instagram className="h-4 w-4" />;
    case "LinkedIn": return <Linkedin className="h-4 w-4" />;
    case "Facebook": return <Facebook className="h-4 w-4" />;
    default: return <Share2 className="h-4 w-4" />;
  }
};

const Social = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  // DEMO MODE: Use centralized workspace demo_mode instead of local toggle
  const { demoMode: showSampleData } = useDemoMode();
  const [creating, setCreating] = useState(false);
  const [vertical, setVertical] = useState("");
  const [platform, setPlatform] = useState("");
  const [goal, setGoal] = useState("");

  const handleCreateSocial = async () => {
    if (!vertical || !platform) {
      toast({
        title: "Missing Information",
        description: "Please select a vertical and platform.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data: contentData, error: contentError } = await supabase.functions.invoke("content-generate", {
        body: { vertical, contentType: "social", assetGoal: goal ? `${platform} - ${goal}` : platform },
      });

      if (contentError) throw contentError;

      const { data: imageData, error: imageError } = await supabase.functions.invoke("generate-hero-image", {
        body: { vertical, assetGoal: goal || `${platform} post` },
      });

      if (imageError) console.error("Image generation error:", imageError);

      const assetName = contentData.title || `${platform} Post - ${vertical} - ${new Date().toLocaleDateString()}`;
      
      const { data: assetData, error: assetError } = await supabase
        .from("assets")
        .insert({
          name: assetName,
          description: contentData.content,
          type: "landing_page",
          channel: `${vertical} - ${platform}`,
          goal: goal || contentData.title,
          status: "review",
          created_by: userData.user?.id,
          preview_url: imageData?.imageUrl || null,
          content: {
            platform,
            text: contentData.content,
            hero_image_url: imageData?.imageUrl || null,
          },
        })
        .select()
        .single();

      if (assetError) throw assetError;

      toast({ title: "Social Post Created", description: "Your post is ready for approval." });
      navigate(`/assets/${assetData.id}`);
    } catch (error: any) {
      console.error("Error creating social post:", error);
      toast({ title: "Creation Failed", description: error.message || "Failed to create post.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      live: "bg-green-500/10 text-green-500 border-green-500/20",
      approved: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      review: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      draft: "bg-muted text-muted-foreground",
    };
    return colors[status] || colors.draft;
  };

  // GATING: Only show sample KPIs when in demo mode (showSampleData from line 131)
  const totalImpressions = showSampleData ? SAMPLE_POSTS.reduce((acc, p) => acc + p.impressions, 0) : 0;
  const totalEngagement = showSampleData ? SAMPLE_POSTS.reduce((acc, p) => acc + p.likes + p.comments + p.shares, 0) : 0;
  const avgEngagement = showSampleData 
    ? (SAMPLE_POSTS.filter(p => p.engagement > 0).reduce((acc, p) => acc + p.engagement, 0) / SAMPLE_POSTS.filter(p => p.engagement > 0).length).toFixed(1)
    : "0";

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-background">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
                  <Share2 className="h-8 w-8" />
                  Social Media Studio
                  {SOCIAL_COMING_SOON && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      <Construction className="h-3 w-3 mr-1" />
                      Coming Soon
                    </Badge>
                  )}
                </h1>
                <p className="text-muted-foreground">
                  AI-powered social media content for multiple platforms
                </p>
              </div>
              {/* Demo mode badge - controlled from Settings */}
              {!SOCIAL_COMING_SOON && showSampleData && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  <Database className="h-3 w-3 mr-1" />
                  SAMPLE DATA
                </Badge>
              )}
            </div>

            {/* Coming Soon Banner */}
            {SOCIAL_COMING_SOON && (
              <Card className="mb-8 border-2 border-dashed border-primary/30 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center py-8">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <Construction className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Social Media Deployment Coming Soon</h2>
                    <p className="text-muted-foreground max-w-md mb-4">
                      We're building full end-to-end social media integration with provider tracking, 
                      idempotency, and analytics—just like our Email and Voice channels.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Instagram className="h-3 w-3" /> Instagram
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Linkedin className="h-3 w-3" /> LinkedIn
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Facebook className="h-3 w-3" /> Facebook
                      </Badge>
                      <Badge variant="outline">TikTok</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                      Email and Voice channels are fully operational with E2E provider verification.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!SOCIAL_COMING_SOON && showSampleData && (
              <div className="mb-6 p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary flex items-center gap-2">
                <Database className="h-4 w-4" />
                Showing sample demo data. Disable Sample Data Mode in Settings to view real data only.
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Share2 className="h-4 w-4" />
                    <span className="text-sm">Total Posts</span>
                  </div>
                  <div className="text-2xl font-bold">{SAMPLE_POSTS.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Eye className="h-4 w-4" />
                    <span className="text-sm">Total Reach</span>
                  </div>
                  <div className="text-2xl font-bold">{totalImpressions.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Heart className="h-4 w-4" />
                    <span className="text-sm">Total Engagement</span>
                  </div>
                  <div className="text-2xl font-bold text-pink-500">{totalEngagement.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">Avg. Engagement</span>
                  </div>
                  <div className="text-2xl font-bold text-green-500">{avgEngagement}%</div>
                </CardContent>
              </Card>
            </div>

            {!SOCIAL_COMING_SOON && (
            <div className="grid gap-8 lg:grid-cols-3">
              {/* Create New Post */}
              <div className="lg:col-span-1 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Post Creation</CardTitle>
                    <CardDescription>
                      Select your industry and platform, AI does the rest
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Industry Vertical</Label>
                      <Select value={vertical} onValueChange={setVertical}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vertical" />
                        </SelectTrigger>
                        <SelectContent>
                          {verticals.map((v) => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Platform</Label>
                      <Select value={platform} onValueChange={setPlatform}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                        <SelectContent>
                          {platforms.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Campaign Goal (Optional)</Label>
                      <Input
                        placeholder="e.g., Engagement, Brand awareness"
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleCreateSocial}
                      disabled={creating || !vertical || !platform}
                      className="w-full"
                    >
                      {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {creating ? "Creating..." : "Generate & Create Post"}
                    </Button>
                  </CardContent>
                </Card>

                <AIPromptCard
                  title="Social Media Strategy"
                  description="Get AI help with platform-specific content"
                  prompts={[
                    "What content works best on Instagram vs LinkedIn?",
                    "Give me 5 engaging post ideas for my industry",
                    "How can I increase engagement on social posts?",
                  ]}
                />
              </div>

              {/* Recent Posts */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Recent Posts</h2>
                  <Button variant="outline" size="sm" onClick={() => navigate("/assets")}>
                    View All
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {SAMPLE_POSTS.map((post) => (
                    <Card 
                      key={post.id} 
                      className="overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
                      onClick={() => navigate("/assets")}
                    >
                      <div className="relative aspect-video bg-muted">
                        <img 
                          src={post.thumbnail} 
                          alt={post.name}
                          className="w-full h-full object-cover"
                        />
                        <Badge className={`absolute top-2 right-2 ${getStatusBadge(post.status)}`}>
                          {post.status}
                        </Badge>
                        <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                          {getPlatformIcon(post.platform)}
                          {post.platform}
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold line-clamp-1 mb-1">{post.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {post.content}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              {post.likes.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {post.comments}
                            </span>
                            <span className="flex items-center gap-1">
                              <Repeat2 className="h-3 w-3" />
                              {post.shares}
                            </span>
                          </div>
                          <span>{post.created_at}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
          </div>
            )}
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default Social;
