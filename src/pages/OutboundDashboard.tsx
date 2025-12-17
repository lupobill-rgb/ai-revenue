import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar, 
  MessageSquare, 
  TrendingUp, 
  Users, 
  Mail, 
  Linkedin,
  Target,
  ArrowUpRight,
  Flame,
  BarChart3
} from "lucide-react";

interface CampaignMetrics {
  id: string;
  name: string;
  channel: string;
  sent: number;
  delivered: number;
  opened: number;
  replied: number;
  booked: number;
  replyRate: number;
  bookRate: number;
}

interface SequenceStep {
  step_order: number;
  step_type: string;
  sent: number;
  replied: number;
  booked: number;
}

interface HotProspect {
  id: string;
  first_name: string;
  last_name: string;
  company: string;
  title: string;
  score: number;
  band: string;
  latest_event?: string;
  latest_event_at?: string;
}

interface OverviewStats {
  bookings7d: number;
  bookings30d: number;
  replyRate7d: number;
  replyRate30d: number;
  sent7d: number;
  sent30d: number;
  bestCampaign?: string;
}

interface ChannelStats {
  email: { sent: number; replied: number; booked: number };
  linkedin: { sent: number; replied: number; booked: number };
}

export default function OutboundDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewStats>({
    bookings7d: 0,
    bookings30d: 0,
    replyRate7d: 0,
    replyRate30d: 0,
    sent7d: 0,
    sent30d: 0,
  });
  const [campaigns, setCampaigns] = useState<CampaignMetrics[]>([]);
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>([]);
  const [hotProspects, setHotProspects] = useState<HotProspect[]>([]);
  const [channelStats, setChannelStats] = useState<ChannelStats>({
    email: { sent: 0, replied: 0, booked: 0 },
    linkedin: { sent: 0, replied: 0, booked: 0 },
  });

  useEffect(() => {
    fetchWorkspace();
  }, []);

  useEffect(() => {
    if (workspaceId) {
      fetchAnalytics();
    }
  }, [workspaceId]);

  const fetchWorkspace = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Use tenant_id (user.id) for tenant isolation
    setWorkspaceId(user.id);
  };

  const fetchAnalytics = async () => {
    if (!workspaceId) return;
    setLoading(true);

    try {
      const now = new Date();
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Use tenant_id for all queries (workspaceId is actually user.id/tenant_id)
      const tenantId = workspaceId;

      // Fetch all message events for this tenant
      const { data: events } = await supabase
        .from("outbound_message_events")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("occurred_at", d30);

      // Fetch campaigns for this tenant
      const { data: campaignsData } = await supabase
        .from("outbound_campaigns")
        .select("id, name, channel, status")
        .eq("tenant_id", tenantId);

      // Fetch sequences for this tenant
      const { data: sequences } = await supabase
        .from("outbound_sequences")
        .select("id, campaign_id, channel")
        .eq("tenant_id", tenantId);

      // Fetch sequence runs for this tenant
      const { data: runs } = await supabase
        .from("outbound_sequence_runs")
        .select("id, sequence_id, prospect_id, status, last_step_sent")
        .eq("tenant_id", tenantId);

      // Fetch hot prospects with scores for this tenant
      const { data: scores } = await supabase
        .from("prospect_scores")
        .select("prospect_id, score, band, last_scored_at")
        .eq("tenant_id", tenantId)
        .gte("score", 60)
        .order("score", { ascending: false })
        .limit(20);

      // Fetch prospect details
      const prospectIds = scores?.map(s => s.prospect_id) || [];
      const { data: prospects } = await supabase
        .from("prospects")
        .select("id, first_name, last_name, company, title")
        .in("id", prospectIds.length > 0 ? prospectIds : ["00000000-0000-0000-0000-000000000000"]);

      // Calculate overview stats
      const events7d = events?.filter(e => new Date(e.occurred_at) >= new Date(d7)) || [];
      const sent7d = events7d.filter(e => e.event_type === "sent").length;
      const sent30d = events?.filter(e => e.event_type === "sent").length || 0;
      const replied7d = events7d.filter(e => e.event_type === "replied").length;
      const replied30d = events?.filter(e => e.event_type === "replied").length || 0;
      const bookings7d = events7d.filter(e => e.event_type === "booked").length;
      const bookings30d = events?.filter(e => e.event_type === "booked").length || 0;

      // Calculate channel-specific stats
      const emailEvents = events?.filter(e => e.channel === "email") || [];
      const linkedinEvents = events?.filter(e => e.channel === "linkedin") || [];
      
      setChannelStats({
        email: {
          sent: emailEvents.filter(e => e.event_type === "sent").length,
          replied: emailEvents.filter(e => e.event_type === "replied").length,
          booked: emailEvents.filter(e => e.event_type === "booked").length,
        },
        linkedin: {
          sent: linkedinEvents.filter(e => e.event_type === "sent").length,
          replied: linkedinEvents.filter(e => e.event_type === "replied").length,
          booked: linkedinEvents.filter(e => e.event_type === "booked").length,
        },
      });

      // Find best campaign by reply rate
      const campaignWithStats = (campaignsData || []).map(campaign => {
        const campaignSequences = sequences?.filter(s => s.campaign_id === campaign.id) || [];
        const campaignRunIds = runs
          ?.filter(r => campaignSequences.some(s => s.id === r.sequence_id))
          .map(r => r.id) || [];
        const campaignEvents = events?.filter(e => campaignRunIds.includes(e.sequence_run_id)) || [];
        const sent = campaignEvents.filter(e => e.event_type === "sent").length;
        const replied = campaignEvents.filter(e => e.event_type === "replied").length;
        return { ...campaign, replyRate: sent > 0 ? replied / sent : 0 };
      });
      const bestCampaign = campaignWithStats.sort((a, b) => b.replyRate - a.replyRate)[0];

      setOverview({
        bookings7d,
        bookings30d,
        replyRate7d: sent7d > 0 ? Math.round((replied7d / sent7d) * 100) : 0,
        replyRate30d: sent30d > 0 ? Math.round((replied30d / sent30d) * 100) : 0,
        sent7d,
        sent30d,
        bestCampaign: bestCampaign?.name,
      });

      // Calculate campaign metrics
      const campaignMetrics: CampaignMetrics[] = (campaignsData || []).map(campaign => {
        const campaignSequences = sequences?.filter(s => s.campaign_id === campaign.id) || [];
        const campaignRunIds = runs
          ?.filter(r => campaignSequences.some(s => s.id === r.sequence_id))
          .map(r => r.id) || [];
        
        const campaignEvents = events?.filter(e => campaignRunIds.includes(e.sequence_run_id)) || [];
        const sent = campaignEvents.filter(e => e.event_type === "sent").length;
        const delivered = campaignEvents.filter(e => e.event_type === "delivered").length;
        const opened = campaignEvents.filter(e => e.event_type === "opened").length;
        const replied = campaignEvents.filter(e => e.event_type === "replied").length;
        const booked = campaignEvents.filter(e => e.event_type === "booked").length;

        return {
          id: campaign.id,
          name: campaign.name,
          channel: campaign.channel,
          sent,
          delivered,
          opened,
          replied,
          booked,
          replyRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
          bookRate: sent > 0 ? Math.round((booked / sent) * 100) : 0,
        };
      });

      setCampaigns(campaignMetrics);

      // Calculate sequence funnel (aggregate across all sequences)
      const stepTypes = ["connect", "follow_up", "bump", "nudge", "booking"];
      const stepMetrics: SequenceStep[] = stepTypes.map((type, idx) => {
        const stepEvents = events?.filter(e => {
          const metadata = e.metadata as Record<string, unknown> | null;
          return metadata?.step_type === type;
        }) || [];
        return {
          step_order: idx + 1,
          step_type: type,
          sent: stepEvents.filter(e => e.event_type === "sent" || e.event_type === "queued").length,
          replied: stepEvents.filter(e => e.event_type === "replied").length,
          booked: stepEvents.filter(e => e.event_type === "booked").length,
        };
      });
      setSequenceSteps(stepMetrics);

      // Build hot prospects list
      const hotList: HotProspect[] = (scores || []).map(score => {
        const prospect = prospects?.find(p => p.id === score.prospect_id);
        const prospectEvents = events?.filter(e => {
          const run = runs?.find(r => r.id === e.sequence_run_id);
          return run !== undefined;
        });
        const latestEvent = prospectEvents?.sort((a, b) => 
          new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
        )[0];

        return {
          id: score.prospect_id,
          first_name: prospect?.first_name || "Unknown",
          last_name: prospect?.last_name || "",
          company: prospect?.company || "",
          title: prospect?.title || "",
          score: score.score,
          band: score.band || "warm",
          latest_event: latestEvent?.event_type,
          latest_event_at: latestEvent?.occurred_at,
        };
      });
      setHotProspects(hotList);

    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "linkedin": return <Linkedin className="h-4 w-4" />;
      case "email": return <Mail className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getBandColor = (band: string) => {
    switch (band) {
      case "hot": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "warm": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default: return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Outbound OS</h1>
              <p className="text-muted-foreground">Analytics & Performance Dashboard</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/outbound/prospects")}>
                <Users className="h-4 w-4 mr-2" />
                Prospects
              </Button>
              <Button onClick={() => navigate("/outbound/campaigns")}>
                <Target className="h-4 w-4 mr-2" />
                Campaigns
              </Button>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
              <TabsTrigger value="sequences">Sequence Funnel</TabsTrigger>
              <TabsTrigger value="prospects">Hot Prospects</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Meetings Booked</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{overview.bookings7d}</div>
                        <p className="text-xs text-muted-foreground">
                          Last 7 days • {overview.bookings30d} in 30d
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{overview.replyRate7d}%</div>
                        <p className="text-xs text-muted-foreground">
                          Last 7 days • {overview.replyRate30d}% in 30d
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{overview.sent7d}</div>
                        <p className="text-xs text-muted-foreground">
                          Last 7 days • {overview.sent30d} in 30d
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Best Campaign</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-bold truncate">
                          {overview.bestCampaign || "No campaigns yet"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Highest reply rate
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Channel Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email Channel
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-bold">{channelStats.email.sent}</div>
                            <p className="text-xs text-muted-foreground">Sent</p>
                          </div>
                          <div>
                            <div className="text-2xl font-bold">{channelStats.email.replied}</div>
                            <p className="text-xs text-muted-foreground">Replied</p>
                          </div>
                          <div>
                            <div className="text-2xl font-bold">{channelStats.email.booked}</div>
                            <p className="text-xs text-muted-foreground">Booked</p>
                          </div>
                        </div>
                        {channelStats.email.sent > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Reply Rate</span>
                              <span className="font-medium">
                                {Math.round((channelStats.email.replied / channelStats.email.sent) * 100)}%
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Linkedin className="h-4 w-4" />
                          LinkedIn Channel
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-bold">{channelStats.linkedin.sent}</div>
                            <p className="text-xs text-muted-foreground">Sent</p>
                          </div>
                          <div>
                            <div className="text-2xl font-bold">{channelStats.linkedin.replied}</div>
                            <p className="text-xs text-muted-foreground">Replied</p>
                          </div>
                          <div>
                            <div className="text-2xl font-bold">{channelStats.linkedin.booked}</div>
                            <p className="text-xs text-muted-foreground">Booked</p>
                          </div>
                        </div>
                        {channelStats.linkedin.sent > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Reply Rate</span>
                              <span className="font-medium">
                                {Math.round((channelStats.linkedin.replied / channelStats.linkedin.sent) * 100)}%
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Quick Actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="flex gap-4 flex-wrap">
                      <Button variant="outline" onClick={() => navigate("/outbound/campaigns/new")}>
                        Create Campaign
                      </Button>
                      <Button variant="outline" onClick={() => navigate("/outbound/prospects/import")}>
                        Import Prospects
                      </Button>
                      <Button variant="outline" onClick={() => navigate("/outbound/linkedin-queue")}>
                        LinkedIn Queue
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Campaigns Tab */}
            <TabsContent value="campaigns" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-64" />
                  ) : campaigns.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No campaigns yet</p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => navigate("/outbound/campaigns/new")}
                      >
                        Create Your First Campaign
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4">Campaign</th>
                            <th className="text-left py-3 px-4">Channel</th>
                            <th className="text-right py-3 px-4">Sent</th>
                            <th className="text-right py-3 px-4">Opened</th>
                            <th className="text-right py-3 px-4">Replied</th>
                            <th className="text-right py-3 px-4">Booked</th>
                            <th className="text-right py-3 px-4">Reply %</th>
                            <th className="text-right py-3 px-4">Book %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaigns.map(campaign => (
                            <tr key={campaign.id} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-4 font-medium">{campaign.name}</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  {getChannelIcon(campaign.channel)}
                                  <span className="capitalize">{campaign.channel}</span>
                                </div>
                              </td>
                              <td className="text-right py-3 px-4">{campaign.sent}</td>
                              <td className="text-right py-3 px-4">{campaign.opened}</td>
                              <td className="text-right py-3 px-4">{campaign.replied}</td>
                              <td className="text-right py-3 px-4">{campaign.booked}</td>
                              <td className="text-right py-3 px-4">
                                <Badge variant={campaign.replyRate >= 20 ? "default" : "secondary"}>
                                  {campaign.replyRate}%
                                </Badge>
                              </td>
                              <td className="text-right py-3 px-4">
                                <Badge variant={campaign.bookRate >= 5 ? "default" : "secondary"}>
                                  {campaign.bookRate}%
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Sequence Funnel Tab */}
            <TabsContent value="sequences" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sequence Performance Funnel</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-64" />
                  ) : (
                    <div className="space-y-4">
                      {sequenceSteps.map((step, idx) => {
                        const maxSent = Math.max(...sequenceSteps.map(s => s.sent), 1);
                        const width = (step.sent / maxSent) * 100;
                        
                        return (
                          <div key={step.step_type} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                                  {idx + 1}
                                </span>
                                <span className="font-medium capitalize">{step.step_type.replace("_", " ")}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>{step.sent} sent</span>
                                <span>{step.replied} replies</span>
                                <span>{step.booked} booked</span>
                              </div>
                            </div>
                            <Progress value={width} className="h-2" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Hot Prospects Tab */}
            <TabsContent value="prospects" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-500" />
                      Today's Top Targets
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => navigate("/outbound/prospects")}>
                      View All
                      <ArrowUpRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-64" />
                  ) : hotProspects.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hot prospects yet</p>
                      <p className="text-sm">Run the Prospect Intelligence agent to score your prospects</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {hotProspects.map((prospect, idx) => (
                        <div 
                          key={prospect.id} 
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                          onClick={() => navigate(`/outbound/prospects/${prospect.id}`)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-medium">
                                {prospect.first_name} {prospect.last_name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {prospect.title} at {prospect.company}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {prospect.latest_event && (
                              <Badge variant="outline" className="text-xs">
                                {prospect.latest_event}
                              </Badge>
                            )}
                            <Badge className={getBandColor(prospect.band)}>
                              {prospect.score}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
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
}
