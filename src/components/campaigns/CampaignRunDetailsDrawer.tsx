import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RefreshCw,
  Play,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
  Mail,
  Phone,
  Share2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface CampaignRun {
  id: string;
  campaign_id: string;
  status: string;
  channel: string | null;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  error_code: string | null;
  attempts: number | null;
  created_at: string;
}

interface JobQueueItem {
  id: string;
  run_id: string;
  job_type: string;
  status: string;
  attempts: number;
  last_error: string | null;
  locked_at: string | null;
  locked_by: string | null;
  scheduled_for: string | null;
  created_at: string;
}

interface ChannelOutboxItem {
  id: string;
  run_id: string | null;
  channel: string;
  provider: string;
  status: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  provider_message_id: string | null;
  error: string | null;
  created_at: string;
}

interface CampaignRunDetailsDrawerProps {
  campaignId: string;
  campaignName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  queued: { color: "bg-yellow-500", icon: Clock, label: "Queued" },
  pending: { color: "bg-yellow-500", icon: Clock, label: "Pending" },
  running: { color: "bg-blue-500", icon: Loader2, label: "Running" },
  locked: { color: "bg-blue-500", icon: Loader2, label: "Locked" },
  completed: { color: "bg-green-500", icon: CheckCircle, label: "Completed" },
  sent: { color: "bg-green-500", icon: CheckCircle, label: "Sent" },
  posted: { color: "bg-green-500", icon: CheckCircle, label: "Posted" },
  called: { color: "bg-green-500", icon: CheckCircle, label: "Called" },
  failed: { color: "bg-red-500", icon: XCircle, label: "Failed" },
  dead: { color: "bg-red-800", icon: XCircle, label: "Dead" },
  partial: { color: "bg-orange-500", icon: AlertCircle, label: "Partial" },
};

const channelIcons: Record<string, React.ElementType> = {
  email: Mail,
  voice: Phone,
  social: Share2,
};

