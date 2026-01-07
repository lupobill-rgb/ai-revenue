import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend
} from "recharts";
import { 
  TrendingUp, Users, DollarSign, Target, 
  Award, Loader2, AlertCircle, Zap, Database, Upload, Clock
} from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useDataIntegrity } from "@/hooks/useDataIntegrity";
import { usePipelineMetrics, formatPipelineMetric } from "@/hooks/usePipelineMetrics";

interface Lead {
  id: string;
  status: string;
  score: number;
  source: string;
  created_at: string;
  vertical: string | null;
}

type TagCountRow = { tag: string; leads: number };
type SegmentCountRow = { segment: string; segmentName: string; color: string; leads: number };

interface Deal {
  id: string;
  name: string;
  value: number;
  stage: string;
  created_at: string;
  expected_close_date: string | null;
  actual_close_date: string | null;
}

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export function CRMReports() {
  const navigate = useNavigate();

  // SINGLE SOURCE OF TRUTH: Use centralized hooks for CRM truth
  const dataIntegrity = useDataIntegrity();

  // CRM AUTHORITATIVE VIEW: All pipeline metrics come from v_pipeline_metrics_by_workspace
  // This is the ONLY source of truth for leads, won/lost, conversion rates, etc.
  const { metrics: pipelineMetrics, dataQuality, loading, error } = usePipelineMetrics(dataIntegrity.workspaceId);

  // For chart visualizations only (not KPIs) - fetch raw data for trend charts
  const [leadTrendRaw, setLeadTrendRaw] = useState<Lead[]>([]);
  const [dateRange, setDateRange] = useState("30");

  // Lead tags report
  const [tagCounts, setTagCounts] = useState<TagCountRow[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);

  // Lead segments report
  const [segmentCounts, setSegmentCounts] = useState<SegmentCountRow[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);

  // Master Prompt v3: Channel visibility metrics
  const [channelStats, setChannelStats] = useState<Array<{ channel: string; sent: number; delivered: number }>>([]);
  const [channelLoading, setChannelLoading] = useState(false);

  useEffect(() => {
    // Only fetch raw leads for trend visualization - NOT for KPI computation
    const fetchTrendData = async () => {
      if (!dataIntegrity.workspaceId) return;

      const cutoff = subDays(new Date(), parseInt(dateRange));

      // Paginate to avoid the 1,000 row cap
      const pageSize = 1000;
      let offset = 0;
      const all: Lead[] = [];

      while (true) {
        const { data, error: trendError } = await supabase
          .from("leads")
          .select("id, status, source, vertical, score, created_at")
          .eq("workspace_id", dataIntegrity.workspaceId)
          .gte("created_at", cutoff.toISOString())
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (trendError) {
          console.error("[CRMReports] Failed to fetch lead trend data:", trendError);
          setLeadTrendRaw([]);
          return;
        }

        const batch = (data || []) as Lead[];
        all.push(...batch);

        if (batch.length < pageSize) break;
        offset += pageSize;
      }

      setLeadTrendRaw(all);
    };

    fetchTrendData();
  }, [dataIntegrity.workspaceId, dateRange]);

  useEffect(() => {
    // All-time tag report (not limited by date range)
    const fetchTagCounts = async () => {
      if (!dataIntegrity.workspaceId) return;

      setTagsLoading(true);
      try {
        const pageSize = 1000;
        let offset = 0;
        const counts = new Map<string, number>();

        while (true) {
          const { data, error: tagsError } = await supabase
            .from("leads")
            .select("id, tags")
            .eq("workspace_id", dataIntegrity.workspaceId)
            .order("created_at", { ascending: false })
            .range(offset, offset + pageSize - 1);

          if (tagsError) throw tagsError;

          const batch = (data || []) as { id: string; tags: string[] | null }[];

          for (const row of batch) {
            for (const tag of row.tags || []) {
              const normalized = tag.trim();
              if (!normalized) continue;
              counts.set(normalized, (counts.get(normalized) || 0) + 1);
            }
          }

          if (batch.length < pageSize) break;
          offset += pageSize;
        }

        const rows: TagCountRow[] = Array.from(counts.entries())
          .map(([tag, leads]) => ({ tag, leads }))
          .sort((a, b) => b.leads - a.leads);

        setTagCounts(rows);
      } catch (e) {
        console.error("[CRMReports] Failed to compute tag counts:", e);
        toast.error("Failed to load tag report");
        setTagCounts([]);
      } finally {
        setTagsLoading(false);
      }
    };

    fetchTagCounts();
  }, [dataIntegrity.workspaceId]);

  useEffect(() => {
    // All-time segment report
    const fetchSegmentCounts = async () => {
      if (!dataIntegrity.workspaceId) return;

      setSegmentsLoading(true);
      try {
        // First get segments for this tenant only
        const { data: segments } = await supabase
          .from("tenant_segments")
          .select("code, name, color")
          .eq("tenant_id", dataIntegrity.workspaceId)
          .eq("is_active", true);

        const segmentMap = new Map<string, { name: string; color: string }>();
        (segments || []).forEach((s: any) => {
          segmentMap.set(s.code, { name: s.name, color: s.color });
        });

        // Then count leads per segment
        const pageSize = 1000;
        let offset = 0;
        const counts = new Map<string, number>();

        while (true) {
          const { data, error } = await supabase
            .from("leads")
            .select("id, segment_code")
            .eq("workspace_id", dataIntegrity.workspaceId)
            .order("created_at", { ascending: false })
            .range(offset, offset + pageSize - 1);

          if (error) throw error;

          const batch = (data || []) as { id: string; segment_code: string | null }[];

          for (const row of batch) {
            const code = row.segment_code?.trim();
            if (!code) continue;
            counts.set(code, (counts.get(code) || 0) + 1);
          }

          if (batch.length < pageSize) break;
          offset += pageSize;
        }

        const rows: SegmentCountRow[] = Array.from(counts.entries())
          .map(([segment, leads]) => ({
            segment,
            segmentName: segmentMap.get(segment)?.name || segment,
            color: segmentMap.get(segment)?.color || "#6B7280",
            leads,
          }))
          .sort((a, b) => b.leads - a.leads);

        setSegmentCounts(rows);
      } catch (e) {
        console.error("[CRMReports] Failed to compute segment counts:", e);
        toast.error("Failed to load segment report");
        setSegmentCounts([]);
      } finally {
        setSegmentsLoading(false);
      }
    };

    fetchSegmentCounts();
  }, [dataIntegrity.workspaceId]);

  useEffect(() => {
    // Master Prompt v3: Fetch channel statistics from channel_outbox
    const fetchChannelStats = async () => {
      if (!dataIntegrity.workspaceId) return;

      setChannelLoading(true);
      try {
        // Fetch channel_outbox records for this workspace
        const { data: outboxData } = await supabase
          .from('channel_outbox')
          .select('channel, status')
          .eq('workspace_id', dataIntegrity.workspaceId);

        if (outboxData) {
          // Aggregate by channel
          const channelMap = new Map<string, { sent: number; delivered: number }>();
          
          outboxData.forEach((record: any) => {
            const channel = record.channel || 'unknown';
            const stats = channelMap.get(channel) || { sent: 0, delivered: 0 };
            
            if (record.status === 'sent' || record.status === 'delivered') {
              stats.sent++;
            }
            if (record.status === 'delivered') {
              stats.delivered++;
            }
            
            channelMap.set(channel, stats);
          });

          // Convert to array and sort by sent count
          const statsArray = Array.from(channelMap.entries())
            .map(([channel, stats]) => ({ channel, ...stats }))
            .sort((a, b) => b.sent - a.sent);

          setChannelStats(statsArray);
        }
      } catch (error) {
        console.error('[CRMReports] Failed to fetch channel stats:', error);
      } finally {
        setChannelLoading(false);
      }
    };

    fetchChannelStats();
  }, [dataIntegrity.workspaceId]);

  // CRM-SPECIFIC STRICTER RULES (no demo carryover, no inference)
  // Data quality status determines what we can show
  const isStripeConnected = dataQuality?.stripe_connected === true;
  const isDemoMode = pipelineMetrics?.demo_mode === true;
  
  // CRM gate: Only show CRM-derived metrics if Stripe is connected OR demo mode
  // In live mode without Stripe, all revenue/win metrics must be "—"
  const canShowCRMMetrics = isDemoMode || isStripeConnected;

  // ALL KPIs come from the authoritative view - NO local computation
  const totalLeads = pipelineMetrics?.total_leads ?? 0;
  const contacted = pipelineMetrics?.contacted ?? 0;
  const qualified = pipelineMetrics?.qualified ?? 0;
  const converted = pipelineMetrics?.converted ?? 0;
  const wonDealsCount = pipelineMetrics?.won ?? 0;
  const lostDealsCount = pipelineMetrics?.lost ?? 0;
  
  // Gated metrics - require Stripe connection or demo mode
  const conversionRate = canShowCRMMetrics ? (pipelineMetrics?.conversion_rate ?? 0) : 0;
  const winRate = canShowCRMMetrics ? (pipelineMetrics?.win_rate ?? null) : null;
  const avgConversionDays = canShowCRMMetrics ? pipelineMetrics?.avg_conversion_time_days : null;
  const verifiedRevenue = canShowCRMMetrics ? (pipelineMetrics?.verified_revenue ?? 0) : 0;

  // Lead trend data - uses raw lead data for visualization only
  const leadTrendData = useMemo(() => {
    const days = parseInt(dateRange);
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, "yyyy-MM-dd");
      const dayLeads = leadTrendRaw.filter(l => format(parseISO(l.created_at), "yyyy-MM-dd") === dateStr);
      data.push({
        date: format(date, "MMM d"),
        leads: dayLeads.length,
        converted: canShowCRMMetrics ? dayLeads.filter(l => l.status === "converted").length : 0,
      });
    }
    return data;
  }, [leadTrendRaw, dateRange, canShowCRMMetrics]);

  // Lead source breakdown - for visualization
  const sourceData = useMemo(() => {
    const sources: Record<string, number> = {};
    leadTrendRaw.forEach(l => {
      sources[l.source] = (sources[l.source] || 0) + 1;
    });
    return Object.entries(sources)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [leadTrendRaw]);

  const tagChartData = useMemo(() => {
    return tagCounts
      .slice(0, 12)
      .map((r) => ({ name: r.tag.length > 14 ? `${r.tag.slice(0, 14)}…` : r.tag, leads: r.leads }));
  }, [tagCounts]);

  const segmentChartData = useMemo(() => {
    return segmentCounts
      .slice(0, 12)
      .map((r) => ({ 
        name: r.segmentName.length > 14 ? `${r.segmentName.slice(0, 14)}…` : r.segmentName, 
        leads: r.leads,
        fill: r.color,
      }));
  }, [segmentCounts]);

  // Lead status breakdown - for visualization
  const statusData = useMemo(() => {
    const statuses: Record<string, number> = {};
    leadTrendRaw.forEach(l => {
      statuses[l.status] = (statuses[l.status] || 0) + 1;
    });
    return Object.entries(statuses).map(([name, value]) => ({ name, value }));
  }, [leadTrendRaw]);

  // Pipeline stage data from authoritative view
  const pipelineStageData = useMemo(() => {
    if (!pipelineMetrics) return [];
    
    const newCount = Math.max(0, totalLeads - contacted);
    const contactedCount = Math.max(0, contacted - qualified);
    const qualifiedCount = Math.max(0, qualified - converted);
    
    return [
      { name: "New", deals: newCount, value: 0 },
      { name: "Contacted", deals: contactedCount, value: 0 },
      { name: "Qualified", deals: qualifiedCount, value: 0 },
      { name: "Won", deals: canShowCRMMetrics ? wonDealsCount : 0, value: canShowCRMMetrics ? verifiedRevenue : 0 },
      { name: "Lost", deals: canShowCRMMetrics ? lostDealsCount : 0, value: 0 },
    ];
  }, [pipelineMetrics, totalLeads, contacted, qualified, converted, wonDealsCount, lostDealsCount, verifiedRevenue, canShowCRMMetrics]);

  // Vertical performance - for visualization
  const verticalData = useMemo(() => {
    const verticals: Record<string, { total: number; converted: number }> = {};
    leadTrendRaw.forEach(l => {
      const v = l.vertical || "Unknown";
      if (!verticals[v]) verticals[v] = { total: 0, converted: 0 };
      verticals[v].total += 1;
      if (canShowCRMMetrics && l.status === "converted") verticals[v].converted += 1;
    });
    return Object.entries(verticals)
      .map(([name, data]) => ({ 
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        total: data.total,
        converted: data.converted,
        rate: canShowCRMMetrics && data.total > 0 ? Math.round((data.converted / data.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [leadTrendRaw, canShowCRMMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Display values - all derived from authoritative view
  const gatedConversionRate = conversionRate;
  const gatedWonValue = verifiedRevenue;
  const gatedLeadTrendData = leadTrendData;
  const gatedVerticalData = verticalData;
  const gatedDealStageData = pipelineStageData;

  return (
    <div className="space-y-6">
      {/* CRM DATA MODE BANNER - Explicit messaging for demo vs live */}
      {dataIntegrity.isDemoMode ? (
        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <Database className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <Badge className="bg-amber-500 text-white text-xs px-2 py-0.5">Demo Data</Badge>
            CRM Preview Mode
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <p className="mb-2 font-medium">These metrics are simulated to show potential outcomes.</p>
            <p className="text-sm">Revenue KPIs require Stripe for verification. Connect providers and import real deals to see live results.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => navigate("/settings/integrations")}>
                <Zap className="h-3 w-3 mr-1" />
                Connect Stripe
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/crm")}>
                <Upload className="h-3 w-3 mr-1" />
                Import Deals
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : !canShowCRMMetrics ? (
        <Alert className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800 dark:text-orange-200">Setup Required</AlertTitle>
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            <p className="mb-2 font-medium">Revenue metrics are zeroed because Stripe is not connected.</p>
            <p className="text-sm">CRM requires verified payment data — Win rate, Pipeline value, and Won revenue will show "—" until Stripe is connected.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" variant="default" onClick={() => navigate("/settings/integrations")}>
                <Zap className="h-3 w-3 mr-1" />
                Connect Stripe
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/crm")}>
                <Upload className="h-3 w-3 mr-1" />
                Import Deals
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* CRM TRUTH GUARDRAIL - Non-negotiable transparency */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground">
        <Database className="h-3 w-3 flex-shrink-0" />
        <span>Metrics are driven from CRM deal outcomes. No inferred or estimated revenue.</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold">CRM Analytics</h2>
            <p className="text-muted-foreground">Performance insights and metrics</p>
          </div>
          {/* DATA MODE BADGE */}
          {dataIntegrity.isDemoMode ? (
            <Badge className="bg-amber-500 text-white text-xs px-2 py-1">Demo Data</Badge>
          ) : canShowCRMMetrics ? (
            <Badge className="bg-green-500 text-white text-xs px-2 py-1">Live Data</Badge>
          ) : (
            <Badge variant="destructive" className="text-xs px-2 py-1">Setup Required</Badge>
          )}
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-3xl font-bold">{totalLeads}</p>
              </div>
              <Users className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-3xl font-bold">{canShowCRMMetrics ? `${gatedConversionRate.toFixed(1)}%` : "—"}</p>
              </div>
              <Target className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-3xl font-bold">{winRate !== null ? `${winRate.toFixed(1)}%` : "—"}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Conversion Time</p>
                <p className="text-3xl font-bold">{avgConversionDays != null ? `${avgConversionDays.toFixed(1)} days` : "—"}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Won Revenue</p>
                <p className="text-3xl font-bold">{canShowCRMMetrics ? `$${(gatedWonValue / 1000).toFixed(0)}K` : "—"}</p>
              </div>
              <Award className="h-8 w-8 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Generation Trend</CardTitle>
            <CardDescription>New leads over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={leadTrendData}>
                  <defs>
                    <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Area type="monotone" dataKey="leads" stroke="hsl(var(--primary))" fill="url(#leadGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Lead Sources */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Sources</CardTitle>
            <CardDescription>Where leads come from</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {sourceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deal Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle>Deal Pipeline</CardTitle>
            <CardDescription>Deals by stage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gatedDealStageData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} width={100} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    formatter={(value: number, name: string) => [name === "value" ? `$${value.toLocaleString()}` : value, name === "value" ? "Value" : "Deals"]}
                  />
                  <Legend />
                  <Bar dataKey="deals" fill="hsl(var(--chart-1))" name="Deals" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Vertical Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Performance by Vertical</CardTitle>
            <CardDescription>Conversion rates by industry</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gatedVerticalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Bar dataKey="total" fill="hsl(var(--chart-1))" name="Total Leads" />
                  <Bar dataKey="converted" fill="hsl(var(--chart-3))" name="Converted" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Master Prompt v3: Channel Activity Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Messages by Channel
          </CardTitle>
          <CardDescription>Messages sent, voicemail drops, SMS delivery counts</CardDescription>
        </CardHeader>
        <CardContent>
          {channelLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : channelStats.length === 0 ? (
            <div className="text-sm text-muted-foreground">No channel activity yet. Launch campaigns to see stats.</div>
          ) : (
            <div className="space-y-4">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={channelStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="channel" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Legend />
                    <Bar dataKey="sent" fill="hsl(var(--chart-1))" name="Sent" />
                    <Bar dataKey="delivered" fill="hsl(var(--chart-3))" name="Delivered" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {channelStats.map((stat) => (
                  <div key={stat.channel} className="p-3 rounded-lg border bg-muted/30">
                    <div className="text-sm font-medium capitalize">{stat.channel.replace('_', ' ')}</div>
                    <div className="text-2xl font-bold mt-1">{stat.sent.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">
                      {stat.delivered} delivered
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leads by Tag */}
      <Card>
        <CardHeader>
          <CardTitle>Leads by Tag</CardTitle>
          <CardDescription>All-time counts of leads per tag</CardDescription>
        </CardHeader>
        <CardContent>
          {tagsLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tagCounts.length === 0 ? (
            <div className="text-sm text-muted-foreground">No tags found on leads yet.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tagChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="leads" fill="hsl(var(--chart-2))" name="Leads" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {tagCounts.slice(0, 20).map((row) => (
                  <div key={row.tag} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                    <div className="font-medium truncate" title={row.tag}>{row.tag}</div>
                    <Badge variant="secondary">{row.leads.toLocaleString()}</Badge>
                  </div>
                ))}
                {tagCounts.length > 20 && (
                  <div className="text-xs text-muted-foreground">Showing top 20 of {tagCounts.length.toLocaleString()} tags.</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leads by Segment */}
      <Card>
        <CardHeader>
          <CardTitle>Leads by Segment</CardTitle>
          <CardDescription>All-time counts of leads per segment</CardDescription>
        </CardHeader>
        <CardContent>
          {segmentsLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : segmentCounts.length === 0 ? (
            <div className="text-sm text-muted-foreground">No segments assigned to leads yet.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={segmentChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="leads" name="Leads">
                      {segmentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {segmentCounts.slice(0, 20).map((row) => (
                  <div key={row.segment} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: row.color }}
                      />
                      <div className="font-medium truncate" title={row.segmentName}>{row.segmentName}</div>
                    </div>
                    <Badge variant="secondary">{row.leads.toLocaleString()}</Badge>
                  </div>
                ))}
                {segmentCounts.length > 20 && (
                  <div className="text-xs text-muted-foreground">Showing top 20 of {segmentCounts.length.toLocaleString()} segments.</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Lead Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {statusData.map(status => (
              <div key={status.name} className="text-center p-4 rounded-lg bg-muted/30">
                <p className="text-2xl font-bold">{status.value}</p>
                <p className="text-sm text-muted-foreground capitalize">{status.name}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}