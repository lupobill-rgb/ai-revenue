import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Zap, Play, Clock, CheckCircle2, XCircle, AlertCircle, 
  RefreshCw, Calendar, Mail, BarChart3, Users, Database 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Json } from "@/integrations/supabase/types";
import { SAMPLE_AUTOMATION_JOBS } from "@/lib/sampleData";

interface AutomationJob {
  id: string;
  job_type: string;
  status: string;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  result: Json;
  error_message: string | null;
}

interface AutomationDashboardProps {
  workspaceId: string;
}

const jobTypeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  daily_automation: { label: "Daily Automation", icon: <Zap className="h-4 w-4" /> },
  content_publish: { label: "Content Publish", icon: <Calendar className="h-4 w-4" /> },
  lead_nurture: { label: "Lead Nurturing", icon: <Mail className="h-4 w-4" /> },
  performance_sync: { label: "Metrics Sync", icon: <BarChart3 className="h-4 w-4" /> },
  campaign_optimization: { label: "Campaign Optimization", icon: <Users className="h-4 w-4" /> },
};

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  pending: { color: "bg-yellow-500/20 text-yellow-400", icon: <Clock className="h-3 w-3" /> },
  running: { color: "bg-blue-500/20 text-blue-400", icon: <RefreshCw className="h-3 w-3 animate-spin" /> },
  completed: { color: "bg-green-500/20 text-green-400", icon: <CheckCircle2 className="h-3 w-3" /> },
  completed_with_errors: { color: "bg-orange-500/20 text-orange-400", icon: <AlertCircle className="h-3 w-3" /> },
  failed: { color: "bg-red-500/20 text-red-400", icon: <XCircle className="h-3 w-3" /> },
};

export default function AutomationDashboard({ workspaceId }: AutomationDashboardProps) {
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showSampleData, setShowSampleData] = useState(true);
  const [stats, setStats] = useState({
    totalJobs: 0,
    completedToday: 0,
    failedToday: 0,
    contentPublished: 0,
    leadsNurtured: 0,
  });

  useEffect(() => {
    if (showSampleData) {
      setJobs(SAMPLE_AUTOMATION_JOBS as AutomationJob[]);
      calculateStats(SAMPLE_AUTOMATION_JOBS as AutomationJob[]);
      setLoading(false);
    } else {
      fetchJobs();
    }
  }, [workspaceId, showSampleData]);

  useEffect(() => {
    if (!showSampleData) {
      const interval = setInterval(fetchJobs, 30000);
      return () => clearInterval(interval);
    }
  }, [workspaceId, showSampleData]);

  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from("automation_jobs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("scheduled_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Failed to fetch jobs:", error);
    } else {
      setJobs((data as AutomationJob[]) || []);
      calculateStats((data as AutomationJob[]) || []);
    }
    setLoading(false);
  };

  const calculateStats = (jobData: AutomationJob[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayJobs = jobData.filter(j => new Date(j.scheduled_at) >= today);
    
    let contentPublished = 0;
    let leadsNurtured = 0;

    todayJobs.forEach(job => {
      const result = job.result as Record<string, number> | null;
      if (result?.contentPublished) contentPublished += result.contentPublished;
      if (result?.leadsNurtured) leadsNurtured += result.leadsNurtured;
    });

    setStats({
      totalJobs: jobData.length,
      completedToday: todayJobs.filter(j => j.status === "completed").length,
      failedToday: todayJobs.filter(j => j.status === "failed").length,
      contentPublished,
      leadsNurtured,
    });
  };

  const triggerDailyAutomation = async () => {
    setRunning(true);
    try {
      // Use trigger-user-automation (RLS enforced) instead of daily-automation (service-role)
      const { error } = await supabase.functions.invoke("trigger-user-automation", {
        body: { workspaceId }
      });
      
      if (error) throw error;
      toast.success("Automation triggered successfully!");
      fetchJobs();
    } catch (e) {
      toast.error("Failed to trigger automation");
      console.error(e);
    }
    setRunning(false);
  };

  const getJobInfo = (type: string) => jobTypeLabels[type] || { label: type, icon: <Zap className="h-4 w-4" /> };
  const getStatusInfo = (status: string) => statusConfig[status] || statusConfig.pending;

  return (
    <div className="space-y-6">
      {/* Sample Data Toggle */}
      <div className="flex items-center justify-end gap-3 bg-muted/50 px-4 py-2 rounded-lg border border-border w-fit ml-auto">
        <Database className="h-4 w-4 text-muted-foreground" />
        <Label htmlFor="sample-data-automation" className="text-sm font-medium cursor-pointer">
          Demo Data
        </Label>
        <Switch
          id="sample-data-automation"
          checked={showSampleData}
          onCheckedChange={setShowSampleData}
        />
      </div>

      {showSampleData && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary flex items-center gap-2">
          <Database className="h-4 w-4" />
          Showing sample demo data. Toggle off to view real automation jobs.
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.totalJobs}</div>
            <p className="text-xs text-muted-foreground">Total Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{stats.completedToday}</div>
            <p className="text-xs text-muted-foreground">Completed Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-500">{stats.failedToday}</div>
            <p className="text-xs text-muted-foreground">Failed Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-500">{stats.contentPublished}</div>
            <p className="text-xs text-muted-foreground">Content Published</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-500">{stats.leadsNurtured}</div>
            <p className="text-xs text-muted-foreground">Leads Nurtured</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Panel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Daily Automation Engine
            </CardTitle>
            <CardDescription>
              Automated workflows for content publishing, campaign optimization, and lead nurturing
            </CardDescription>
          </div>
          <Button onClick={triggerDailyAutomation} disabled={running}>
            {running ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Now
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No automation jobs yet for this workspace</p>
                <Button variant="outline" className="mt-4" onClick={triggerDailyAutomation}>
                  Run First Automation
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => {
                  const jobInfo = getJobInfo(job.job_type);
                  const statusInfo = getStatusInfo(job.status);
                  const result = job.result as Record<string, unknown> | null;

                  return (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {jobInfo.icon}
                        </div>
                        <div>
                          <h4 className="font-medium">{jobInfo.label}</h4>
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(job.scheduled_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {result && Object.keys(result).length > 0 && (
                          <div className="text-xs text-muted-foreground hidden md:block">
                            {result.contentPublished && <span className="mr-2">📤 {String(result.contentPublished)}</span>}
                            {result.leadsNurtured && <span className="mr-2">👥 {String(result.leadsNurtured)}</span>}
                            {result.campaignsOptimized && <span>⚡ {String(result.campaignsOptimized)}</span>}
                          </div>
                        )}
                        <Badge variant="outline" className={statusInfo.color}>
                          <span className="mr-1">{statusInfo.icon}</span>
                          {job.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
