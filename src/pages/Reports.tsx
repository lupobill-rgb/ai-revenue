import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useDataIntegrity } from "@/hooks/useDataIntegrity";
import { usePipelineMetrics, formatPipelineMetric } from "@/hooks/usePipelineMetrics";
import { DataModeBanner } from "@/components/DemoModeToggle";
import { BarChart3, TrendingUp, DollarSign, Eye, Users, Clock, Target, ArrowUpRight, Database, Settings } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface CampaignReport {
  id: string;
  asset_name: string;
  channel: string;
  status: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  cost: number;
  roi: number;
  deployed_at: string | null;
}

interface PipelineStageData {
  stage: string;
  count: number;
  avgDays: number;
}

interface ConversionData {
  name: string;
  rate: number;
  count: number;
}

const PIPELINE_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--muted))"];

// Sample data for demo mode ONLY
const SAMPLE_CAMPAIGNS: CampaignReport[] = [
  { id: "1", asset_name: "Summer Sale Email Blast", channel: "email", status: "active", impressions: 45200, clicks: 3820, conversions: 412, revenue: 28450, cost: 2400, roi: 1085.4, deployed_at: "2024-11-15" },
  { id: "2", asset_name: "Black Friday Landing Page", channel: "landing_page", status: "active", impressions: 125000, clicks: 18750, conversions: 2340, revenue: 156780, cost: 8500, roi: 1744.5, deployed_at: "2024-11-20" },
  { id: "3", asset_name: "Product Demo Video", channel: "video", status: "active", impressions: 89400, clicks: 7150, conversions: 856, revenue: 42800, cost: 5200, roi: 723.1, deployed_at: "2024-11-18" },
];

const SAMPLE_PIPELINE: PipelineStageData[] = [
  { stage: "New", count: 156, avgDays: 1.2 },
  { stage: "Contacted", count: 98, avgDays: 2.8 },
  { stage: "Qualified", count: 67, avgDays: 5.4 },
  { stage: "Won", count: 45, avgDays: 12.3 },
  { stage: "Lost", count: 23, avgDays: 8.7 },
];

const SAMPLE_CONVERSION_DATA: ConversionData[] = [
  { name: "New → Contacted", rate: 72.4, count: 210 },
  { name: "Contacted → Qualified", rate: 68.4, count: 112 },
  { name: "Qualified → Won", rate: 67.2, count: 45 },
];

