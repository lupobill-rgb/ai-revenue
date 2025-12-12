import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCampaign, useToggleCampaignAutopilot, useUpdateCampaignGoal, cmoKeys } from "@/hooks/useCMO";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Bot,
  Target,
  BarChart3,
  Users,
  FileText,
  Layers,
  Lightbulb,
  Calendar,
  TrendingUp,
  Mail,
  MessageSquare,
  Phone,
  Globe,
} from "lucide-react";
import CampaignOverviewTab from "@/components/cmo/campaigns/CampaignOverviewTab";
import CampaignLeadsTab from "@/components/cmo/campaigns/CampaignLeadsTab";
import CampaignLandingPagesTab from "@/components/cmo/campaigns/CampaignLandingPagesTab";
import CampaignSequencesTab from "@/components/cmo/campaigns/CampaignSequencesTab";
import CampaignAIInsightsTab from "@/components/cmo/campaigns/CampaignAIInsightsTab";
import type { CampaignGoal } from "@/lib/cmo/types";

const GOAL_OPTIONS: { value: CampaignGoal; label: string }[] = [
  { value: "leads", label: "Generate Leads" },
  { value: "meetings", label: "Book Meetings" },
  { value: "revenue", label: "Drive Revenue" },
  { value: "engagement", label: "Increase Engagement" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-primary/10 text-primary",
  paused: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
};

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const { data: campaign, isLoading, error } = useCampaign(id || "");
  const toggleAutopilot = useToggleCampaignAutopilot();
  const updateGoal = useUpdateCampaignGoal();
  
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch campaign metrics
  const [metrics, setMetrics] = useState<{
    sends: number;
    opens: number;
    clicks: number;
    replies: number;
    meetings: number;
  } | null>(null);

  useEffect(() => {
    if (!campaign?.id || !campaign?.tenant_id) return;
    
    const fetchMetrics = async () => {
      const { data } = await supabase
        .from("campaign_channel_stats_daily")
        .select("sends, opens, clicks, replies, meetings_booked")
        .eq("campaign_id", campaign.id)
        .eq("tenant_id", campaign.tenant_id);
      
      if (data && data.length > 0) {
        const agg = data.reduce(
          (acc, row) => ({
            sends: acc.sends + (row.sends || 0),
            opens: acc.opens + (row.opens || 0),
            clicks: acc.clicks + (row.clicks || 0),
            replies: acc.replies + (row.replies || 0),
            meetings: acc.meetings + (row.meetings_booked || 0),
          }),
          { sends: 0, opens: 0, clicks: 0, replies: 0, meetings: 0 }
        );
        setMetrics(agg);
      }
    };
    
    fetchMetrics();
  }, [campaign?.id, campaign?.tenant_id]);

  const handleToggleAutopilot = async () => {
    if (!campaign) return;
    
    try {
      await toggleAutopilot.mutateAsync({
        campaignId: campaign.id,
        enabled: !campaign.autopilot_enabled,
      });
      toast.success(
        campaign.autopilot_enabled
          ? "Autopilot disabled – AI will only suggest, not apply changes"
          : "Autopilot enabled – AI will automatically optimize this campaign"
      );
    } catch (err) {
      toast.error("Failed to toggle autopilot");
    }
  };

  const handleGoalChange = async (goal: string) => {
    if (!campaign) return;
    
    try {
      await updateGoal.mutateAsync({
        campaignId: campaign.id,
        goal: goal as CampaignGoal,
      });
      toast.success(`Campaign goal updated to "${goal}"`);
    } catch (err) {
      toast.error("Failed to update goal");
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background">
          <NavBar />
          <main className="container mx-auto px-4 py-8">
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-64 w-full" />
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !campaign) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background">
          <NavBar />
          <main className="container mx-auto px-4 py-8">
            <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Campaign not found</p>
              </CardContent>
            </Card>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  const openRate = metrics?.sends ? ((metrics.opens / metrics.sends) * 100).toFixed(1) : "0.0";
  const replyRate = metrics?.sends ? ((metrics.replies / metrics.sends) * 100).toFixed(1) : "0.0";
  const channels = campaign.channels || [];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <NavBar />
        <main className="container mx-auto px-4 py-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-2xl font-bold">{campaign.campaign_name}</h1>
                <Badge className={STATUS_COLORS[campaign.status || "draft"]}>
                  {campaign.status || "Draft"}
                </Badge>
              </div>
              {campaign.description && (
                <p className="text-muted-foreground ml-12">{campaign.description}</p>
              )}
            </div>
            
            {/* Autopilot Toggle */}
            <Card className="w-80">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <CardTitle className="text-sm font-medium">Autopilot</CardTitle>
                  </div>
                  <Switch
                    checked={campaign.autopilot_enabled || false}
                    onCheckedChange={handleToggleAutopilot}
                    disabled={toggleAutopilot.isPending}
                  />
                </div>
                <CardDescription className="text-xs">
                  {campaign.autopilot_enabled
                    ? "AI will automatically apply optimizations"
                    : "AI will suggest changes for your review"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Campaign Goal</Label>
                  <Select
                    value={campaign.goal || ""}
                    onValueChange={handleGoalChange}
                    disabled={updateGoal.isPending}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select goal" />
                    </SelectTrigger>
                    <SelectContent>
                      {GOAL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {campaign.last_optimization_at && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Last optimized: {new Date(campaign.last_optimization_at).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* KPI Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-muted/30">
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">{metrics?.sends || 0}</p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">{openRate}%</p>
                <p className="text-xs text-muted-foreground">Open Rate</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">{metrics?.clicks || 0}</p>
                <p className="text-xs text-muted-foreground">Clicks</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-primary">{replyRate}%</p>
                <p className="text-xs text-muted-foreground">Reply Rate</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-primary">{metrics?.meetings || 0}</p>
                <p className="text-xs text-muted-foreground">Meetings</p>
              </CardContent>
            </Card>
          </div>

          {/* Channels */}
          {channels.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {channels.map((ch) => (
                <Badge key={ch.id} variant="outline" className="text-xs">
                  {ch.channel_name === "email" && <Mail className="h-3 w-3 mr-1" />}
                  {ch.channel_name === "sms" && <MessageSquare className="h-3 w-3 mr-1" />}
                  {ch.channel_name === "voice" && <Phone className="h-3 w-3 mr-1" />}
                  {ch.channel_name === "landing_page" && <Globe className="h-3 w-3 mr-1" />}
                  {ch.channel_name}
                </Badge>
              ))}
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="overview" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="leads" className="gap-2">
                <Users className="h-4 w-4" />
                Leads
              </TabsTrigger>
              <TabsTrigger value="landing-pages" className="gap-2">
                <FileText className="h-4 w-4" />
                Landing Pages
              </TabsTrigger>
              <TabsTrigger value="sequences" className="gap-2">
                <Layers className="h-4 w-4" />
                Sequences
              </TabsTrigger>
              <TabsTrigger value="ai-insights" className="gap-2">
                <Lightbulb className="h-4 w-4" />
                AI Insights
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <CampaignOverviewTab campaign={campaign} metrics={metrics} />
            </TabsContent>

            <TabsContent value="leads">
              <CampaignLeadsTab campaignId={campaign.id} tenantId={campaign.tenant_id} />
            </TabsContent>

            <TabsContent value="landing-pages">
              <CampaignLandingPagesTab campaignId={campaign.id} tenantId={campaign.tenant_id} />
            </TabsContent>

            <TabsContent value="sequences">
              <CampaignSequencesTab campaignId={campaign.id} workspaceId={campaign.workspace_id} />
            </TabsContent>

            <TabsContent value="ai-insights">
              <CampaignAIInsightsTab 
                campaignId={campaign.id} 
                tenantId={campaign.tenant_id}
                autopilotEnabled={campaign.autopilot_enabled || false}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </ProtectedRoute>
  );
}
