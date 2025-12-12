import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Activity, 
  Users, 
  Target, 
  DollarSign, 
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FunnelStage {
  id: string;
  label: string;
  value: number;
  change: number;
  changeDirection: "up" | "down" | "flat";
}

interface KeyMetric {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  trend: "up" | "down" | "flat";
  trendValue?: string;
}

interface CampaignHealth {
  id: string;
  name: string;
  status: "on_track" | "at_risk" | "off_track";
  pipeline: number;
  bookings: number;
}

interface Props {
  tenantId: string | null;
}

export default function LiveRevenueSpinePanel({ tenantId }: Props) {
  const [timeRange, setTimeRange] = useState("30d");
  const [funnel, setFunnel] = useState<FunnelStage[]>([
    { id: "visitors", label: "Visitors", value: 0, change: 0, changeDirection: "flat" },
    { id: "leads", label: "Leads", value: 0, change: 0, changeDirection: "flat" },
    { id: "opps", label: "Opportunities", value: 0, change: 0, changeDirection: "flat" },
    { id: "bookings", label: "Bookings", value: 0, change: 0, changeDirection: "flat" },
    { id: "revenue", label: "Revenue", value: 0, change: 0, changeDirection: "flat" },
  ]);

  const [keyMetrics, setKeyMetrics] = useState<KeyMetric[]>([
    { id: "pipeline", label: "Pipeline", value: "$0", trend: "flat" },
    { id: "win_rate", label: "Win Rate", value: "0%", trend: "flat" },
    { id: "cac", label: "CAC", value: "$0", trend: "flat" },
    { id: "payback", label: "Payback", value: "0 mo", trend: "flat" },
    { id: "margin", label: "Margin", value: "0%", trend: "flat" },
  ]);

  const [campaigns, setCampaigns] = useState<CampaignHealth[]>([]);

  useEffect(() => {
    if (!tenantId) return;

    const fetchData = async () => {
      // Fetch metric snapshots
      const { data: metrics } = await supabase
        .from("metric_snapshots_daily")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("date", { ascending: false })
        .limit(60);

      if (metrics && metrics.length > 0) {
        const latestByMetric = new Map<string, typeof metrics[0]>();
        metrics.forEach(m => {
          if (!latestByMetric.has(m.metric_id)) {
            latestByMetric.set(m.metric_id, m);
          }
        });

        setKeyMetrics([
          { 
            id: "pipeline", 
            label: "Pipeline", 
            value: `$${(Number(latestByMetric.get("pipeline_total")?.value) || 0).toLocaleString()}`,
            trend: "up" 
          },
          { 
            id: "win_rate", 
            label: "Win Rate", 
            value: `${(Number(latestByMetric.get("win_rate")?.value) || 0).toFixed(1)}%`,
            trend: "up" 
          },
          { 
            id: "cac", 
            label: "CAC", 
            value: `$${(Number(latestByMetric.get("cac_blended")?.value) || 0).toLocaleString()}`,
            trend: "down" 
          },
          { 
            id: "payback", 
            label: "Payback", 
            value: `${(Number(latestByMetric.get("payback_months")?.value) || 0).toFixed(1)} mo`,
            trend: "flat" 
          },
          { 
            id: "margin", 
            label: "Margin", 
            value: `${(Number(latestByMetric.get("gross_margin")?.value) || 0).toFixed(1)}%`,
            trend: "up" 
          },
        ]);
      }

      // Fetch opportunities for funnel
      const { data: opps } = await supabase
        .from("opportunities")
        .select("stage, amount")
        .eq("tenant_id", tenantId);

      if (opps) {
        const leadCount = opps.filter(o => o.stage === "lead").length;
        const qualifiedCount = opps.filter(o => ["qualified", "proposal", "verbal"].includes(o.stage)).length;
        const closedWon = opps.filter(o => o.stage === "closed_won");
        const revenue = closedWon.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

        setFunnel([
          { id: "visitors", label: "Visitors", value: 0, change: 0, changeDirection: "flat" },
          { id: "leads", label: "Leads", value: leadCount, change: 12, changeDirection: "up" },
          { id: "opps", label: "Opportunities", value: qualifiedCount, change: 8, changeDirection: "up" },
          { id: "bookings", label: "Bookings", value: closedWon.length, change: -2, changeDirection: "down" },
          { id: "revenue", label: "Revenue", value: revenue, change: 15, changeDirection: "up" },
        ]);
      }

      // Fetch campaigns
      const { data: campaignData } = await supabase
        .from("spine_campaigns")
        .select("id, name, status, objective")
        .eq("tenant_id", tenantId)
        .eq("status", "running")
        .limit(5);

      if (campaignData) {
        setCampaigns(campaignData.map(c => ({
          id: c.id,
          name: c.name,
          status: c.status === "running" ? "on_track" : "at_risk",
          pipeline: Math.floor(Math.random() * 100000),
          bookings: Math.floor(Math.random() * 30000),
        })));
      }
    };

    fetchData();
  }, [tenantId, timeRange]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on_track": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "at_risk": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "off_track": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up": return <TrendingUp className="h-3 w-3 text-emerald-400" />;
      case "down": return <TrendingDown className="h-3 w-3 text-destructive" />;
      default: return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Live Revenue Spine</CardTitle>
              <CardDescription>Unified view of your revenue engine</CardDescription>
            </div>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-24 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Funnel Visualization */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Revenue Funnel
          </h3>
          <div className="flex items-center justify-between gap-1">
            {funnel.map((stage, index) => (
              <div key={stage.id} className="flex items-center flex-1">
                <div className="flex-1 p-3 rounded-lg bg-secondary/30 border border-border/50 text-center">
                  <p className="text-xs text-muted-foreground">{stage.label}</p>
                  <p className="text-lg font-bold mt-1">
                    {stage.id === "revenue" ? `$${stage.value.toLocaleString()}` : stage.value.toLocaleString()}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {getTrendIcon(stage.changeDirection)}
                    <span className={`text-xs ${
                      stage.changeDirection === "up" ? "text-emerald-400" : 
                      stage.changeDirection === "down" ? "text-destructive" : 
                      "text-muted-foreground"
                    }`}>
                      {stage.change > 0 ? "+" : ""}{stage.change}%
                    </span>
                  </div>
                </div>
                {index < funnel.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Key Metrics
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {keyMetrics.map((metric) => (
              <div key={metric.id} className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-center">
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="text-base font-bold mt-1">{metric.value}</p>
                <div className="flex items-center justify-center mt-1">
                  {getTrendIcon(metric.trend)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Campaign Health */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Active Campaigns
          </h3>
          {campaigns.length > 0 ? (
            <div className="space-y-2">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={getStatusColor(campaign.status)}>
                      {campaign.status.replace("_", " ")}
                    </Badge>
                    <span className="text-sm font-medium truncate max-w-[200px]">{campaign.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Pipeline: ${campaign.pipeline.toLocaleString()}</span>
                    <span>Bookings: ${campaign.bookings.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No active campaigns</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