const Reports = () => {
  const navigate = useNavigate();
  const dataIntegrity = useDataIntegrity();
  
  // CRM SINGLE SOURCE OF TRUTH: Pipeline metrics from authoritative view
  const { metrics: pipelineMetrics, dataQuality, loading: pipelineLoading } = usePipelineMetrics(dataIntegrity.workspaceId);
  
  const [campaigns, setCampaigns] = useState<CampaignReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalROI, setTotalROI] = useState(0);
  const [totalImpressions, setTotalImpressions] = useState(0);
  const [pipelineData, setPipelineData] = useState<PipelineStageData[]>([]);
  const [conversionData, setConversionData] = useState<ConversionData[]>([]);

  // Determine if we're in demo mode from the authoritative source
  const isDemoMode = pipelineMetrics?.demo_mode === true;

  // Derived values from CRM truth
  const totalLeads = pipelineMetrics?.total_leads ?? 0;
  const wonDeals = pipelineMetrics?.won ?? 0;
  const lostDeals = pipelineMetrics?.lost ?? 0;
  const conversionRate = pipelineMetrics?.conversion_rate ?? 0;
  const winRate = pipelineMetrics?.win_rate ?? 0;
  const avgConversionDays = pipelineMetrics?.avg_conversion_time_days;

  useEffect(() => {
    if (isDemoMode) {
      // Demo mode: show sample data
      setCampaigns(SAMPLE_CAMPAIGNS);
      setPipelineData(SAMPLE_PIPELINE);
      setConversionData(SAMPLE_CONVERSION_DATA);
      setTotalRevenue(SAMPLE_CAMPAIGNS.reduce((sum, c) => sum + c.revenue, 0));
      setTotalImpressions(SAMPLE_CAMPAIGNS.reduce((sum, c) => sum + c.impressions, 0));
      setTotalROI(SAMPLE_CAMPAIGNS.reduce((sum, c) => sum + c.roi, 0) / SAMPLE_CAMPAIGNS.length);
      setLoading(false);
    } else if (pipelineMetrics) {
      // Live mode: derive from CRM truth
      derivePipelineDataFromMetrics();
      fetchCampaignReports();
    }
  }, [isDemoMode, pipelineMetrics]);

  const derivePipelineDataFromMetrics = () => {
    if (!pipelineMetrics) return;

    const newCount = Math.max(0, pipelineMetrics.total_leads - pipelineMetrics.contacted);
    const contactedCount = Math.max(0, pipelineMetrics.contacted - pipelineMetrics.qualified);
    const qualifiedCount = Math.max(0, pipelineMetrics.qualified - pipelineMetrics.converted);

    const stages: PipelineStageData[] = [
      { stage: "New", count: newCount, avgDays: 0 },
      { stage: "Contacted", count: contactedCount, avgDays: 0 },
      { stage: "Qualified", count: qualifiedCount, avgDays: 0 },
      { stage: "Won", count: pipelineMetrics.won, avgDays: 0 },
      { stage: "Lost", count: pipelineMetrics.lost, avgDays: 0 },
    ];

    setPipelineData(stages);

    const total = pipelineMetrics.total_leads || 1;
    const contacted = pipelineMetrics.contacted;
    const qualified = pipelineMetrics.qualified;
    const won = pipelineMetrics.won;

    const conversions: ConversionData[] = [
      { name: "New → Contacted", rate: total > 0 ? (contacted / total) * 100 : 0, count: contacted },
      { name: "Contacted → Qualified", rate: contacted > 0 ? (qualified / contacted) * 100 : 0, count: qualified },
      { name: "Qualified → Won", rate: qualified > 0 ? (won / qualified) * 100 : 0, count: won },
    ];

    setConversionData(conversions);
    setLoading(false);
  };

  const fetchCampaignReports = async () => {
    try {
      const workspaceId = dataIntegrity.workspaceId;
      if (!workspaceId) {
        setLoading(false);
        return;
      }

      const { data: impressionsData } = await supabase
        .from('v_impressions_clicks_by_workspace' as any)
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle() as { data: any };

      const { data: revenueData } = await supabase
        .from('v_revenue_by_workspace' as any)
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle() as { data: any };

      const analyticsConnected = impressionsData?.analytics_connected === true;
      const stripeConnected = revenueData?.stripe_connected === true;

      const { data: campaignsData } = await supabase
        .from("campaigns")
        .select(`id, channel, status, deployed_at, assets!inner(name)`)
        .in("status", ["active", "running", "deployed"]);

      const { data: gatedMetrics } = await supabase
        .from("v_campaign_metrics_gated")
        .select("*")
        .eq("workspace_id", workspaceId);

      const metricsMap = new Map((gatedMetrics || []).map((m: any) => [m.campaign_id, m]));

      const reports: CampaignReport[] = (campaignsData || []).map((campaign: any) => {
        const metrics = metricsMap.get(campaign.id) || {};
        return {
          id: campaign.id,
          asset_name: campaign.assets.name,
          channel: campaign.channel,
          status: campaign.status,
          impressions: analyticsConnected ? (metrics.impressions || 0) : 0,
          clicks: analyticsConnected ? (metrics.clicks || 0) : 0,
          conversions: analyticsConnected ? (metrics.conversions || 0) : 0,
          revenue: stripeConnected ? (metrics.revenue || 0) : 0,
          cost: stripeConnected ? (metrics.cost || 0) : 0,
          roi: stripeConnected && metrics.cost > 0 ? ((metrics.revenue - metrics.cost) / metrics.cost) * 100 : 0,
          deployed_at: campaign.deployed_at,
        };
      });

      setCampaigns(reports);
      setTotalRevenue(stripeConnected ? Number(revenueData?.revenue || 0) : 0);
      setTotalImpressions(analyticsConnected ? Number(impressionsData?.total_impressions || 0) : 0);
      setTotalROI(reports.length > 0 ? reports.reduce((sum, c) => sum + c.roi, 0) / reports.length : 0);
    } catch (error) {
      console.error("Error fetching campaign reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  const formatNumber = (num: number) => new Intl.NumberFormat("en-US").format(num);

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground">Analytics Dashboard</h1>
              <p className="mt-2 text-muted-foreground">Lead conversion rates, pipeline velocity, and campaign performance</p>
            </div>
            {isDemoMode && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Database className="h-3 w-3 mr-1" />
                SAMPLE DATA
              </Badge>
            )}
          </div>

          {dataIntegrity.workspaceId && (
            <DataModeBanner workspaceId={dataIntegrity.workspaceId} onConnectStripe={() => navigate("/settings/integrations")} onConnectAnalytics={() => navigate("/settings/integrations")} />
          )}

          <Tabs defaultValue="leads" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
              <TabsTrigger value="leads">Lead Analytics</TabsTrigger>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            </TabsList>

            <TabsContent value="leads" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(totalLeads)}</div>
                    <p className="text-xs text-muted-foreground">In pipeline</p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{conversionRate.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">{wonDeals} won deals</p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg. Conversion Time</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{avgConversionDays != null ? `${avgConversionDays.toFixed(1)} days` : "—"}</div>
                    <p className="text-xs text-muted-foreground">Lead to close</p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{winRate.toFixed(0)}%</div>
                    <p className="text-xs text-muted-foreground">Won vs Lost</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle>Stage Conversion Rates</CardTitle>
                    <CardDescription>Conversion rates between pipeline stages</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={conversionData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                          <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "Rate"]} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                          <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle>Lead Distribution</CardTitle>
                    <CardDescription>Current leads by pipeline stage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pipelineData} dataKey="count" nameKey="stage" cx="50%" cy="50%" outerRadius={100} label={({ stage, count }) => `${stage}: ${count}`}>
                            {pipelineData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={PIPELINE_COLORS[index % PIPELINE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="pipeline" className="space-y-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>Pipeline Stages</CardTitle>
                  <CardDescription>Current distribution of leads across stages</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pipelineData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="stage" />
                        <YAxis />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="campaigns" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(totalImpressions)}</div>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg. ROI</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalROI > 0 ? `${totalROI.toFixed(0)}%` : "0%"}</div>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{campaigns.length}</div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>Campaign Performance</CardTitle>
                  <CardDescription>Performance metrics for active campaigns</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div>
                  ) : campaigns.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No active campaigns</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign</TableHead>
                          <TableHead>Channel</TableHead>
                          <TableHead className="text-right">Impressions</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">ROI</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaigns.map((campaign) => (
                          <TableRow key={campaign.id}>
                            <TableCell className="font-medium">{campaign.asset_name}</TableCell>
                            <TableCell><Badge variant="outline">{campaign.channel}</Badge></TableCell>
                            <TableCell className="text-right">{formatNumber(campaign.impressions)}</TableCell>
                            <TableCell className="text-right">{formatNumber(campaign.clicks)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(campaign.revenue)}</TableCell>
                            <TableCell className="text-right">{campaign.roi > 0 ? `${campaign.roi.toFixed(0)}%` : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default Reports;
