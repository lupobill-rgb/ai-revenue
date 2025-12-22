import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useDataIntegrity, validateDataIntegrity } from "@/hooks/useDataIntegrity";
import { TrendingUp, CheckCircle, Clock, Eye, PlayCircle, Mail, Phone, Layout, DollarSign, Target, AlertCircle, Settings, Plus, BarChart3, LineChart, HelpCircle, Activity, ShieldAlert } from "lucide-react";
import { CampaignRunDetailsDrawer } from "@/components/campaigns/CampaignRunDetailsDrawer";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import AIQuickActions from "@/components/AIQuickActions";
import WorkflowProgress from "@/components/WorkflowProgress";
import AIWalkthrough from "@/components/AIWalkthrough";
import { LineChart as RechartsLineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface CampaignMetrics {
  totalRevenue: number;
  totalCost: number;
  totalROI: number;
  totalImpressions: number;
  totalClicks: number;
  activeCampaigns: number;
}

interface QueueMetrics {
  queuedJobs: number;
  lockedJobs: number;
  oldestQueuedAgeSeconds: number;
}

interface CampaignPerformance {
  id: string;
  name: string;
  type: string;
  channel: string;
  views: number;
  clicks: number;
  revenue: number;
  cost: number;
  roi: number;
  status: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // DATA INTEGRITY: Use centralized hook for strict enforcement
  const dataIntegrity = useDataIntegrity();
  
  const [metrics, setMetrics] = useState<CampaignMetrics>({
    totalRevenue: 0,
    totalCost: 0,
    totalROI: 0,
    totalImpressions: 0,
    totalClicks: 0,
    activeCampaigns: 0,
  });
  const [campaigns, setCampaigns] = useState<CampaignPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);
  const [showDemoData, setShowDemoData] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedCampaignForRun, setSelectedCampaignForRun] = useState<{ id: string; name: string } | null>(null);
  const [queueMetrics, setQueueMetrics] = useState<QueueMetrics>({ queuedJobs: 0, lockedJobs: 0, oldestQueuedAgeSeconds: 0 });

  // Demo data for demonstration
  const sampleRevenueData = [
    { month: "Jan", revenue: 12500, cost: 4200 },
    { month: "Feb", revenue: 18900, cost: 5100 },
    { month: "Mar", revenue: 24300, cost: 6800 },
    { month: "Apr", revenue: 31200, cost: 8500 },
    { month: "May", revenue: 39700, cost: 10200 },
    { month: "Jun", revenue: 48500, cost: 12100 },
  ];

  const sampleEngagementData = [
    { week: "Week 1", clicks: 1240, impressions: 18500 },
    { week: "Week 2", clicks: 1580, impressions: 22300 },
    { week: "Week 3", clicks: 1920, impressions: 27800 },
    { week: "Week 4", clicks: 2340, impressions: 34200 },
  ];

  const handleAIAction = (prompt: string) => {
    // Open the AI chat widget
    const event = new CustomEvent('open-ai-chat', { detail: { prompt } });
    window.dispatchEvent(event);
  };

  useEffect(() => {
    fetchDashboardMetrics();
    fetchQueueMetrics();

    // Auto-refresh metrics every 30 seconds for real-time tracking
    const interval = setInterval(() => {
      console.log('Auto-refreshing dashboard metrics...');
      fetchDashboardMetrics();
      fetchQueueMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchQueueMetrics = async () => {
    try {
      const { data: queueStats } = await supabase
        .from("job_queue")
        .select("status, created_at")
        .in("status", ["queued", "locked"]);

      let queuedJobs = 0;
      let lockedJobs = 0;
      let oldestQueuedTime: Date | null = null;

      for (const job of queueStats || []) {
        if (job.status === "queued") {
          queuedJobs++;
          const jobTime = new Date(job.created_at);
          if (!oldestQueuedTime || jobTime < oldestQueuedTime) {
            oldestQueuedTime = jobTime;
          }
        } else if (job.status === "locked") {
          lockedJobs++;
        }
      }

      const oldestQueuedAgeSeconds = oldestQueuedTime 
        ? Math.floor((Date.now() - oldestQueuedTime.getTime()) / 1000)
        : 0;

      setQueueMetrics({ queuedJobs, lockedJobs, oldestQueuedAgeSeconds });
    } catch (error) {
      console.error("Error fetching queue metrics:", error);
    }
  };

  const fetchDashboardMetrics = async () => {
    try {
      // Only sync metrics if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          await supabase.functions.invoke("sync-campaign-metrics");
        } catch (syncError) {
          console.log("Metrics sync skipped:", syncError);
        }
      }

      // Fetch campaigns with metrics - include deployed and running statuses
      const { data: campaignsData, error: campaignsError } = await supabase
        .from("campaigns")
        .select(`
          *,
          assets!inner(*),
          campaign_metrics(*)
        `)
        .in("status", ["deployed", "running", "active"])
        .order("deployed_at", { ascending: false });

      if (campaignsError) throw campaignsError;

      // Check if user has real data (campaigns or leads)
      const { count: leadCount } = await supabase
        .from("crm_leads")
        .select("*", { count: "exact", head: true });

      const hasData = (campaignsData?.length || 0) > 0 || (leadCount || 0) > 0;
      setHasRealData(hasData);
      
      // Only show demo mode toggle if NO real data exists
      if (!hasData && !showDemoData) {
        setShowDemoData(false);
      }
      
      setLastRefresh(new Date());

      // Calculate rollup metrics
      let totalRevenue = 0;
      let totalCost = 0;
      let totalClicks = 0;
      let totalImpressions = 0;

      campaignsData?.forEach((campaign: any) => {
        const metrics = campaign.campaign_metrics?.[0];
        if (metrics) {
          totalRevenue += parseFloat(metrics.revenue || 0);
          totalCost += parseFloat(metrics.cost || 0);
          totalClicks += metrics.clicks || 0;
          totalImpressions += metrics.impressions || 0;
        }
      });

      const totalROI = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;

      setMetrics({
        totalRevenue,
        totalCost,
        totalROI,
        totalImpressions,
        totalClicks,
        activeCampaigns: campaignsData?.length || 0,
      });

      // Map campaigns with individual metrics
      const mappedCampaigns = (campaignsData || []).map((c: any) => {
        const metrics = c.campaign_metrics?.[0];
        const asset = c.assets;
        const revenue = parseFloat(metrics?.revenue || 0);
        const cost = parseFloat(metrics?.cost || 0);
        const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;

        return {
          id: asset.id,
          name: asset.name,
          type: asset.type,
          channel: c.channel,
          views: metrics?.impressions || 0,
          clicks: metrics?.clicks || 0,
          revenue,
          cost,
          roi,
          status: c.status,
        };
      });

      setCampaigns(mappedCampaigns);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "video":
        return PlayCircle;
      case "email":
        return Mail;
      case "voice":
        return Phone;
      case "landing_page":
        return Layout;
      default:
        return PlayCircle;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "approved":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <WorkflowProgress
            steps={[
              { label: "Create", status: "completed" },
              { label: "Approve", status: "completed" },
              { label: "Track ROI", status: "current" },
            ]}
            className="mb-8"
          />
          
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground">Campaign Dashboard</h1>
              <p className="mt-2 text-muted-foreground flex items-center gap-2">
                <span>Real-time performance tracking • Auto-updates every 30s</span>
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              </p>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  localStorage.removeItem("ubigrowth-ai-walkthrough-seen");
                  setShowTour(true);
                }}
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                AI Guide
              </Button>
              <Button onClick={() => navigate("/new-campaign")} size="lg">
                <Plus className="mr-2 h-4 w-4" />
                New Campaign
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : (
            <>
              {/* DEMO MODE - Show warning when in demo mode */}
              {dataIntegrity.isDemoMode && campaigns.length > 0 && (
                <Card className="mb-8 border-amber-500/50 bg-amber-500/10">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <CardTitle className="text-foreground text-xl mb-2 flex items-center gap-2">
                          <Badge variant="outline" className="border-amber-500 text-amber-500 bg-amber-500/10">
                            DEMO DATA
                          </Badge>
                          Simulated Metrics
                        </CardTitle>
                        <CardDescription className="text-foreground/80 mb-4">
                          Demo mode is enabled. These metrics are <strong>simulated for demonstration</strong>. 
                          Switch to real mode in Settings to use actual analytics data.
                        </CardDescription>
                        <Button
                          variant="outline"
                          onClick={() => navigate("/settings/integrations")}
                          className="border-amber-500 text-amber-600 hover:bg-amber-500/10"
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Configure Settings
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              )}

              {/* DATA INTEGRITY: Live mode with missing integrations - show enforcement notice */}
              {dataIntegrity.isLiveMode && campaigns.length > 0 && !dataIntegrity.shouldShowImpressions && (
                <Card className="mb-8 border-blue-500/50 bg-blue-500/10">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <BarChart3 className="h-6 w-6 text-blue-500 flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <CardTitle className="text-foreground text-xl mb-2">
                          Connect Analytics Providers
                        </CardTitle>
                        <CardDescription className="text-foreground/80 mb-4">
                          Real mode is active. To see actual campaign performance data, connect your analytics providers 
                          (Google Analytics, Meta Ads, LinkedIn Ads, etc.) in Settings.
                        </CardDescription>
                        <Button
                          onClick={() => navigate("/settings/integrations")}
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Connect Integrations
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              )}

              {/* AI Quick Actions */}
              <div className="mb-8">
                <AIQuickActions onActionClick={handleAIAction} />
              </div>

              {/* Demo Data Toggle - only show if no real data */}
              {!hasRealData && (
                <Card className="mb-8 border-border bg-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-foreground text-xl">Platform Preview Mode</CardTitle>
                        <CardDescription>
                          No campaigns deployed yet. Toggle demo data to explore analytics features.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-3">
                        <Label htmlFor="demo-data-toggle" className="text-sm font-medium cursor-pointer">
                          {showDemoData ? "Hide Demo Data" : "Show Demo Data"}
                        </Label>
                        <Switch
                          id="demo-data-toggle"
                          checked={showDemoData}
                          onCheckedChange={setShowDemoData}
                        />
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              )}

              {/* Demo Metrics Graphs - only show if demo mode enabled and no real data */}
              {showDemoData && !hasRealData && (
                <div className="mb-8 grid gap-6 lg:grid-cols-2">
                  {/* Revenue vs Cost Chart */}
                  <Card className="border-border bg-card">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <LineChart className="h-5 w-5 text-primary" />
                        Revenue vs Cost Trend
                      </CardTitle>
                      <CardDescription>Monthly performance over 6 months (Demo Data)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <RechartsLineChart data={sampleRevenueData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                          <YAxis stroke="hsl(var(--muted-foreground))" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))", 
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px"
                            }} 
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="revenue" 
                            stroke="hsl(142, 76%, 36%)" 
                            strokeWidth={2}
                            name="Revenue ($)"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="cost" 
                            stroke="hsl(24, 95%, 53%)" 
                            strokeWidth={2}
                            name="Cost ($)"
                          />
                        </RechartsLineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Engagement Chart */}
                  <Card className="border-border bg-card">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" />
                        Engagement Metrics
                      </CardTitle>
                      <CardDescription>Clicks vs Impressions by week (Demo Data)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={sampleEngagementData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" />
                          <YAxis stroke="hsl(var(--muted-foreground))" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))", 
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px"
                            }} 
                          />
                          <Legend />
                          <Bar dataKey="impressions" fill="hsl(var(--primary))" name="Impressions" />
                          <Bar dataKey="clicks" fill="hsl(142, 76%, 36%)" name="Clicks" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Rollup Metrics - DATA INTEGRITY ENFORCED with visible provenance */}
              <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
                {/* Revenue Card */}
                <Card className="border-border bg-card relative">
                  {dataIntegrity.isDemoMode && (
                    <Badge className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5">
                      Demo
                    </Badge>
                  )}
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Revenue
                    </CardTitle>
                    <DollarSign className="h-5 w-5 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">
                      {/* RULE 3: If Stripe not connected in live mode, show $0 */}
                      {dataIntegrity.shouldShowRevenue 
                        ? dataIntegrity.formatRevenue(metrics.totalRevenue)
                        : "—"}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dataIntegrity.isLiveMode && !dataIntegrity.integrations.stripe 
                        ? "Connect Stripe to track"
                        : dataIntegrity.isDemoMode 
                          ? "Demo data" 
                          : "From Stripe"}
                    </p>
                  </CardContent>
                </Card>

                {/* Cost Card */}
                <Card className="border-border bg-card relative">
                  {dataIntegrity.isDemoMode && (
                    <Badge className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5">
                      Demo
                    </Badge>
                  )}
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Cost
                    </CardTitle>
                    <DollarSign className="h-5 w-5 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">
                      ${metrics.totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dataIntegrity.isDemoMode ? "Demo data" : "Total spend"}
                    </p>
                  </CardContent>
                </Card>

                {/* ROI Card */}
                <Card className="border-border bg-card relative">
                  {dataIntegrity.isDemoMode && (
                    <Badge className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5">
                      Demo
                    </Badge>
                  )}
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      ROI
                    </CardTitle>
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">
                      {/* RULE 3: If Stripe not connected in live mode, show "—" */}
                      {dataIntegrity.shouldShowRevenue 
                        ? dataIntegrity.formatROI(metrics.totalROI)
                        : "—"}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dataIntegrity.isLiveMode && !dataIntegrity.integrations.stripe 
                        ? "Connect Stripe to calculate"
                        : dataIntegrity.isDemoMode 
                          ? "Demo data" 
                          : "From revenue data"}
                    </p>
                  </CardContent>
                </Card>

                {/* Impressions/Clicks Card - NEW with proper enforcement */}
                <Card className="border-border bg-card relative">
                  {dataIntegrity.isDemoMode && (
                    <Badge className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5">
                      Demo
                    </Badge>
                  )}
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Impressions
                    </CardTitle>
                    <Eye className="h-5 w-5 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">
                      {/* RULE 4: If no analytics connected in live mode, show 0 */}
                      {dataIntegrity.shouldShowImpressions 
                        ? dataIntegrity.formatImpressions(metrics.totalImpressions).toLocaleString()
                        : "—"}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dataIntegrity.isLiveMode && !dataIntegrity.shouldShowImpressions 
                        ? "Connect analytics"
                        : dataIntegrity.isDemoMode 
                          ? "Demo data" 
                          : `${dataIntegrity.formatClicks(metrics.totalClicks).toLocaleString()} clicks`}
                    </p>
                  </CardContent>
                </Card>

                {/* Active Campaigns - always from real campaign records */}
                <Card className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Active Campaigns
                    </CardTitle>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">
                      {/* Always from actual campaign records, never placeholders */}
                      {metrics.activeCampaigns}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      From campaign records
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Connect Integrations CTA - only show in live mode with missing integrations */}
              {dataIntegrity.isLiveMode && (!dataIntegrity.integrations.stripe || !dataIntegrity.shouldShowImpressions) && campaigns.length > 0 && (
                <Card className="mb-8 border-blue-500/30 bg-blue-500/5">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldAlert className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-foreground">Missing Integrations</p>
                          <p className="text-sm text-muted-foreground">
                            {!dataIntegrity.integrations.stripe && "Stripe (revenue) "}
                            {!dataIntegrity.shouldShowImpressions && "Analytics (impressions/clicks)"}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => navigate("/settings/integrations")}
                        className="border-blue-500 text-blue-600 hover:bg-blue-500/10"
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Connect Integrations
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Queue Metrics Card */}
              <div className="mb-8">
                <Card className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Job Queue
                    </CardTitle>
                    <Activity className="h-5 w-5 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">
                      {queueMetrics.queuedJobs}
                    </div>
                    <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                      <p>{queueMetrics.lockedJobs} processing</p>
                      {queueMetrics.oldestQueuedAgeSeconds > 0 && (
                        <p className={queueMetrics.oldestQueuedAgeSeconds > 120 ? "text-destructive" : ""}>
                          Oldest: {queueMetrics.oldestQueuedAgeSeconds}s ago
                          {queueMetrics.oldestQueuedAgeSeconds > 120 && " ⚠️"}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Individual Campaigns */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground text-xl">
                        Live Campaigns
                      </CardTitle>
                      <CardDescription>
                        {lastRefresh ? (
                          <>Real-time metrics • Last updated: {lastRefresh.toLocaleTimeString()}</>
                        ) : (
                          "Real-time performance metrics from deployed campaigns"
                        )}
                      </CardDescription>
                    </div>
                    {campaigns.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {campaigns.length} active
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {campaigns.length === 0 ? (
                    <div className="py-16 text-center">
                      <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-4 text-lg font-medium text-foreground">
                        No activity yet
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Deploy campaigns to start tracking real performance data
                      </p>
                      {lastRefresh && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Last checked: {lastRefresh.toLocaleTimeString()}
                        </p>
                      )}
                      <Button
                        onClick={() => navigate("/new-campaign")}
                        className="mt-6"
                      >
                        Create Campaign
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                              Campaign
                            </th>
                            <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                              Channel
                            </th>
                            <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                              Impressions
                            </th>
                            <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                              Clicks
                            </th>
                            <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                              Revenue
                            </th>
                            <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                              Cost
                            </th>
                            <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                              ROI
                            </th>
                            <th className="pb-3 text-center text-sm font-medium text-muted-foreground">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaigns.map((campaign) => {
                            const Icon = getAssetIcon(campaign.type);
                            return (
                              <tr
                                key={campaign.id}
                                onClick={() => navigate(`/assets/${campaign.id}`)}
                                className="cursor-pointer border-b border-border transition-colors hover:bg-muted/50"
                              >
                                <td className="py-4">
                                  <div className="flex items-center gap-3">
                                    <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                                    <span className="text-sm font-medium text-foreground">
                                      {campaign.name}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-4 text-sm text-muted-foreground capitalize">
                                  {campaign.channel}
                                </td>
                                <td className="py-4 text-sm text-foreground text-right">
                                  {campaign.views.toLocaleString()}
                                </td>
                                <td className="py-4 text-sm text-foreground text-right">
                                  {campaign.clicks.toLocaleString()}
                                </td>
                                <td className="py-4 text-sm text-foreground text-right">
                                  ${campaign.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </td>
                                <td className="py-4 text-sm text-foreground text-right">
                                  ${campaign.cost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </td>
                                <td className="py-4 text-sm font-bold text-right">
                                  <span className={campaign.roi >= 0 ? "text-green-500" : "text-red-500"}>
                                    {campaign.roi.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="py-4 text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCampaignForRun({ id: campaign.id, name: campaign.name });
                                    }}
                                    className="gap-1"
                                  >
                                    <Activity className="h-4 w-4" />
                                    <span className="sr-only md:not-sr-only">Runs</span>
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
        <Footer />
        <AIWalkthrough forceShow={showTour} onClose={() => setShowTour(false)} />

        {/* Campaign Run Details Drawer */}
        {selectedCampaignForRun && (
          <CampaignRunDetailsDrawer
            campaignId={selectedCampaignForRun.id}
            campaignName={selectedCampaignForRun.name}
            open={!!selectedCampaignForRun}
            onOpenChange={(open) => !open && setSelectedCampaignForRun(null)}
          />
        )}
      </div>
    </ProtectedRoute>
  );
};

export default Dashboard;
