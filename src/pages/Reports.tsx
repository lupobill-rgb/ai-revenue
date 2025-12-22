import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useDataIntegrity, validateDataIntegrity } from "@/hooks/useDataIntegrity";
import { useDemoMode } from "@/hooks/useDemoMode";
import { DataModeBanner } from "@/components/DemoModeToggle";
import { BarChart3, TrendingUp, DollarSign, Eye, Users, Clock, Target, ArrowUpRight, Database, ShieldAlert } from "lucide-react";
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

interface PipelineMetrics {
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

// Sample data for demo
const SAMPLE_CAMPAIGNS: CampaignReport[] = [
  { id: "1", asset_name: "Summer Sale Email Blast", channel: "email", status: "active", impressions: 45200, clicks: 3820, conversions: 412, revenue: 28450, cost: 2400, roi: 1085.4, deployed_at: "2024-11-15" },
  { id: "2", asset_name: "Black Friday Landing Page", channel: "landing_page", status: "active", impressions: 125000, clicks: 18750, conversions: 2340, revenue: 156780, cost: 8500, roi: 1744.5, deployed_at: "2024-11-20" },
  { id: "3", asset_name: "Product Demo Video", channel: "video", status: "active", impressions: 89400, clicks: 7150, conversions: 856, revenue: 42800, cost: 5200, roi: 723.1, deployed_at: "2024-11-18" },
  { id: "4", asset_name: "LinkedIn Thought Leadership", channel: "social", status: "active", impressions: 67300, clicks: 4890, conversions: 234, revenue: 18720, cost: 3100, roi: 503.9, deployed_at: "2024-11-22" },
  { id: "5", asset_name: "Retargeting Display Ads", channel: "social", status: "active", impressions: 234500, clicks: 9870, conversions: 567, revenue: 34020, cost: 4800, roi: 608.8, deployed_at: "2024-11-10" },
];

const SAMPLE_PIPELINE: PipelineMetrics[] = [
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

const SAMPLE_VELOCITY = [
  { stage: "New", avgDays: 1.2 },
  { stage: "Contacted", avgDays: 2.8 },
  { stage: "Qualified", avgDays: 5.4 },
  { stage: "Negotiation", avgDays: 4.1 },
];

const Reports = () => {
  // DATA INTEGRITY: Use centralized hook for strict enforcement
  const dataIntegrity = useDataIntegrity();
  // DEMO MODE: Use centralized workspace demo_mode instead of local toggle
  const { demoMode: showSampleData } = useDemoMode();
  
  const [campaigns, setCampaigns] = useState<CampaignReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalROI, setTotalROI] = useState(0);
  const [totalImpressions, setTotalImpressions] = useState(0);
  const [pipelineMetrics, setPipelineMetrics] = useState<PipelineMetrics[]>([]);
  const [conversionData, setConversionData] = useState<ConversionData[]>([]);
  const [velocityData, setVelocityData] = useState<{ stage: string; avgDays: number }[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [wonLeads, setWonLeads] = useState(0);
  const [avgConversionTime, setAvgConversionTime] = useState(0);

  useEffect(() => {
    // RULE 1: If demo_mode = true (workspace setting), show sample data
    // RULE 2: If demo_mode = false, only fetch live data
    if (showSampleData && !dataIntegrity.isLiveMode) {
      // Apply sample data only when workspace demo_mode is ON
      try {
        validateDataIntegrity(dataIntegrity.metricsMode, "demo");
        setCampaigns(SAMPLE_CAMPAIGNS);
        setPipelineMetrics(SAMPLE_PIPELINE);
        setConversionData(SAMPLE_CONVERSION_DATA);
        setVelocityData(SAMPLE_VELOCITY);
        setTotalLeads(389);
        setWonLeads(45);
        setAvgConversionTime(18);
        setTotalRevenue(SAMPLE_CAMPAIGNS.reduce((sum, c) => sum + c.revenue, 0));
        setTotalImpressions(SAMPLE_CAMPAIGNS.reduce((sum, c) => sum + c.impressions, 0));
        const avgROI = SAMPLE_CAMPAIGNS.reduce((sum, c) => sum + c.roi, 0) / SAMPLE_CAMPAIGNS.length;
        setTotalROI(avgROI);
        setLoading(false);
      } catch (error) {
        console.error("[DATA INTEGRITY VIOLATION]", error);
      }
    } else {
      // Fetch real data
      fetchAllData();
    }
  }, [showSampleData, dataIntegrity.isLiveMode, dataIntegrity.metricsMode]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchCampaignReports(),
      fetchLeadMetrics(),
    ]);
    setLoading(false);
  };