export function CampaignRunDetailsDrawer({
  campaignId,
  campaignName,
  open,
  onOpenChange,
}: CampaignRunDetailsDrawerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [runs, setRuns] = useState<CampaignRun[]>([]);
  const [jobs, setJobs] = useState<JobQueueItem[]>([]);
  const [outbox, setOutbox] = useState<ChannelOutboxItem[]>([]);

  const fetchData = async () => {
    if (!campaignId) return;
    setLoading(true);

    try {
      // Fetch campaign runs
      const { data: runsData, error: runsError } = await supabase
        .from("campaign_runs")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (runsError) throw runsError;
      setRuns((runsData || []) as CampaignRun[]);

      // Get run IDs for related queries
      const runIds = (runsData || []).map((r: any) => r.id);

      if (runIds.length > 0) {
        // Fetch job queue items
        const { data: jobsData, error: jobsError } = await supabase
          .from("job_queue")
          .select("*")
          .in("run_id", runIds)
          .order("created_at", { ascending: false });

        if (jobsError) throw jobsError;
        setJobs((jobsData || []) as JobQueueItem[]);

        // Fetch channel outbox items
        const { data: outboxData, error: outboxError } = await supabase
          .from("channel_outbox")
          .select("*")
          .in("run_id", runIds)
          .order("created_at", { ascending: false })
          .limit(50);

        if (outboxError) throw outboxError;
        setOutbox((outboxData || []) as ChannelOutboxItem[]);
      } else {
        setJobs([]);
        setOutbox([]);
      }
    } catch (error) {
      console.error("Error fetching run details:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch run details",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, campaignId]);

  const handleRetryLaunch = async () => {
    setRetrying(true);
    try {
      const { data, error } = await supabase.rpc("deploy_campaign", {
        p_campaign_id: campaignId,
      });

      const result = data as { success?: boolean; error?: string } | null;

      if (error || !result?.success) {
        throw new Error(result?.error || error?.message || "Deploy failed");
      }

      toast({
        title: "Launch Retried",
        description: "New campaign run created successfully",
      });

      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Retry Failed",
        description: error.message,
      });
    } finally {
      setRetrying(false);
    }
  };

  const handleRunNow = async () => {
    setRunningNow(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-job-queue", {
        body: { campaign_id: campaignId },
      });

      if (error) throw error;

      toast({
        title: "Job Queue Processed",
        description: `Processed ${data?.results?.length || 0} jobs`,
      });

      // Refresh data after a short delay
      setTimeout(fetchData, 1000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Run Failed",
        description: error.message,
      });
    } finally {
      setRunningNow(false);
    }
  };

  const latestRun = runs[0];
  const hasFailedRun = latestRun?.status === "failed" || jobs.some((j) => j.status === "failed" || j.status === "dead");

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "MMM d, HH:mm:ss");
    } catch {
      return dateStr;
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const config = statusConfig[status] || { color: "bg-muted", icon: Clock, label: status };
    const Icon = config.icon;
    return (
      <Badge variant="outline" className="gap-1">
        <span className={`h-2 w-2 rounded-full ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Run Details
            <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </SheetTitle>
          <SheetDescription>{campaignName}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-12rem)] mt-4 pr-4">
          {loading && runs.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No runs yet</p>
              <p className="text-sm">Launch the campaign to see execution details</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Action Buttons */}
              <div className="flex gap-2">
                {hasFailedRun && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRetryLaunch}
                    disabled={retrying}
                  >
                    {retrying ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    Retry Launch
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRunNow}
                  disabled={runningNow}
                >
                  {runningNow ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  Run Now (Admin)
                </Button>
              </div>

              {/* Campaign Runs */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">Campaign Runs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {runs.map((run) => {
                    const ChannelIcon = channelIcons[run.channel || "email"] || Mail;
                    return (
                      <div
                        key={run.id}
                        className="border rounded-lg p-3 space-y-2 bg-muted/30"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                            <StatusBadge status={run.status} />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(run.created_at)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Scheduled:</span>{" "}
                            {formatDate(run.scheduled_for)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Started:</span>{" "}
                            {formatDate(run.started_at)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Completed:</span>{" "}
                            {formatDate(run.completed_at)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Attempts:</span>{" "}
                            {run.attempts ?? 0}
                          </div>
                        </div>
                        {run.error_message && (
                          <div className="bg-destructive/10 text-destructive text-xs p-2 rounded flex items-start gap-1">
                            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>{run.error_message}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Job Queue */}
              {jobs.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">
                      Job Queue ({jobs.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        className="border rounded p-2 space-y-1 text-xs bg-muted/20"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {job.job_type}
                            </Badge>
                            <StatusBadge status={job.status} />
                          </div>
                          <span className="text-muted-foreground">
                            Attempts: {job.attempts}
                          </span>
                        </div>
                        {job.last_error && (
                          <div className="bg-destructive/10 text-destructive p-1.5 rounded flex items-start gap-1">
                            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="break-all">{job.last_error}</span>
                          </div>
                        )}
                        {job.locked_by && (
                          <div className="text-muted-foreground">
                            Locked by: {job.locked_by}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Channel Outbox */}
              {outbox.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">
                      Channel Outbox ({outbox.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {outbox.slice(0, 20).map((item) => {
                      const ChannelIcon = channelIcons[item.channel] || Mail;
                      return (
                        <div
                          key={item.id}
                          className="border rounded p-2 space-y-1 text-xs bg-muted/20"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ChannelIcon className="h-3 w-3 text-muted-foreground" />
                              <Badge variant="outline" className="text-xs">
                                {item.provider}
                              </Badge>
                              <StatusBadge status={item.status} />
                            </div>
                            <span className="text-muted-foreground">
                              {formatDate(item.created_at)}
                            </span>
                          </div>
                          <div className="text-muted-foreground">
                            {item.recipient_email || item.recipient_phone || "—"}
                          </div>
                          {item.provider_message_id && (
                            <div className="text-muted-foreground truncate">
                              ID: {item.provider_message_id}
                            </div>
                          )}
                          {item.error && (
                            <div className="bg-destructive/10 text-destructive p-1.5 rounded flex items-start gap-1">
                              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                              <span className="break-all">{item.error}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {outbox.length > 20 && (
                      <p className="text-xs text-muted-foreground text-center">
                        + {outbox.length - 20} more items
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
