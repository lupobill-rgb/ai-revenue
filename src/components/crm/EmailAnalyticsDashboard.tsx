import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Mail, Eye, MousePointer, UserX, TrendingUp, TrendingDown, Send, Inbox, MessageSquare } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { subDays, format, parseISO, isAfter } from "date-fns";

interface CampaignMetric {
  id: string;
  campaign_id: string;
  sent_count: number | null;
  delivered_count: number | null;
  open_count: number | null;
  clicks: number | null;
  bounce_count: number | null;
  unsubscribe_count: number | null;
  reply_count: number | null;
  created_at: string;
}

interface EmailAnalyticsDashboardProps {
  metrics: CampaignMetric[];
  canShowMetrics?: boolean;
}

const CHART_COLORS = {
  sent: "hsl(217 91% 60%)",
  delivered: "hsl(142 71% 45%)",
  opened: "hsl(271 91% 65%)",
  clicked: "hsl(38 92% 50%)",
  bounced: "hsl(0 84% 60%)",
  unsubscribed: "hsl(var(--muted-foreground))",
  replied: "hsl(160 84% 39%)",
};

export function EmailAnalyticsDashboard({ metrics, canShowMetrics = true }: EmailAnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<string>("30");
  
  // If providers not connected and not in demo mode, show zeros
  const gatedMetrics = canShowMetrics ? metrics : [];

  const filteredMetrics = useMemo(() => {
    const days = parseInt(dateRange);
    const cutoffDate = subDays(new Date(), days);
    return gatedMetrics.filter((m) => isAfter(parseISO(m.created_at), cutoffDate));
  }, [gatedMetrics, dateRange]);

  // Aggregate stats
  const totals = useMemo(() => {
    return filteredMetrics.reduce(
      (acc, m) => ({
        sent: acc.sent + (m.sent_count || 0),
        delivered: acc.delivered + (m.delivered_count || 0),
        opened: acc.opened + (m.open_count || 0),
        clicked: acc.clicked + (m.clicks || 0),
        bounced: acc.bounced + (m.bounce_count || 0),
        unsubscribed: acc.unsubscribed + (m.unsubscribe_count || 0),
        replied: acc.replied + (m.reply_count || 0),
      }),
      { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, replied: 0 }
    );
  }, [filteredMetrics]);

  const openRate = totals.delivered > 0 ? ((totals.opened / totals.delivered) * 100).toFixed(1) : "0";
  const clickRate = totals.opened > 0 ? ((totals.clicked / totals.opened) * 100).toFixed(1) : "0";
  const bounceRate = totals.sent > 0 ? ((totals.bounced / totals.sent) * 100).toFixed(1) : "0";
  const deliveryRate = totals.sent > 0 ? ((totals.delivered / totals.sent) * 100).toFixed(1) : "0";
  const replyRate = totals.delivered > 0 ? ((totals.replied / totals.delivered) * 100).toFixed(1) : "0";

  // Daily trend data
  const trendData = useMemo(() => {
    const days = parseInt(dateRange);
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, "yyyy-MM-dd");
      const dayMetrics = filteredMetrics.filter(
        (m) => format(parseISO(m.created_at), "yyyy-MM-dd") === dateStr
      );
      data.push({
        date: format(date, "MMM d"),
        sent: dayMetrics.reduce((acc, m) => acc + (m.sent_count || 0), 0),
        opened: dayMetrics.reduce((acc, m) => acc + (m.open_count || 0), 0),
        clicked: dayMetrics.reduce((acc, m) => acc + (m.clicks || 0), 0),
      });
    }
    return data;
  }, [filteredMetrics, dateRange]);

  // Funnel data for pie chart
  const funnelData = [
    { name: "Opened", value: totals.opened, color: CHART_COLORS.opened },
    { name: "Clicked", value: totals.clicked, color: CHART_COLORS.clicked },
    { name: "Bounced", value: totals.bounced, color: CHART_COLORS.bounced },
    { name: "Not Opened", value: Math.max(0, totals.delivered - totals.opened), color: "hsl(var(--muted))" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Email Analytics</h2>
          <p className="text-muted-foreground">Track your email campaign performance</p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[140px] bg-card">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full -mr-8 -mt-8" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Emails Sent</CardTitle>
            <Send className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.sent.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {deliveryRate}% delivered
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-full -mr-8 -mt-8" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{openRate}%</div>
            <Progress value={parseFloat(openRate)} className="h-1.5 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {totals.opened.toLocaleString()} opens
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full -mr-8 -mt-8" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Click Rate</CardTitle>
            <MousePointer className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{clickRate}%</div>
            <Progress value={parseFloat(clickRate)} className="h-1.5 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {totals.clicked.toLocaleString()} clicks
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-full -mr-8 -mt-8" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bounce Rate</CardTitle>
            <UserX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{bounceRate}%</div>
            <Progress value={parseFloat(bounceRate)} className="h-1.5 mt-2 [&>div]:bg-red-500" />
            <p className="text-xs text-muted-foreground mt-1">
              {totals.bounced.toLocaleString()} bounces
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full -mr-8 -mt-8" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reply Rate</CardTitle>
            <MessageSquare className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{replyRate}%</div>
            <Progress value={parseFloat(replyRate)} className="h-1.5 mt-2 [&>div]:bg-emerald-500" />
            <p className="text-xs text-muted-foreground mt-1">
              {totals.replied.toLocaleString()} replies
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Email Performance Trend
            </CardTitle>
            <CardDescription>Daily email activity over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="sentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.sent} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.sent} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="openedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.opened} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.opened} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sent"
                    stroke={CHART_COLORS.sent}
                    fill="url(#sentGradient)"
                    strokeWidth={2}
                    name="Sent"
                  />
                  <Area
                    type="monotone"
                    dataKey="opened"
                    stroke={CHART_COLORS.opened}
                    fill="url(#openedGradient)"
                    strokeWidth={2}
                    name="Opened"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Engagement Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Engagement Breakdown
            </CardTitle>
            <CardDescription>How recipients interact with emails</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={funnelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => (
                      <span className="text-sm text-muted-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Metrics</CardTitle>
          <CardDescription>Complete breakdown of email performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Total Sent", value: totals.sent, color: "text-blue-500", icon: Send },
              { label: "Delivered", value: totals.delivered, color: "text-green-500", icon: Inbox },
              { label: "Opened", value: totals.opened, color: "text-purple-500", icon: Eye },
              { label: "Clicked", value: totals.clicked, color: "text-amber-500", icon: MousePointer },
              { label: "Bounced", value: totals.bounced, color: "text-red-500", icon: UserX },
              { label: "Unsubscribed", value: totals.unsubscribed, color: "text-muted-foreground", icon: TrendingDown },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-4 rounded-lg bg-muted/30">
                <stat.icon className={`h-5 w-5 mx-auto ${stat.color} mb-2`} />
                <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
