import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import NavBar from "@/components/NavBar";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import ProspectIntelligenceDrawer from "@/components/outbound/ProspectIntelligenceDrawer";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Play,
  Pause,
  Users,
  Mail,
  Calendar,
  Clock,
  TrendingUp,
  MoreVertical,
  RefreshCw
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Campaign {
  id: string;
  name: string;
  objective: string;
  channel: string;
  status: string;
  target_persona: string;
  config: unknown;
  created_at: string;
}

interface SequenceRun {
  id: string;
  prospect_id: string;
  status: string;
  last_step_sent: number;
  next_step_due_at: string | null;
  started_at: string;
  prospect?: {
    first_name: string;
    last_name: string;
    email: string;
    company: string;
    title: string;
  };
  latest_event?: {
    event_type: string;
    occurred_at: string;
  };
}

interface SequenceStep {
  id: string;
  step_order: number;
  step_type: string;
  delay_days: number;
  message_template: string;
}

export default function OutboundCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sequenceRuns, setSequenceRuns] = useState<SequenceRun[]>([]);
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>([]);
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    enrolled: 0,
    active: 0,
    completed: 0,
    replied: 0,
    booked: 0,
  });

  useEffect(() => {
    if (id) {
      fetchCampaignData();
    }
  }, [id]);

  const fetchCampaignData = async () => {
    setLoading(true);
    try {
      // Fetch campaign
      const { data: campaignData, error: campaignError } = await supabase
        .from("outbound_campaigns")
        .select("*")
        .eq("id", id)
        .single();

      if (campaignError) throw campaignError;
      setCampaign(campaignData);

      // Fetch sequence
      const { data: sequences } = await supabase
        .from("outbound_sequences")
        .select("id")
        .eq("campaign_id", id);

      const sequenceId = sequences?.[0]?.id;

      if (sequenceId) {
        // Fetch sequence steps
        const { data: steps } = await supabase
          .from("outbound_sequence_steps")
          .select("*")
          .eq("sequence_id", sequenceId)
          .order("step_order");

        setSequenceSteps(steps || []);

        // Fetch sequence runs with prospect info
        const { data: runs } = await supabase
          .from("outbound_sequence_runs")
          .select("*")
          .eq("sequence_id", sequenceId)
          .order("started_at", { ascending: false });

        if (runs && runs.length > 0) {
          // Fetch prospect details
          const prospectIds = runs.map(r => r.prospect_id);
          const { data: prospects } = await supabase
            .from("prospects")
            .select("id, first_name, last_name, email, company, title")
            .in("id", prospectIds);

          // Fetch latest events for each run
          const { data: events } = await supabase
            .from("outbound_message_events")
            .select("sequence_run_id, event_type, occurred_at")
            .in("sequence_run_id", runs.map(r => r.id))
            .order("occurred_at", { ascending: false });

          // Combine data
          const enrichedRuns: SequenceRun[] = runs.map(run => ({
            ...run,
            prospect: prospects?.find(p => p.id === run.prospect_id),
            latest_event: events?.find(e => e.sequence_run_id === run.id),
          }));

          setSequenceRuns(enrichedRuns);

          // Calculate stats
          const enrolled = runs.length;
          const active = runs.filter(r => r.status === "active").length;
          const completed = runs.filter(r => r.status === "completed").length;
          const replied = events?.filter(e => e.event_type === "replied").length || 0;
          const booked = events?.filter(e => e.event_type === "booked").length || 0;

          setStats({ enrolled, active, completed, replied, booked });
        }
      }
    } catch (error) {
      console.error("Error fetching campaign:", error);
      toast({
        title: "Error",
        description: "Could not load campaign data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCampaignStatus = async () => {
    if (!campaign) return;

    const newStatus = campaign.status === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("outbound_campaigns")
      .update({ status: newStatus })
      .eq("id", campaign.id);

    if (error) {
      toast({ title: "Error", description: "Could not update campaign", variant: "destructive" });
    } else {
      setCampaign({ ...campaign, status: newStatus });
      toast({ title: "Campaign updated", description: `Campaign is now ${newStatus}` });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      paused: "secondary",
      completed: "outline",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getEventBadge = (eventType: string) => {
    const colors: Record<string, string> = {
      sent: "bg-blue-500/20 text-blue-400",
      delivered: "bg-green-500/20 text-green-400",
      opened: "bg-yellow-500/20 text-yellow-400",
      clicked: "bg-orange-500/20 text-orange-400",
      replied: "bg-purple-500/20 text-purple-400",
      booked: "bg-emerald-500/20 text-emerald-400",
    };
    return (
      <span className={`px-2 py-1 rounded text-xs ${colors[eventType] || "bg-muted"}`}>
        {eventType}
      </span>
    );
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex flex-col">
          <NavBar />
          <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <Skeleton className="h-8 w-64 mb-4" />
            <Skeleton className="h-32 w-full mb-4" />
            <Skeleton className="h-64 w-full" />
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  if (!campaign) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex flex-col">
          <NavBar />
          <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 text-center">
            <p>Campaign not found</p>
            <Button className="mt-4" onClick={() => navigate("/outbound")}>
              Back to Dashboard
            </Button>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <PageBreadcrumbs items={[
          { label: "Outbound", href: "/outbound" },
          { label: campaign?.name || "Campaign" }
        ]} />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{campaign.name}</h1>
                  {getStatusBadge(campaign.status)}
                </div>
                <p className="text-muted-foreground">{campaign.objective}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchCampaignData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant={campaign.status === "active" ? "secondary" : "default"}
                onClick={toggleCampaignStatus}
              >
                {campaign.status === "active" ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Activate
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Users className="h-4 w-4" />
                  Enrolled
                </div>
                <div className="text-2xl font-bold mt-1">{stats.enrolled}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Play className="h-4 w-4" />
                  Active
                </div>
                <div className="text-2xl font-bold mt-1">{stats.active}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Mail className="h-4 w-4" />
                  Replied
                </div>
                <div className="text-2xl font-bold mt-1">{stats.replied}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Calendar className="h-4 w-4" />
                  Booked
                </div>
                <div className="text-2xl font-bold mt-1">{stats.booked}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <TrendingUp className="h-4 w-4" />
                  Reply Rate
                </div>
                <div className="text-2xl font-bold mt-1">
                  {stats.enrolled > 0 ? Math.round((stats.replied / stats.enrolled) * 100) : 0}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="prospects" className="space-y-4">
            <TabsList>
              <TabsTrigger value="prospects">Sequence Runner</TabsTrigger>
              <TabsTrigger value="steps">Sequence Steps</TabsTrigger>
            </TabsList>

            {/* Sequence Runner Tab */}
            <TabsContent value="prospects">
              <Card>
                <CardHeader>
                  <CardTitle>Enrolled Prospects</CardTitle>
                  <CardDescription>
                    Track each prospect's progress through the sequence
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {sequenceRuns.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No prospects enrolled yet</p>
                      <Button variant="outline" className="mt-4">
                        Import Prospects
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4">Prospect</th>
                            <th className="text-left py-3 px-4">Company</th>
                            <th className="text-left py-3 px-4">Status</th>
                            <th className="text-left py-3 px-4">Current Step</th>
                            <th className="text-left py-3 px-4">Next Due</th>
                            <th className="text-left py-3 px-4">Last Event</th>
                            <th className="text-right py-3 px-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sequenceRuns.map(run => (
                            <tr
                              key={run.id}
                              className="border-b hover:bg-muted/50 cursor-pointer"
                              onClick={() => setSelectedProspectId(run.prospect_id)}
                            >
                              <td className="py-3 px-4">
                                <div className="font-medium">
                                  {run.prospect?.first_name} {run.prospect?.last_name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {run.prospect?.email}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div>{run.prospect?.company}</div>
                                <div className="text-sm text-muted-foreground">
                                  {run.prospect?.title}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                {getStatusBadge(run.status)}
                              </td>
                              <td className="py-3 px-4">
                                Step {run.last_step_sent} / {sequenceSteps.length}
                              </td>
                              <td className="py-3 px-4">
                                {run.next_step_due_at ? (
                                  <div className="flex items-center gap-1 text-sm">
                                    <Clock className="h-3 w-3" />
                                    {new Date(run.next_step_due_at).toLocaleDateString()}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {run.latest_event ? (
                                  getEventBadge(run.latest_event.event_type)
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="text-right py-3 px-4">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedProspectId(run.prospect_id);
                                    }}>
                                      View Intelligence
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>Skip to Next Step</DropdownMenuItem>
                                    <DropdownMenuItem>Pause Sequence</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
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

            {/* Sequence Steps Tab */}
            <TabsContent value="steps">
              <Card>
                <CardHeader>
                  <CardTitle>Sequence Steps</CardTitle>
                  <CardDescription>
                    The touchpoints in this campaign
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {sequenceSteps.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No steps configured
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {sequenceSteps.map((step, index) => (
                        <div
                          key={step.id}
                          className="flex items-start gap-4 p-4 border rounded-lg"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold">
                            {step.step_order}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="capitalize">
                                {step.step_type.replace("_", " ")}
                              </Badge>
                              <Badge variant="secondary" className="capitalize">
                                {step.step_type}
                              </Badge>
                              {index > 0 && (
                                <span className="text-sm text-muted-foreground">
                                  +{step.delay_days} days
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {step.message_template || "No template configured"}
                            </p>
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

        {/* Prospect Intelligence Drawer */}
        <ProspectIntelligenceDrawer
          prospectId={selectedProspectId}
          onClose={() => setSelectedProspectId(null)}
        />
      </div>
    </ProtectedRoute>
  );
}
