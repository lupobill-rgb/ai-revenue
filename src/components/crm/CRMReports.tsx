import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  Legend, CartesianGrid
} from "recharts";
import { 
  TrendingUp, TrendingDown, Users, DollarSign, Target, 
  Calendar, Award, Loader2, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";

interface Lead {
  id: string;
  status: string;
  score: number;
  source: string;
  created_at: string;
  vertical: string | null;
}

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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [leadsRes, dealsRes] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("deals").select("*").order("created_at", { ascending: false }),
      ]);

      if (leadsRes.error) throw leadsRes.error;
      if (dealsRes.error) throw dealsRes.error;

      setLeads(leadsRes.data || []);
      setDeals(dealsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  const dateFilteredLeads = useMemo(() => {
    const cutoff = subDays(new Date(), parseInt(dateRange));
    return leads.filter(l => new Date(l.created_at) >= cutoff);
  }, [leads, dateRange]);

  const dateFilteredDeals = useMemo(() => {
    const cutoff = subDays(new Date(), parseInt(dateRange));
    return deals.filter(d => new Date(d.created_at) >= cutoff);
  }, [deals, dateRange]);

  // KPI Metrics
  const totalLeads = dateFilteredLeads.length;
  const convertedLeads = dateFilteredLeads.filter(l => l.status === "converted").length;
  const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
  const avgScore = dateFilteredLeads.length > 0 
    ? Math.round(dateFilteredLeads.reduce((sum, l) => sum + (l.score || 0), 0) / dateFilteredLeads.length)
    : 0;

  const totalPipelineValue = dateFilteredDeals
    .filter(d => !["closed_won", "closed_lost"].includes(d.stage))
    .reduce((sum, d) => sum + (d.value || 0), 0);
  
  const wonDealsValue = dateFilteredDeals
    .filter(d => d.stage === "closed_won")
    .reduce((sum, d) => sum + (d.value || 0), 0);

  // Lead trend data
  const leadTrendData = useMemo(() => {
    const days = parseInt(dateRange);
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, "yyyy-MM-dd");
      const dayLeads = leads.filter(l => format(parseISO(l.created_at), "yyyy-MM-dd") === dateStr);
      data.push({
        date: format(date, "MMM d"),
        leads: dayLeads.length,
        converted: dayLeads.filter(l => l.status === "converted").length,
      });
    }
    return data;
  }, [leads, dateRange]);

  // Lead source breakdown
  const sourceData = useMemo(() => {
    const sources: Record<string, number> = {};
    dateFilteredLeads.forEach(l => {
      sources[l.source] = (sources[l.source] || 0) + 1;
    });
    return Object.entries(sources)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [dateFilteredLeads]);

  // Lead status breakdown
  const statusData = useMemo(() => {
    const statuses: Record<string, number> = {};
    dateFilteredLeads.forEach(l => {
      statuses[l.status] = (statuses[l.status] || 0) + 1;
    });
    return Object.entries(statuses).map(([name, value]) => ({ name, value }));
  }, [dateFilteredLeads]);

  // Deal stage breakdown
  const dealStageData = useMemo(() => {
    const stages: Record<string, { count: number; value: number }> = {};
    dateFilteredDeals.forEach(d => {
      if (!stages[d.stage]) stages[d.stage] = { count: 0, value: 0 };
      stages[d.stage].count += 1;
      stages[d.stage].value += d.value || 0;
    });
    return Object.entries(stages).map(([name, data]) => ({ 
      name: name.replace("_", " "), 
      deals: data.count, 
      value: data.value 
    }));
  }, [dateFilteredDeals]);

  // Vertical performance
  const verticalData = useMemo(() => {
    const verticals: Record<string, { total: number; converted: number }> = {};
    dateFilteredLeads.forEach(l => {
      const v = l.vertical || "Unknown";
      if (!verticals[v]) verticals[v] = { total: 0, converted: 0 };
      verticals[v].total += 1;
      if (l.status === "converted") verticals[v].converted += 1;
    });
    return Object.entries(verticals)
      .map(([name, data]) => ({ 
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        total: data.total,
        converted: data.converted,
        rate: data.total > 0 ? Math.round((data.converted / data.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [dateFilteredLeads]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">CRM Analytics</h2>
          <p className="text-muted-foreground">Performance insights and metrics</p>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                <p className="text-3xl font-bold">{conversionRate.toFixed(1)}%</p>
              </div>
              <Target className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Value</p>
                <p className="text-3xl font-bold">${(totalPipelineValue / 1000).toFixed(0)}K</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Won Revenue</p>
                <p className="text-3xl font-bold">${(wonDealsValue / 1000).toFixed(0)}K</p>
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
                <BarChart data={dealStageData} layout="vertical">
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
                <BarChart data={verticalData}>
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

      {/* Lead Status Summary */}
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