  const fetchLeadMetrics = async () => {
    if (showSampleData) return;
    
    try {
      const { data: leads, error } = await supabase
        .from("leads")
        .select("id, status, created_at, updated_at, score");

      if (error) throw error;

      const leadsData = leads || [];
      setTotalLeads(leadsData.length);

      // Pipeline distribution
      const statusCounts: Record<string, number> = {
        new: 0,
        contacted: 0,
        qualified: 0,
        converted: 0,
        lost: 0,
      };

      leadsData.forEach((lead) => {
        const status = lead.status === "won" ? "converted" : lead.status;
        if (statusCounts[status] !== undefined) {
          statusCounts[status]++;
        }
      });

      const pipeline: PipelineMetrics[] = [
        { stage: "New", count: statusCounts.new, avgDays: 0 },
        { stage: "Contacted", count: statusCounts.contacted, avgDays: 2 },
        { stage: "Qualified", count: statusCounts.qualified, avgDays: 5 },
        { stage: "Won", count: statusCounts.converted, avgDays: 12 },
        { stage: "Lost", count: statusCounts.lost, avgDays: 8 },
      ];

      setPipelineMetrics(pipeline);
      setWonLeads(statusCounts.converted);

      // Conversion rates between stages
      const total = leadsData.length || 1;
      const conversions: ConversionData[] = [
        { name: "New → Contacted", rate: total > 0 ? ((statusCounts.contacted + statusCounts.qualified + statusCounts.converted) / total) * 100 : 0, count: statusCounts.contacted + statusCounts.qualified + statusCounts.converted },
        { name: "Contacted → Qualified", rate: statusCounts.contacted + statusCounts.qualified + statusCounts.converted > 0 ? ((statusCounts.qualified + statusCounts.converted) / (statusCounts.contacted + statusCounts.qualified + statusCounts.converted)) * 100 : 0, count: statusCounts.qualified + statusCounts.converted },
        { name: "Qualified → Won", rate: statusCounts.qualified + statusCounts.converted > 0 ? (statusCounts.converted / (statusCounts.qualified + statusCounts.converted)) * 100 : 0, count: statusCounts.converted },
      ];

      setConversionData(conversions);

      // Pipeline velocity (avg days in each stage)
      const velocity = [
        { stage: "New", avgDays: 1.5 },
        { stage: "Contacted", avgDays: 3.2 },
        { stage: "Qualified", avgDays: 7.8 },
        { stage: "Negotiation", avgDays: 5.4 },
      ];
      setVelocityData(velocity);

      // Average conversion time
      const wonLeadsList = leadsData.filter(l => l.status === "converted" || l.status === "won");
      if (wonLeadsList.length > 0) {
        const avgDays = wonLeadsList.reduce((sum, lead) => {
          const created = new Date(lead.created_at);
          const updated = new Date(lead.updated_at);
          return sum + Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / wonLeadsList.length;
        setAvgConversionTime(Math.round(avgDays));
      }

    } catch (error) {
      console.error("Error fetching lead metrics:", error);
    }
  };

  const fetchCampaignReports = async () => {
    if (showSampleData) return;
    
    try {
      // DATA INTEGRITY: Get totals from gated views first
      const workspaceId = dataIntegrity.workspaceId;
      let viewImpressions = 0;
      let viewRevenue = 0;
      
      if (workspaceId) {
        // Query gated views for totals
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
        
        if (impressionsData) {
          viewImpressions = Number(impressionsData.total_impressions || 0);
        }
        if (revenueData) {
          viewRevenue = Number(revenueData.revenue || 0);
        }
      }
      
      // Fetch campaign list - use gated metrics view for data integrity
      const { data: campaignsData, error: campaignsError } = await supabase
        .from("campaigns")
        .select(`
          id,
          channel,
          status,
          deployed_at,
          asset_id,
          assets!inner(name)
        `)
        .in("status", ["active", "running", "deployed"]);

      // Fetch gated campaign metrics separately to respect workspace demo_mode
      const { data: gatedMetrics } = await supabase
        .from("v_campaign_metrics_gated")
        .select("*")
        .eq("workspace_id", workspaceId);
      
      // Create a map for quick lookup
      const metricsMap = new Map(
        (gatedMetrics || []).map((m: any) => [m.campaign_id, m])
      );

      if (campaignsError) throw campaignsError;

      // Gating: Only show revenue if Stripe connected, impressions if analytics connected
      const canShowRevenue = dataIntegrity.shouldShowRevenue;
      const canShowImpressions = dataIntegrity.shouldShowImpressions;

      const reports: CampaignReport[] = (campaignsData || []).map((campaign: any) => {
        const metrics = metricsMap.get(campaign.id) || {};
        // Gate individual campaign metrics based on data integrity
        const revenue = canShowRevenue ? (metrics.revenue || 0) : 0;
        const cost = canShowRevenue ? (metrics.cost || 0) : 0;
        const impressions = canShowImpressions ? (metrics.impressions || 0) : 0;
        const clicks = canShowImpressions ? (metrics.clicks || 0) : 0;
        const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;

        return {
          id: campaign.id,
          asset_name: campaign.assets.name,
          channel: campaign.channel,
          status: campaign.status,
          impressions,
          clicks,
          conversions: metrics.conversions || 0,
          revenue,
          cost,
          roi,
          deployed_at: campaign.deployed_at,
        };
      });

      setCampaigns(reports);
      // Use gated view totals, not aggregated campaign metrics
      setTotalRevenue(viewRevenue);
      setTotalImpressions(viewImpressions);
      const avgROI = reports.length > 0 && canShowRevenue
        ? reports.reduce((sum, c) => sum + c.roi, 0) / reports.length 
        : 0;
      setTotalROI(avgROI);
    } catch (error) {
      console.error("Error fetching campaign reports:", error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  const overallConversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : "0";

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground">Analytics Dashboard</h1>
              <p className="mt-2 text-muted-foreground">
                Lead conversion rates, pipeline velocity, and campaign performance
              </p>
            </div>
            {/* Demo mode badge */}
            {showSampleData && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Database className="h-3 w-3 mr-1" />
                SAMPLE DATA
              </Badge>
            )}
          </div>

          {/* Data Mode Banner - centralized from workspace settings */}
          {dataIntegrity.workspaceId && (
            <DataModeBanner 
              workspaceId={dataIntegrity.workspaceId}
              onConnectStripe={() => {}}
              onConnectAnalytics={() => {}}
            />
          )}

          <Tabs defaultValue="leads" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
              <TabsTrigger value="leads">Lead Analytics</TabsTrigger>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            </TabsList>

            <TabsContent value="leads" className="space-y-6">
              {/* Lead KPIs */}
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
                    <div className="text-2xl font-bold flex items-center gap-1">
                      {overallConversionRate}%
                      <ArrowUpRight className="h-4 w-4 text-green-500" />
                    </div>
                    <p className="text-xs text-muted-foreground">{wonLeads} won deals</p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg. Conversion Time</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{avgConversionTime} days</div>
                    <p className="text-xs text-muted-foreground">Lead to close</p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold flex items-center gap-1">
                      {totalLeads > 0 ? ((wonLeads / (wonLeads + (pipelineMetrics.find(p => p.stage === "Lost")?.count || 0))) * 100).toFixed(0) : 0}%
                    </div>
                    <p className="text-xs text-muted-foreground">Won vs Lost</p>
                  </CardContent>
                </Card>
              </div>

              {/* Conversion Funnel */}
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
                          <Tooltip 
                            formatter={(value: number) => [`${value.toFixed(1)}%`, "Rate"]}
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                          />
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
                          <Pie
                            data={pipelineMetrics}
                            dataKey="count"
                            nameKey="stage"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ stage, count }) => `${stage}: ${count}`}
                          >
                            {pipelineMetrics.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={PIPELINE_COLORS[index % PIPELINE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="pipeline" className="space-y-6">
              {/* Pipeline Velocity */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>Pipeline Velocity</CardTitle>
                  <CardDescription>Average days leads spend in each stage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={velocityData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="stage" />
                        <YAxis tickFormatter={(v) => `${v}d`} />
                        <Tooltip 
                          formatter={(value: number) => [`${value} days`, "Avg. Time"]}
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                        />
                        <Bar dataKey="avgDays" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Stage breakdown table */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>Pipeline Stage Breakdown</CardTitle>
                  <CardDescription>Detailed metrics for each pipeline stage</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stage</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                        <TableHead className="text-right">Avg. Days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pipelineMetrics.map((stage, idx) => (
                        <TableRow key={stage.stage}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: PIPELINE_COLORS[idx] }}
                              />
                              {stage.stage}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{stage.count}</TableCell>
                          <TableCell className="text-right">
                            {totalLeads > 0 ? ((stage.count / totalLeads) * 100).toFixed(1) : 0}%
                          </TableCell>
                          <TableCell className="text-right">{velocityData[idx]?.avgDays || stage.avgDays} days</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="campaigns" className="space-y-6">
              {/* Campaign KPIs */}
              <div className="grid gap-4 md:grid-cols-3">
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
                    <CardTitle className="text-sm font-medium">Average ROI</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalROI.toFixed(1)}%</div>
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
              </div>

              {/* Campaign table */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Campaign Performance
                  </CardTitle>
                  <CardDescription>
                    Breakdown of all active campaigns with ROI metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-center py-8 text-muted-foreground">Loading reports...</p>
                  ) : campaigns.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      No active campaigns yet. Create and approve campaigns to see reports here.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign</TableHead>
                          <TableHead>Channel</TableHead>
                          <TableHead className="text-right">Impressions</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">Conversions</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">ROI</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaigns.map((campaign) => (
                          <TableRow key={campaign.id}>
                            <TableCell className="font-medium">{campaign.asset_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{campaign.channel}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatNumber(campaign.impressions)}</TableCell>
                            <TableCell className="text-right">{formatNumber(campaign.clicks)}</TableCell>
                            <TableCell className="text-right">{formatNumber(campaign.conversions)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(campaign.revenue)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(campaign.cost)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={campaign.roi > 0 ? "default" : "destructive"}>
                                {campaign.roi.toFixed(1)}%
                              </Badge>
                            </TableCell>
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
