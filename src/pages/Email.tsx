import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, Send, Eye, MousePointer, TrendingUp, Database, Users } from "lucide-react";
import AIAssistant from "@/components/AIAssistant";
import AIPromptCard from "@/components/AIPromptCard";

const SAMPLE_EMAILS = [
  {
    id: "email-1",
    name: "Summer Welcome Series - Part 1",
    subject: "Welcome to Paradise! Your Journey Begins",
    status: "live",
    sent: 12500,
    opened: 4875,
    clicked: 1125,
    openRate: 39,
    clickRate: 9,
    created_at: "2024-11-20",
  },
  {
    id: "email-2",
    name: "Black Friday Promo Blast",
    subject: "🔥 48 Hours Only: Exclusive Savings Inside",
    status: "live",
    sent: 45000,
    opened: 18900,
    clicked: 5670,
    openRate: 42,
    clickRate: 12.6,
    created_at: "2024-11-22",
  },
  {
    id: "email-3",
    name: "Monthly Newsletter - December",
    subject: "Your December Digest: News, Tips & Exclusive Offers",
    status: "approved",
    sent: 0,
    opened: 0,
    clicked: 0,
    openRate: 0,
    clickRate: 0,
    created_at: "2024-11-25",
  },
  {
    id: "email-4",
    name: "Re-engagement Campaign",
    subject: "We Miss You! Here's 20% Off to Come Back",
    status: "review",
    sent: 0,
    opened: 0,
    clicked: 0,
    openRate: 0,
    clickRate: 0,
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

const Email = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [vertical, setVertical] = useState("");
  const [goal, setGoal] = useState("");
  const [recipients, setRecipients] = useState("");
  const [showSampleData, setShowSampleData] = useState(true);

  const handleCreateEmail = async () => {
    if (!vertical) {
      toast({
        title: "Vertical Required",
        description: "Please select a vertical to create your email.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data: contentData, error: contentError } = await supabase.functions.invoke("content-generate", {
        body: { vertical, contentType: "email", assetGoal: goal || undefined },
      });

      if (contentError) throw contentError;

      const { data: imageData, error: imageError } = await supabase.functions.invoke("generate-hero-image", {
        body: { vertical, assetGoal: goal || contentData.title },
      });

      if (imageError) console.error("Image generation error:", imageError);

      const assetName = contentData.title || `${vertical} Email - ${new Date().toLocaleDateString()}`;
      const emailSubject = contentData.subject || assetName;
      const recipientList = recipients.split(',').map(email => email.trim()).filter(email => email.length > 0);
      
      const { data: assetData, error: assetError } = await supabase
        .from("assets")
        .insert({
          name: assetName,
          description: contentData.content,
          type: "email",
          channel: vertical,
          goal: goal || contentData.title,
          status: "review",
          created_by: userData.user?.id,
          preview_url: imageData?.imageUrl || null,
          content: {
            subject: emailSubject,
            body: contentData.content,
            html: contentData.content,
            recipients: recipientList,
            hero_image_url: imageData?.imageUrl || null,
          },
        })
        .select()
        .single();

      if (assetError) throw assetError;

      toast({ title: "Email Created", description: "Your email campaign is ready for approval." });
      navigate(`/assets/${assetData.id}`);
    } catch (error: any) {
      console.error("Error creating email:", error);
      toast({ title: "Creation Failed", description: error.message || "Failed to create email.", variant: "destructive" });
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

  const totalSent = SAMPLE_EMAILS.reduce((acc, e) => acc + e.sent, 0);
  const avgOpenRate = (SAMPLE_EMAILS.filter(e => e.openRate > 0).reduce((acc, e) => acc + e.openRate, 0) / SAMPLE_EMAILS.filter(e => e.openRate > 0).length).toFixed(1);
  const avgClickRate = (SAMPLE_EMAILS.filter(e => e.clickRate > 0).reduce((acc, e) => acc + e.clickRate, 0) / SAMPLE_EMAILS.filter(e => e.clickRate > 0).length).toFixed(1);

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-background">
        <NavBar />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
                  <Mail className="h-8 w-8" />
                  Email Studio
                </h1>
                <p className="text-muted-foreground">
                  AI-powered email campaigns for your marketing efforts
                </p>
              </div>
              <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-lg border border-border">
                <Database className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="sample-data-email" className="text-sm font-medium cursor-pointer">
                  Demo Data
                </Label>
                <Switch
                  id="sample-data-email"
                  checked={showSampleData}
                  onCheckedChange={setShowSampleData}
                />
              </div>
            </div>

            {showSampleData && (
              <div className="mb-6 p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary flex items-center gap-2">
                <Database className="h-4 w-4" />
                Showing sample demo data. Toggle off to view real emails only.
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Mail className="h-4 w-4" />
                    <span className="text-sm">Total Campaigns</span>
                  </div>
                  <div className="text-2xl font-bold">{SAMPLE_EMAILS.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Send className="h-4 w-4" />
                    <span className="text-sm">Emails Sent</span>
                  </div>
                  <div className="text-2xl font-bold">{totalSent.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Eye className="h-4 w-4" />
                    <span className="text-sm">Avg. Open Rate</span>
                  </div>
                  <div className="text-2xl font-bold text-green-500">{avgOpenRate}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MousePointer className="h-4 w-4" />
                    <span className="text-sm">Avg. Click Rate</span>
                  </div>
                  <div className="text-2xl font-bold text-primary">{avgClickRate}%</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              {/* Create New Email */}
              <div className="lg:col-span-1 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Email Creation</CardTitle>
                    <CardDescription>
                      Select your industry and AI will generate everything
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
                      <Label>Campaign Goal (Optional)</Label>
                      <Input
                        placeholder="e.g., Newsletter, Promotional"
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Recipients</Label>
                      <Textarea
                        placeholder="Enter emails, separated by commas"
                        value={recipients}
                        onChange={(e) => setRecipients(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <Button
                      onClick={handleCreateEmail}
                      disabled={creating || !vertical || !recipients}
                      className="w-full"
                    >
                      {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {creating ? "Creating..." : "Generate & Create Email"}
                    </Button>
                  </CardContent>
                </Card>

                <AIPromptCard
                  title="Email Campaign Help"
                  description="Get AI assistance with email strategy"
                  prompts={[
                    "What's the best email structure for higher open rates?",
                    "Give me 5 subject line ideas that drive clicks",
                    "How can I personalize emails for better engagement?",
                  ]}
                />
              </div>

              {/* Recent Emails */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Recent Campaigns</h2>
                  <Button variant="outline" size="sm" onClick={() => navigate("/assets")}>
                    View All
                  </Button>
                </div>
                <div className="space-y-3">
                  {SAMPLE_EMAILS.map((email) => (
                    <Card 
                      key={email.id} 
                      className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/30"
                      onClick={() => navigate("/assets")}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold truncate">{email.name}</h3>
                              <Badge className={getStatusBadge(email.status)}>{email.status}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate mb-3">
                              {email.subject}
                            </p>
                            <div className="flex items-center gap-6 text-sm">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Users className="h-3 w-3" />
                                {email.sent.toLocaleString()} sent
                              </span>
                              {email.openRate > 0 && (
                                <span className="flex items-center gap-1 text-green-500">
                                  <Eye className="h-3 w-3" />
                                  {email.openRate}% open
                                </span>
                              )}
                              {email.clickRate > 0 && (
                                <span className="flex items-center gap-1 text-primary">
                                  <MousePointer className="h-3 w-3" />
                                  {email.clickRate}% CTR
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {email.created_at}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default Email;
