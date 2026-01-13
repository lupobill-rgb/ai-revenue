import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import NavBar from "@/components/NavBar";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/edgeInvoke";
import { Loader2, Sparkles, Brain, Zap, Mail, Share2, Phone, Video, Layout, Bot } from "lucide-react";
import AIPromptCard from "@/components/AIPromptCard";
import WorkflowProgress from "@/components/WorkflowProgress";
import AICampaignPlanner from "@/components/AICampaignPlanner";
import CampaignOptimizer from "@/components/CampaignOptimizer";
import { useChannelPreferences } from "@/hooks/useChannelPreferences";
import { AutopilotCampaignWizard } from "@/components/cmo/campaigns";
import { AIBuildSectionButton } from "@/components/cmo/campaigns/AIBuildSectionButton";
import { CampaignScheduler, DEFAULT_SCHEDULE, type ScheduleConfig } from "@/components/CampaignScheduler";

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
  "Travel & Leisure"
];

const NewCampaign = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAutopilotMode = searchParams.get('type') === 'autopilot';
  const { toast } = useToast();
  const { preferences: channelPrefs, isLoading: loadingPrefs } = useChannelPreferences();
  const [creating, setCreating] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [vertical, setVertical] = useState("");
  const [goal, setGoal] = useState("");
  const [location, setLocation] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [budget, setBudget] = useState("");
  const [aiPlan, setAiPlan] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(isAutopilotMode ? "autopilot" : "create");
  const [draftedEmailSubject, setDraftedEmailSubject] = useState("");
  const [draftedEmailContent, setDraftedEmailContent] = useState("");
  const emailContentRef = useRef<HTMLTextAreaElement>(null);
  
  // Derive default channels from prefs (stable, primitive deps only)
  const defaultChannels = useMemo(() => ({
    email: !!channelPrefs.email_enabled,
    social: !!channelPrefs.social_enabled,
    voice: !!channelPrefs.voice_enabled,
    video: !!channelPrefs.video_enabled,
    landing_page: !!channelPrefs.landing_pages_enabled,
  }), [
    channelPrefs.email_enabled,
    channelPrefs.social_enabled,
    channelPrefs.voice_enabled,
    channelPrefs.video_enabled,
    channelPrefs.landing_pages_enabled
  ]);

  // Channel selection state
  const [selectedChannels, setSelectedChannels] = useState(defaultChannels);

  // Campaign schedule
  const [schedule, setSchedule] = useState<ScheduleConfig>(DEFAULT_SCHEDULE);

  // Idempotent setter - prevents accidental loops
  const setSelectedChannelsIfChanged = useCallback((next: typeof defaultChannels) => {
    setSelectedChannels((prev) => {
      // Check if anything actually changed
      if (
        prev.email === next.email &&
        prev.social === next.social &&
        prev.voice === next.voice &&
        prev.video === next.video &&
        prev.landing_page === next.landing_page
      ) {
        return prev; // No change, return same object
      }
      
      console.log('[NewCampaign] setSelectedChannels:', { prev, next });
      return next;
    });
  }, []);

  // Track initialization and user edits per workspace/draft
  const initRef = useRef<{
    key: string;
    didInit: boolean;
    userEdited: boolean;
  }>({ key: '', didInit: false, userEdited: false });

  // Create stable init key (no objects, primitives only)
  const initKey = 'new-campaign-session';

  // Initialize channel selection once per session
  useEffect(() => {
    // Reset guard if identity changed
    if (initRef.current.key !== initKey) {
      initRef.current.key = initKey;
      initRef.current.didInit = false;
      initRef.current.userEdited = false;
    }

    // Wait for prefs to load
    if (loadingPrefs) return;

    // Never overwrite after user interaction
    if (initRef.current.userEdited) return;

    // Initialize exactly once per key
    if (initRef.current.didInit) return;

    console.log('[NewCampaign] INIT_FROM_PREFS', defaultChannels);
    setSelectedChannelsIfChanged(defaultChannels);
    initRef.current.didInit = true;
  }, [initKey, loadingPrefs, setSelectedChannelsIfChanged]);

  const insertTagAtCursor = (tag: string) => {
    const textarea = emailContentRef.current;
    if (!textarea) {
      setDraftedEmailContent(prev => prev + tag);
      return;
    }
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = draftedEmailContent;
    
    const newText = text.substring(0, start) + tag + text.substring(end);
    setDraftedEmailContent(newText);
    
    // Restore cursor position after the inserted tag
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  const handlePlanGenerated = (plan: any) => {
    setAiPlan(plan);
    if (plan.campaignName) {
      setCampaignName(plan.campaignName);
    }
  };

  const handleExecutePlan = async (plan: any) => {
    if (!vertical || !goal) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide vertical and goal first.",
      });
      return;
    }

    setCreating(true);
    try {
      toast({
        title: "Executing AI Strategy",
        description: "Creating optimized campaign across all channels...",
      });

      const { data, error } = await supabase.functions.invoke("campaign-orchestrator", {
        body: {
          campaignName: plan.campaignName || campaignName,
          vertical,
          goal,
          location: location || undefined,
          businessType: businessType || undefined,
          budget: budget ? parseFloat(budget) : undefined,
          aiPlan: plan, // Pass the AI plan for optimized execution
          channels: selectedChannels,
          schedule,
        },
      });

      if (error) throw error;

      toast({
        title: "Campaign Created",
        description: `Generated ${data.assetsCreated} assets with AI-optimized strategy.`,
      });

      navigate("/approvals");
    } catch (error: any) {
      console.error("Error executing plan:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to execute campaign plan",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!campaignName || !vertical || !goal) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in campaign name, vertical, and goal.",
      });
      return;
    }

    setCreating(true);

    try {
      toast({
        title: "Generating Campaign",
        description: "Creating all content across channels...",
      });

      // Call orchestrator function
      const data: any = await invokeEdge("campaign-orchestrator", {
        campaignName,
        vertical,
        goal,
        location: location || undefined,
        businessType: businessType || undefined,
        budget: budget ? parseFloat(budget) : undefined,
        channels: selectedChannels,
        schedule,
        draftedEmail: draftedEmailContent
          ? {
              subject: draftedEmailSubject || campaignName,
              content: draftedEmailContent,
            }
          : undefined,
      });

      toast({
        title: "Campaign Created",
        description: `Generated ${data.assetsCreated} assets. Go to Approvals to review and deploy.`,
      });

      navigate("/approvals");
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create campaign",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <NavBar />
        <PageBreadcrumbs items={[{ label: "Create Campaign" }]} />
        <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <WorkflowProgress
            steps={[
              { label: "Create", status: "current" },
              { label: "Approve", status: "upcoming" },
              { label: "Track ROI", status: "upcoming" },
            ]}
            className="mb-8"
          />
          
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-primary" />
              Create Campaign
            </h1>
            <p className="mt-2 text-muted-foreground">
              Simple 3-step process: Create → Approve → Track ROI
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="autopilot" className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Autopilot
              </TabsTrigger>
              <TabsTrigger value="create" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Quick Create
              </TabsTrigger>
              <TabsTrigger value="ai-planner" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                AI Strategist
              </TabsTrigger>
              <TabsTrigger value="optimize" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Self-Optimize
              </TabsTrigger>
            </TabsList>

            {/* Autopilot Tab */}
            <TabsContent value="autopilot">
              <AutopilotCampaignWizard 
                onComplete={() => navigate('/approvals')} 
              />
            </TabsContent>

            <TabsContent value="create">
              <form onSubmit={handleCreateCampaign}>
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="text-foreground">Campaign Setup</CardTitle>
                    <CardDescription>
                      System will generate all content, you approve, then it deploys automatically
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="campaignName">Campaign Name *</Label>
                      <Input
                        id="campaignName"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        placeholder="e.g., Spring 2025 Luxury Resort Campaign"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="vertical">Client Vertical *</Label>
                      <Select value={vertical} onValueChange={setVertical} required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select industry vertical" />
                        </SelectTrigger>
                        <SelectContent>
                          {verticals.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="goal">Marketing Objective *</Label>
                      <Textarea
                        id="goal"
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        placeholder="What should this campaign achieve for your client? (e.g., Drive 100 new member sign-ups, promote luxury resort packages, increase facility bookings by 25%)"
                        rows={4}
                        required
                      />
                    </div>

                    <AIPromptCard
                      title="Need help defining the objective?"
                      description="Get AI-powered suggestions for this vertical"
                      prompts={[
                        `Create a marketing objective for ${vertical || 'a client'} to increase brand awareness and drive membership`,
                        `Generate an objective for ${vertical || 'this vertical'} focused on lead generation and conversions`,
                        `Suggest campaign objectives for ${vertical || 'a client in this vertical'} to boost customer retention and engagement`,
                      ]}
                    />

                    <div className="space-y-2">
                      <Label htmlFor="budget">Campaign Budget (Optional)</Label>
                      <Input
                        id="budget"
                        type="number"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="e.g., 5000"
                        min="0"
                        step="100"
                      />
                      <p className="text-xs text-muted-foreground">Total budget for this campaign in USD</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="location">Client Location (Optional)</Label>
                        <Input
                          id="location"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="e.g., Miami, FL or Dallas, TX"
                        />
                        <p className="text-xs text-muted-foreground">For automated lead scraping</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="businessType">Target Business Type (Optional)</Label>
                        <Input
                          id="businessType"
                          value={businessType}
                          onChange={(e) => setBusinessType(e.target.value)}
                          placeholder="e.g., luxury resorts, country clubs"
                        />
                        <p className="text-xs text-muted-foreground">For automated lead scraping</p>
                      </div>
                    </div>

                    {/* Channel Selection */}
                    <div className="space-y-4">
                      <Label className="text-base font-medium">Campaign Channels *</Label>
                      <p className="text-sm text-muted-foreground -mt-2">
                        Select which channels to include in this campaign
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {channelPrefs.email_enabled && (
                          <div className="flex items-center space-x-3 rounded-lg border border-border p-3">
                            <Checkbox
                              id="channel-email"
                              checked={selectedChannels.email}
                              onCheckedChange={(checked) => {
                                console.log('[NewCampaign] USER_TOGGLE_EMAIL', checked);
                                initRef.current.userEdited = true;
                                setSelectedChannels(prev => ({ ...prev, email: !!checked }));
                              }}
                            />
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-primary" />
                              <Label htmlFor="channel-email" className="text-sm font-normal cursor-pointer">
                                Email
                              </Label>
                            </div>
                          </div>
                        )}
                        {channelPrefs.social_enabled && (
                          <div className="flex items-center space-x-3 rounded-lg border border-border p-3">
                            <Checkbox
                              id="channel-social"
                              checked={selectedChannels.social}
                              onCheckedChange={(checked) => {
                                console.log('[NewCampaign] USER_TOGGLE_SOCIAL', checked);
                                initRef.current.userEdited = true;
                                setSelectedChannels(prev => ({ ...prev, social: !!checked }));
                              }}
                            />
                            <div className="flex items-center gap-2">
                              <Share2 className="h-4 w-4 text-primary" />
                              <Label htmlFor="channel-social" className="text-sm font-normal cursor-pointer">
                                Social Media
                              </Label>
                            </div>
                          </div>
                        )}
                        {channelPrefs.voice_enabled && (
                          <div className="flex items-center space-x-3 rounded-lg border border-border p-3">
                            <Checkbox
                              id="channel-voice"
                              checked={selectedChannels.voice}
                              onCheckedChange={(checked) => {
                                console.log('[NewCampaign] USER_TOGGLE_VOICE', checked);
                                initRef.current.userEdited = true;
                                setSelectedChannels(prev => ({ ...prev, voice: !!checked }));
                              }}
                            />
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-primary" />
                              <Label htmlFor="channel-voice" className="text-sm font-normal cursor-pointer">
                                AI Calling
                              </Label>
                            </div>
                          </div>
                        )}
                        {channelPrefs.video_enabled && (
                          <div className="flex items-center space-x-3 rounded-lg border border-border p-3">
                            <Checkbox
                              id="channel-video"
                              checked={selectedChannels.video}
                              onCheckedChange={(checked) => {
                                console.log('[NewCampaign] USER_TOGGLE_VIDEO', checked);
                                initRef.current.userEdited = true;
                                setSelectedChannels(prev => ({ ...prev, video: !!checked }));
                              }}
                            />
                            <div className="flex items-center gap-2">
                              <Video className="h-4 w-4 text-primary" />
                              <Label htmlFor="channel-video" className="text-sm font-normal cursor-pointer">
                                Video
                              </Label>
                            </div>
                          </div>
                        )}
                        {channelPrefs.landing_pages_enabled && (
                          <div className="flex items-center space-x-3 rounded-lg border border-border p-3">
                            <Checkbox
                              id="channel-landing"
                              checked={selectedChannels.landing_page}
                              onCheckedChange={(checked) => {
                                console.log('[NewCampaign] USER_TOGGLE_LANDING', checked);
                                initRef.current.userEdited = true;
                                setSelectedChannels(prev => ({ ...prev, landing_page: !!checked }));
                              }}
                            />
                            <div className="flex items-center gap-2">
                              <Layout className="h-4 w-4 text-primary" />
                              <Label htmlFor="channel-landing" className="text-sm font-normal cursor-pointer">
                                Landing Page
                              </Label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Campaign Schedule */}
                    <CampaignScheduler value={schedule} onChange={setSchedule} />

                    {/* AI Build Section */}
                    <div className="border border-primary/20 rounded-lg p-4 bg-primary/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bot className="h-5 w-5 text-primary" />
                          <div>
                            <p className="text-sm font-medium">AI Content Generation</p>
                            <p className="text-xs text-muted-foreground">Auto-generate content for selected channels</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <AIBuildSectionButton
                            sectionType="email"
                            campaignContext={{ vertical, goal }}
                            size="sm"
                          />
                          <AIBuildSectionButton
                            sectionType="social"
                            campaignContext={{ vertical, goal }}
                            size="sm"
                          />
                          <AIBuildSectionButton
                            sectionType="all"
                            campaignContext={{ vertical, goal }}
                            variant="default"
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-semibold">Your Drafted Email (Optional)</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Have your own email content? Paste it here and we'll use it instead of AI-generated content.
                      </p>
                      
                      {/* Personalization Tags */}
                      <div className="bg-background/50 rounded-md p-3 space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">Available Personalization Tags</Label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { tag: "{{first_name}}", label: "First Name" },
                            { tag: "{{last_name}}", label: "Last Name" },
                            { tag: "{{full_name}}", label: "Full Name" },
                            { tag: "{{company}}", label: "Company" },
                            { tag: "{{email}}", label: "Email" },
                            { tag: "{{location}}", label: "Location" },
                            { tag: "{{industry}}", label: "Industry" },
                            { tag: "{{title}}", label: "Job Title" },
                          ].map((item) => (
                            <button
                              key={item.tag}
                              type="button"
                              onClick={() => insertTagAtCursor(item.tag)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors border border-primary/20"
                            >
                              <code className="font-mono">{item.tag}</code>
                              <span className="text-muted-foreground">({item.label})</span>
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Click a tag to insert it at cursor position. Tags will be replaced with lead data when sending.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="draftedEmailSubject">Email Subject Line</Label>
                          <Input
                            id="draftedEmailSubject"
                            value={draftedEmailSubject}
                            onChange={(e) => setDraftedEmailSubject(e.target.value)}
                            placeholder="e.g., {{first_name}}, Exclusive Offer Just For You"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="draftedEmailContent">Email Body Content</Label>
                          <Textarea
                            ref={emailContentRef}
                            id="draftedEmailContent"
                            value={draftedEmailContent}
                            onChange={(e) => setDraftedEmailContent(e.target.value)}
                            placeholder="Hi {{first_name}},

I noticed {{company}} has been growing rapidly in the {{industry}} space...

Paste your email content here. You can include HTML formatting and personalization tags."
                            rows={8}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20 rounded-lg p-6 space-y-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <p className="text-sm font-semibold text-foreground">
                          Automated Workflow
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="bg-background/50 rounded-lg p-4 space-y-2">
                          <div className="text-primary font-medium">1. Generate</div>
                          <div className="text-muted-foreground text-xs">
                            AI creates emails, social posts, videos, and call scripts
                          </div>
                        </div>
                        <div className="bg-background/50 rounded-lg p-4 space-y-2">
                          <div className="text-primary font-medium">2. Approve</div>
                          <div className="text-muted-foreground text-xs">
                            Review and approve content in one click
                          </div>
                        </div>
                        <div className="bg-background/50 rounded-lg p-4 space-y-2">
                          <div className="text-primary font-medium">3. Deploy & Track</div>
                          <div className="text-muted-foreground text-xs">
                            Auto-deploys to all channels and tracks ROI live
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={creating}
                    >
                      {creating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating Campaign...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Create Campaign
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </form>
            </TabsContent>

            <TabsContent value="ai-planner" className="space-y-6">
              {/* Input fields for AI Planner */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    Campaign Parameters
                  </CardTitle>
                  <CardDescription>
                    Provide your campaign details and let AI create the optimal strategy
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ai-vertical">Client Vertical *</Label>
                      <Select value={vertical} onValueChange={setVertical}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select industry vertical" />
                        </SelectTrigger>
                        <SelectContent>
                          {verticals.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ai-budget">Campaign Budget</Label>
                      <Input
                        id="ai-budget"
                        type="number"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="e.g., 5000"
                        min="0"
                        step="100"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ai-goal">Marketing Objective *</Label>
                    <Textarea
                      id="ai-goal"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      placeholder="Describe your campaign goal in detail..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* AI Campaign Planner */}
              <AICampaignPlanner
                goal={goal}
                vertical={vertical}
                budget={budget ? parseFloat(budget) : undefined}
                onPlanGenerated={handlePlanGenerated}
                onExecutePlan={handleExecutePlan}
              />
            </TabsContent>

            <TabsContent value="optimize">
              <CampaignOptimizer />
            </TabsContent>
          </Tabs>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default NewCampaign;
