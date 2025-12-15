import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Clock,
  Percent,
  BarChart3,
  Minus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface MetricSnapshot {
  date: string;
  metric_id: string;
  value: number;
}

interface KPIData {
  id: string;
  label: string;
  value: number | null;
  previousValue: number | null;
  unit: string;
  icon: React.ReactNode;
  format: (v: number) => string;
}

interface Props {
  tenantId: string | null;
}

const METRICS = [
  { id: "pipeline_total", label: "Pipeline", unit: "$", icon: <TrendingUp className="h-4 w-4" />, format: (v: number) => `$${(v / 1000).toFixed(0)}k` },
  { id: "bookings_total", label: "Bookings", unit: "$", icon: <DollarSign className="h-4 w-4" />, format: (v: number) => `$${(v / 1000).toFixed(0)}k` },
  { id: "payback_months", label: "Payback", unit: "mo", icon: <Clock className="h-4 w-4" />, format: (v: number) => `${v.toFixed(1)} mo` },
  { id: "cac_blended", label: "CAC", unit: "$", icon: <DollarSign className="h-4 w-4" />, format: (v: number) => `$${v.toFixed(0)}` },
  { id: "gross_margin_pct", label: "Margin", unit: "%", icon: <Percent className="h-4 w-4" />, format: (v: number) => `${v.toFixed(1)}%` },
];

export default function LiveRevenueSpinePanel({ tenantId }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<MetricSnapshot[]>([]);
  const [selectedMetric, setSelectedMetric] = useState("pipeline_total");
  const [kpis, setKpis] = useState<KPIData[]>([]);

  useEffect(() => {
    if (!tenantId) return;

    const fetchMetrics = async () => {
      setIsLoading(true);
      
      // Fetch last 30 days of metric snapshots
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from("metric_snapshots_daily")
        .select("date, metric_id, value")
        .eq("tenant_id", tenantId)
        .in("metric_id", METRICS.map(m => m.id))
        .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("date", { ascending: true });

      if (data) {
        setSnapshots(data as MetricSnapshot[]);
        
        // Calculate KPIs from latest values
        const kpiData: KPIData[] = METRICS.map(metric => {
          const metricSnapshots = data.filter(d => d.metric_id === metric.id);
          const latest = metricSnapshots[metricSnapshots.length - 1];
          const previous = metricSnapshots[metricSnapshots.length - 2];
          
          return {
            ...metric,
            value: latest?.value ?? null,
            previousValue: previous?.value ?? null,
          };
        });
        
        setKpis(kpiData);
      }
      
      setIsLoading(false);
    };

    fetchMetrics();
  }, [tenantId]);

  const getChartData = () => {
    return snapshots
      .filter(s => s.metric_id === selectedMetric)
      .map(s => ({
        date: new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: s.value,
      }));
  };

  const getTrend = (current: number | null, previous: number | null, metricId: string) => {
    if (current === null || previous === null) return null;
    const diff = current - previous;
    const pctChange = previous !== 0 ? (diff / previous) * 100 : 0;
    
    // For payback and CAC, lower is better
    const lowerIsBetter = metricId === "payback_months" || metricId === "cac_blended";
    const isPositive = lowerIsBetter ? diff < 0 : diff > 0;
    
    return { diff, pctChange, isPositive };
  };

  const selectedMetricConfig = METRICS.find(m => m.id === selectedMetric);

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Revenue Spine</CardTitle>
              <CardDescription>Live metrics from your revenue engine</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Revenue Spine</CardTitle>
              <CardDescription>Live metrics from your revenue engine</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            Last 30 days
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-5 gap-3">
          {kpis.map((kpi) => {
            const trend = getTrend(kpi.value, kpi.previousValue, kpi.id);
            const isSelected = selectedMetric === kpi.id;
            
            return (
              <button
                key={kpi.id}
                onClick={() => setSelectedMetric(kpi.id)}
                className={`p-3 rounded-lg border transition-all text-left ${
                  isSelected 
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
                    : "border-border/50 bg-secondary/30 hover:bg-secondary/50"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                    {kpi.icon}
                  </div>
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                </div>
                <div className="text-lg font-semibold">
                  {kpi.value !== null ? kpi.format(kpi.value) : "—"}
                </div>
                {trend && (
                  <div className={`flex items-center gap-1 text-xs ${
                    trend.isPositive ? "text-emerald-400" : "text-destructive"
                  }`}>
                    {trend.pctChange > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : trend.pctChange < 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    <span>{Math.abs(trend.pctChange).toFixed(1)}%</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Chart */}
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{selectedMetricConfig?.label} Over Time</span>
            </div>
            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
              <SelectTrigger className="w-40 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRICS.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="h-56">
            {getChartData().length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11 }} 
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }} 
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => selectedMetricConfig?.format(v) || v}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: number) => [selectedMetricConfig?.format(value), selectedMetricConfig?.label]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No data available for the selected period
              </div>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-xs text-muted-foreground text-center">
          Read-only view • Decisions are made in OS Actions & Experiments
        </p>
      </CardContent>
    </Card>
  );
}
