import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import { Mail, MessageSquare, Phone, Globe, TrendingUp, TrendingDown, Target } from "lucide-react";
import type { CMOCampaign } from "@/lib/cmo/types";

interface CampaignOverviewTabProps {
  campaign: CMOCampaign;
  metrics: {
    sends: number;
    opens: number;
    clicks: number;
    replies: number;
    meetings: number;
  } | null;
}

interface DailyMetric {
  day: string;
  sends: number;
  opens: number;
  clicks: number;
  replies: number;
}

interface ChannelBreakdown {
  channel: string;
  sends: number;
  replies: number;
}

const CHANNEL_COLORS: Record<string, string> = {
  email: "hsl(var(--primary))",
  sms: "hsl(var(--chart-2))",
  voice: "hsl(var(--chart-3))",
  linkedin: "hsl(var(--chart-4))",
  landing_page: "hsl(var(--chart-5))",
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  voice: <Phone className="h-4 w-4" />,
  landing_page: <Globe className="h-4 w-4" />,
};

export default function CampaignOverviewTab({ campaign, metrics }: CampaignOverviewTabProps) {
  const [dailyData, setDailyData] = useState<DailyMetric[]>([]);
  const [channelData, setChannelData] = useState<ChannelBreakdown[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOverviewData = async () => {
      setIsLoading(true);
      try {
        // Fetch daily stats
        const { data: daily } = await supabase
          .from("campaign_channel_stats_daily")
          .select("day, sends, opens, clicks, replies")
          .eq("campaign_id", campaign.id)
          .eq("tenant_id", campaign.tenant_id)
          .order("day", { ascending: true })
          .limit(30);

        if (daily) {
          // Aggregate by day across all channels
          const byDay = daily.reduce<Record<string, DailyMetric>>((acc, row) => {
            const key = row.day;
            if (!acc[key]) {
              acc[key] = { day: key, sends: 0, opens: 0, clicks: 0, replies: 0 };
            }
            acc[key].sends += row.sends || 0;
            acc[key].opens += row.opens || 0;
            acc[key].clicks += row.clicks || 0;
            acc[key].replies += row.replies || 0;
            return acc;
          }, {});
          setDailyData(Object.values(byDay).slice(-14)); // Last 14 days
        }

        // Fetch channel breakdown
        const { data: channels } = await supabase
          .from("campaign_channel_stats_daily")
          .select("channel, sends, replies")
          .eq("campaign_id", campaign.id)
          .eq("tenant_id", campaign.tenant_id);

        if (channels) {
          const byChannel = channels.reduce<Record<string, ChannelBreakdown>>((acc, row) => {
            if (!acc[row.channel]) {
              acc[row.channel] = { channel: row.channel, sends: 0, replies: 0 };
            }
            acc[row.channel].sends += row.sends || 0;
            acc[row.channel].replies += row.replies || 0;
            return acc;
          }, {});
          setChannelData(Object.values(byChannel));
        }
      } catch (err) {
        console.error("Error fetching overview data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOverviewData();
  }, [campaign.id, campaign.tenant_id]);

  const totalSends = metrics?.sends || 0;
  const openRate = totalSends > 0 ? ((metrics?.opens || 0) / totalSends) * 100 : 0;
  const replyRate = totalSends > 0 ? ((metrics?.replies || 0) / totalSends) * 100 : 0;
  const clickRate = totalSends > 0 ? ((metrics?.clicks || 0) / totalSends) * 100 : 0;

  // Pie chart data for channel distribution
  const pieData = channelData.map((ch) => ({
    name: ch.channel,
    value: ch.sends,
    color: CHANNEL_COLORS[ch.channel] || "hsl(var(--muted))",
  }));

  return (
    <div className="space-y-6">
      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Campaign Goal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold capitalize">{campaign.goal || "Not set"}</p>
            {campaign.objective && (
              <p className="text-sm text-muted-foreground mt-1">{campaign.objective}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Reply Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{replyRate.toFixed(1)}%</p>
            <Progress value={replyRate} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.replies || 0} replies from {totalSends} sends
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Meetings Booked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metrics?.meetings || 0}</p>
            <Progress 
              value={totalSends > 0 ? ((metrics?.meetings || 0) / totalSends) * 100 : 0} 
              className="h-2 mt-2" 
            />
            <p className="text-xs text-muted-foreground mt-1">
              {((metrics?.meetings || 0) / Math.max(totalSends, 1) * 100).toFixed(1)}% conversion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Performance Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Performance Trend (14 days)</CardTitle>
            <CardDescription>Opens, clicks, and replies over time</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val) => new Date(val).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))", 
                      border: "1px solid hsl(var(--border))" 
                    }}
                  />
                  <Area type="monotone" dataKey="opens" stackId="1" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="clicks" stackId="2" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="replies" stackId="3" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No data available yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Channel Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Channel Distribution</CardTitle>
            <CardDescription>Sends by channel</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No channel data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Channel Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Channel Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {channelData.length > 0 ? (
              channelData.map((ch) => (
                <div key={ch.channel} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-background rounded">
                      {CHANNEL_ICONS[ch.channel] || <Mail className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium capitalize">{ch.channel}</p>
                      <p className="text-xs text-muted-foreground">{ch.sends} sends</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{ch.replies} replies</p>
                    <p className="text-xs text-muted-foreground">
                      {ch.sends > 0 ? ((ch.replies / ch.sends) * 100).toFixed(1) : 0}% rate
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No channel data available</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
