import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { DataModeBanner, SampleDataToggle } from "@/components/DemoModeToggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  Calendar, 
  Zap, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  BarChart3,
  Mail,
  Share2,
  Users,
  Target
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface AutomationJob {
  id: string;
  job_type: string;
  status: string;
  scheduled_at: string;
  completed_at: string | null;
  result: unknown;
}

interface ContentItem {
  id: string;
  title: string;
  content_type: string;
  channel: string | null;
  status: string;
  scheduled_at: string;
  published_at: string | null;
}

interface OSStats {
  totalAutomations: number;
  completedAutomations: number;
  scheduledContent: number;
  publishedContent: number;
  contentPublishedToday: number;
  leadsNurturedToday: number;
}

export default function OSDashboard() {
  const navigate = useNavigate();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [automationJobs, setAutomationJobs] = useState<AutomationJob[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [stats, setStats] = useState<OSStats>({
    totalAutomations: 0,
    completedAutomations: 0,
    scheduledContent: 0,
    publishedContent: 0,
    contentPublishedToday: 0,
    leadsNurturedToday: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUbiGrowthWorkspace = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try to find UbiGrowth workspace or user's first workspace
      const { data: workspaces } = await supabase
        .from("workspaces")
        .select("id, name, slug")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true });

      if (workspaces && workspaces.length > 0) {
        const ubigrowth = workspaces.find(w => w.slug === "ubigrowth") || workspaces[0];
        setWorkspaceId(ubigrowth.id);
      }
    };

    fetchUbiGrowthWorkspace();
  }, []);

  useEffect(() => {
    if (!workspaceId) return;

    const fetchData = async () => {
      setLoading(true);
      const today = new Date();
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();
      const last7Days = subDays(today, 7).toISOString();

      // Fetch automation jobs
      const { data: jobs } = await supabase
        .from("automation_jobs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .gte("scheduled_at", last7Days)
        .order("scheduled_at", { ascending: false })
        .limit(50);

      // Fetch content calendar
      const { data: content } = await supabase
        .from("content_calendar")
        .select("*")
        .eq("workspace_id", workspaceId)
        .gte("scheduled_at", last7Days)
        .order("scheduled_at", { ascending: false })
        .limit(50);

      if (jobs) setAutomationJobs(jobs);
      if (content) setContentItems(content);

      // Calculate stats
      const completedJobs = jobs?.filter(j => j.status === "completed") || [];
      const publishedContent = content?.filter(c => c.status === "published") || [];
      const publishedToday = content?.filter(c => 
        c.published_at && c.published_at >= todayStart && c.published_at <= todayEnd
      ) || [];

      // Count leads nurtured from automation results
      const leadsNurtured = completedJobs
        .filter(j => j.job_type === "lead_nurturing" && j.completed_at && j.completed_at >= todayStart)
        .reduce((acc, j) => {
          const result = j.result as Record<string, unknown> | null;
          return acc + (typeof result?.leadsProcessed === 'number' ? result.leadsProcessed : 0);
        }, 0);

      setStats({
        totalAutomations: jobs?.length || 0,
        completedAutomations: completedJobs.length,
        scheduledContent: content?.filter(c => c.status === "scheduled").length || 0,
        publishedContent: publishedContent.length,
        contentPublishedToday: publishedToday.length,
        leadsNurturedToday: leadsNurtured,
      });

      setLoading(false);
    };

    fetchData();

    // Set up real-time subscription
    const channel = supabase
      .channel("os-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "automation_jobs", filter: `workspace_id=eq.${workspaceId}` },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "content_calendar", filter: `workspace_id=eq.${workspaceId}` },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "published":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "running":
      case "scheduled":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "failed":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getChannelIcon = (channel: string | null) => {
    switch (channel) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "linkedin":
      case "twitter":
      case "instagram":
        return <Share2 className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <main className="flex-1 container py-6 sm:py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Zap className="h-8 w-8 text-primary" />
                UbiGrowth OS
              </h1>
              <p className="text-muted-foreground mt-2">
                Unified marketing operations dashboard — watch your AI engine work
              </p>
            </div>
            <div className="flex w-full flex-col sm:w-auto sm:flex-row gap-2">
              <Button variant="outline" onClick={() => navigate("/automation")} className="w-full sm:w-auto">
                <Calendar className="h-4 w-4 mr-2" />
                Content Calendar
              </Button>
              <Button onClick={() => navigate("/crm")} className="w-full sm:w-auto">
                <Users className="h-4 w-4 mr-2" />
                CRM
              </Button>
            </div>
          </div>

          {/* Data Mode Banner */}
          {workspaceId && (
            <DataModeBanner 
              workspaceId={workspaceId}
              onConnectStripe={() => navigate("/settings/integrations")}
              onConnectAnalytics={() => navigate("/settings/integrations")}
            />
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Card className="border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Activity className="h-4 w-4" />
                  <span className="text-xs">Total Automations</span>
                </div>
                <p className="text-2xl font-bold">{stats.totalAutomations}</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs">Completed</span>
                </div>
                <p className="text-2xl font-bold text-emerald-500">{stats.completedAutomations}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">Scheduled Content</span>
                </div>
                <p className="text-2xl font-bold">{stats.scheduledContent}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Share2 className="h-4 w-4" />
                  <span className="text-xs">Published</span>
                </div>
                <p className="text-2xl font-bold">{stats.publishedContent}</p>
              </CardContent>
            </Card>
            <Card className="border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span className="text-xs">Published Today</span>
                </div>
                <p className="text-2xl font-bold text-blue-500">{stats.contentPublishedToday}</p>
              </CardContent>
            </Card>
            <Card className="border-purple-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Target className="h-4 w-4 text-purple-500" />
                  <span className="text-xs">Leads Nurtured</span>
                </div>
                <p className="text-2xl font-bold text-purple-500">{stats.leadsNurturedToday}</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="activity" className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="activity" className="flex-shrink-0">
                <Activity className="h-4 w-4 mr-2" />
                Live Activity
              </TabsTrigger>
              <TabsTrigger value="content" className="flex-shrink-0">
                <Calendar className="h-4 w-4 mr-2" />
                Content Pipeline
              </TabsTrigger>
              <TabsTrigger value="automations" className="flex-shrink-0">
                <Zap className="h-4 w-4 mr-2" />
                Automation Jobs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Live Activity Feed
                  </CardTitle>
                  <CardDescription>
                    Real-time view of all marketing operations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[...automationJobs, ...contentItems]
                        .sort((a, b) => {
                          const dateA = 'completed_at' in a ? a.completed_at || a.scheduled_at : a.published_at || a.scheduled_at;
                          const dateB = 'completed_at' in b ? b.completed_at || b.scheduled_at : b.published_at || b.scheduled_at;
                          return new Date(dateB).getTime() - new Date(dateA).getTime();
                        })
                        .slice(0, 15)
                        .map((item) => {
                          const isJob = 'job_type' in item;
                          return (
                            <div
                              key={item.id}
                              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${isJob ? 'bg-primary/10' : 'bg-blue-500/10'}`}>
                                  {isJob ? (
                                    <Zap className="h-4 w-4 text-primary" />
                                  ) : (
                                    getChannelIcon((item as ContentItem).channel)
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">
                                    {isJob 
                                      ? (item as AutomationJob).job_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                                      : (item as ContentItem).title
                                    }
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(item.scheduled_at), "MMM d, h:mm a")}
                                  </p>
                                </div>
                              </div>
                              <Badge variant="outline" className={`w-fit ${getStatusColor(item.status)}`}>
                                {item.status}
                              </Badge>
                            </div>
                          );
                        })}
                      {automationJobs.length === 0 && contentItems.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                          <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No activity yet. Schedule content or run automations to see activity here.</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="content">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    Content Pipeline
                  </CardTitle>
                  <CardDescription>
                    Scheduled and published content across all channels
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : contentItems.length > 0 ? (
                    <div className="space-y-3">
                      {contentItems.map((content) => (
                        <div
                          key={content.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-blue-500/10">
                              {getChannelIcon(content.channel)}
                            </div>
                            <div>
                              <p className="font-medium">{content.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {content.channel || content.content_type} • {format(new Date(content.scheduled_at), "MMM d, h:mm a")}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className={getStatusColor(content.status)}>
                            {content.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No content scheduled. Go to the Content Calendar to schedule posts.</p>
                      <Button variant="outline" className="mt-4" onClick={() => navigate("/automation")}>
                        Open Content Calendar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="automations">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Automation Jobs
                  </CardTitle>
                  <CardDescription>
                    Daily automation runs and their results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : automationJobs.length > 0 ? (
                    <div className="space-y-3">
                      {automationJobs.map((job) => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${
                              job.status === 'completed' ? 'bg-emerald-500/10' :
                              job.status === 'failed' ? 'bg-red-500/10' : 'bg-primary/10'
                            }`}>
                              {job.status === 'completed' ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : job.status === 'failed' ? (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              ) : (
                                <Zap className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">
                                {job.job_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(job.scheduled_at), "MMM d, h:mm a")}
                                {job.completed_at && ` • Completed ${format(new Date(job.completed_at), "h:mm a")}`}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className={getStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No automation jobs yet. Daily automation runs at 6:00 AM UTC.</p>
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
