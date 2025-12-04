import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, CheckCircle, Clock, Eye, PlayCircle, Mail, Phone, Layout, DollarSign, Target, AlertCircle, Settings, Plus, BarChart3, LineChart, HelpCircle } from "lucide-react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import AIQuickActions from "@/components/AIQuickActions";
import WorkflowProgress from "@/components/WorkflowProgress";
import ProductTour from "@/components/ProductTour";
import { LineChart as RechartsLineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface CampaignMetrics {
  totalRevenue: number;
  totalCost: number;
  totalROI: number;
  totalImpressions: number;
  totalClicks: number;
  activeCampaigns: number;
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
  const [hasIntegrations, setHasIntegrations] = useState(false);
  const [showSampleData, setShowSampleData] = useState(true);
  const [showTour, setShowTour] = useState(false);

  // Sample data for demonstration
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
    checkIntegrations();

    // Auto-refresh metrics every 30 seconds for real-time tracking
    const interval = setInterval(() => {
      console.log('Auto-refreshing dashboard metrics...');
      fetchDashboardMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const checkIntegrations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("social_integrations")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1);

    setHasIntegrations((data?.length || 0) > 0);
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

      // Fetch campaigns with metrics
      const { data: campaignsData, error: campaignsError } = await supabase
        .from("campaigns")
        .select(`
          *,
          assets!inner(*),
          campaign_metrics(*)
        `)
        .eq("status", "active")
        .order("deployed_at", { ascending: false });

      if (campaignsError) throw campaignsError;

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
                  localStorage.removeItem("ubigrowth-tour-completed");
                  setShowTour(true);
                }}
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                Take Tour
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
              {/* Metrics Simulation Info */}
              {!hasIntegrations && campaigns.length > 0 && (
                <Card className="mb-8 border-blue-500/50 bg-blue-500/10">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <AlertCircle className="h-6 w-6 text-blue-500 flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <CardTitle className="text-foreground text-xl mb-2">
                          Live Campaign Tracking
                        </CardTitle>
                        <CardDescription className="text-foreground/80 mb-4">
                          Metrics update automatically every 30 seconds. Click below to manually refresh performance data.
                        </CardDescription>
                        <Button
                          onClick={async () => {
                            try {
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session) {
                                toast({
                                  variant: "destructive",
                                  title: "Not authenticated",
                                  description: "Please log in to refresh metrics",
                                });
                                return;
                              }
                              const { error } = await supabase.functions.invoke("sync-campaign-metrics");
                              if (error) throw error;
                              toast({
                                title: "Metrics Updated",
                                description: "Campaign performance data has been refreshed.",
                              });
                              fetchDashboardMetrics();
                            } catch (error) {
                              toast({
                                variant: "destructive",
                                title: "Error",
                                description: "Failed to sync metrics",
                              });
                            }
                          }}
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Refresh Metrics Now
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

              {/* Sample Data Toggle */}
              <Card className="mb-8 border-border bg-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground text-xl">Platform Preview Mode</CardTitle>
                      <CardDescription>
                        View sample metrics to explore the platform's analytics capabilities
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label htmlFor="sample-data-toggle" className="text-sm font-medium cursor-pointer">
                        {showSampleData ? "Hide Sample Data" : "Show Sample Data"}
                      </Label>
                      <Switch
                        id="sample-data-toggle"
                        checked={showSampleData}
                        onCheckedChange={setShowSampleData}
                      />
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Sample Metrics Graphs */}
              {showSampleData && (
                <div className="mb-8 grid gap-6 lg:grid-cols-2">
                  {/* Revenue vs Cost Chart */}
                  <Card className="border-border bg-card">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <LineChart className="h-5 w-5 text-primary" />
                        Revenue vs Cost Trend
                      </CardTitle>
                      <CardDescription>Monthly performance over 6 months (Sample Data)</CardDescription>
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
                      <CardDescription>Clicks vs Impressions by week (Sample Data)</CardDescription>
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

              {/* Rollup Metrics */}
              <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Revenue
                    </CardTitle>
                    <DollarSign className="h-5 w-5 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">
                      ${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Across all campaigns
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
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
                      Total spend
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      ROI
                    </CardTitle>
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">
                      {metrics.totalROI.toFixed(1)}%
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Return on investment
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Active Campaigns
                    </CardTitle>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">
                      {metrics.activeCampaigns}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Currently running
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Individual Campaigns */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground text-xl">
                    Live Campaigns
                  </CardTitle>
                  <CardDescription>
                    Real-time performance metrics from deployed campaigns
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {campaigns.length === 0 ? (
                    <div className="py-16 text-center">
                      <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-4 text-sm text-muted-foreground">
                        No active campaigns yet
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Create and approve campaigns to see live metrics
                      </p>
                      <Button
                        onClick={() => navigate("/new-campaign")}
                        className="mt-4"
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
        <ProductTour forceShow={showTour} onComplete={() => setShowTour(false)} />
      </div>
    </ProtectedRoute>
  );
};

export default Dashboard;
