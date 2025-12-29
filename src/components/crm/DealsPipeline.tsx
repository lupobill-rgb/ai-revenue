import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, DollarSign, Calendar, Building, TrendingUp, GripVertical, Loader2, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { useDemoMode } from "@/hooks/useDemoMode";

interface Deal {
  id: string;
  name: string;
  value: number;
  stage: string;
  probability: number;
  expected_close_date: string | null;
  lead_id: string | null;
  notes: string | null;
  created_at: string;
  revenue_verified?: boolean;
  data_mode?: string;
  leads?: { first_name: string; last_name: string; company: string | null } | null;
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
}

interface PipelineTruth {
  pipeline_value: number;
  pipeline_count: number;
  won_revenue: number;
  won_count: number;
  verified_won_count: number;
  lost_value: number;
  lost_count: number;
  data_quality_status: string;
  demo_mode: boolean;
  stripe_connected: boolean;
}

const STAGES = [
  { id: "prospecting", label: "Prospecting", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", probability: 10 },
  { id: "qualification", label: "Qualification", color: "bg-purple-500/10 text-purple-500 border-purple-500/20", probability: 25 },
  { id: "proposal", label: "Proposal", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", probability: 50 },
  { id: "negotiation", label: "Negotiation", color: "bg-orange-500/10 text-orange-500 border-orange-500/20", probability: 75 },
  { id: "closed_won", label: "Closed Won", color: "bg-green-500/10 text-green-500 border-green-500/20", probability: 100 },
  { id: "closed_lost", label: "Closed Lost", color: "bg-muted text-muted-foreground", probability: 0 },
];

interface DealsPipelineProps {
  workspaceId: string;
}

export function DealsPipeline({ workspaceId }: DealsPipelineProps) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pipelineTruth, setPipelineTruth] = useState<PipelineTruth | null>(null);
  const { demoMode } = useDemoMode();
  const [newDeal, setNewDeal] = useState({
    name: "",
    value: 0,
    stage: "prospecting",
    lead_id: "",
    expected_close_date: "",
    notes: "",
  });

  useEffect(() => {
    fetchDeals();
    fetchLeads();
    fetchPipelineTruth();
  }, [workspaceId]);

  const fetchPipelineTruth = async () => {
    if (!workspaceId) return;
    try {
      const { data, error } = await supabase
        .from("v_crm_pipeline_truth")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching pipeline truth:", error);
        return;
      }
      setPipelineTruth(data);
    } catch (error) {
      console.error("Error fetching pipeline truth:", error);
    }
  };

  const fetchDeals = async () => {
    if (!workspaceId) return;
    try {
      // Fetch deals with data_mode filter based on workspace mode
      const { data, error } = await supabase
        .from("deals")
        .select("*, leads(first_name, last_name, company)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDeals(data || []);
    } catch (error) {
      console.error("Error fetching deals:", error);
      toast.error("Failed to load deals");
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("id, first_name, last_name, company")
        .in("status", ["new", "contacted", "qualified"])
        .order("first_name");

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
    }
  };

  const handleCreateDeal = async () => {
    if (!newDeal.name) {
      toast.error("Please enter a deal name");
      return;
    }

    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const stage = STAGES.find(s => s.id === newDeal.stage);

      const { error } = await supabase.from("deals").insert([{
        name: newDeal.name,
        value: newDeal.value,
        stage: newDeal.stage,
        probability: stage?.probability || 10,
        lead_id: newDeal.lead_id || null,
        expected_close_date: newDeal.expected_close_date || null,
        notes: newDeal.notes || null,
        created_by: user.user?.id,
        workspace_id: workspaceId,
        source: 'user', // Explicit: user-created deals count in live analytics
      }]);

      if (error) throw error;

      toast.success("Deal created successfully");
      setShowNewDeal(false);
      setNewDeal({ name: "", value: 0, stage: "prospecting", lead_id: "", expected_close_date: "", notes: "" });
      fetchDeals();
    } catch (error) {
      console.error("Error creating deal:", error);
      toast.error("Failed to create deal");
    } finally {
      setSaving(false);
    }
  };

  const handleStageChange = async (dealId: string, newStage: string) => {
    try {
      const stage = STAGES.find(s => s.id === newStage);
      const updates: any = { stage: newStage, probability: stage?.probability || 10 };
      
      if (newStage === "closed_won" || newStage === "closed_lost") {
        updates.actual_close_date = new Date().toISOString().split('T')[0];
      }

      // Revenue OS guard boundary (no client-side enforcement).
      const { data, error } = await supabase.functions.invoke("revenue-os-guard-deal-update", {
        body: {
          tenant_id: workspaceId,
          deal_id: dealId,
          updates,
          override_ack: false,
        },
      });

      if (error) {
        // Surface policy reason if available (no new UI required).
        const ctx: any = (error as any).context;
        const guard = ctx?.body?.guard;
        const reason = guard?.reason_text || error.message;
        toast.error(reason);
        return;
      }

      if (data?.allowed === false) {
        toast.error(data?.guard?.reason_text || "Update blocked by policy");
        return;
      }

      toast.success("Deal updated");
      fetchDeals();
    } catch (error) {
      console.error("Error updating deal:", error);
      toast.error("Failed to update deal");
    }
  };

  const getStageDeals = (stageId: string) => deals.filter(d => d.stage === stageId);
  
  const getStageValue = (stageId: string) => 
    getStageDeals(stageId).reduce((sum, d) => sum + (d.value || 0), 0);

  const totalPipelineValue = deals
    .filter(d => !["closed_won", "closed_lost"].includes(d.stage))
    .reduce((sum, d) => sum + (d.value || 0), 0);

  const weightedValue = deals
    .filter(d => !["closed_won", "closed_lost"].includes(d.stage))
    .reduce((sum, d) => sum + ((d.value || 0) * (d.probability || 0) / 100), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Determine data quality status
  const dataQualityStatus = pipelineTruth?.data_quality_status || 'UNKNOWN';
  const isDemo = pipelineTruth?.demo_mode || demoMode;
  const stripeConnected = pipelineTruth?.stripe_connected || false;

  return (
    <div className="space-y-6">
      {/* Data Quality Banner */}
      {dataQualityStatus === 'DEMO_MODE' && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="flex items-center gap-2">
            Demo Mode Active
            <Badge variant="outline" className="text-amber-500 border-amber-500">Demo Data</Badge>
          </AlertTitle>
          <AlertDescription>
            Pipeline values are simulated projections. Toggle off demo mode in settings for live data.
          </AlertDescription>
        </Alert>
      )}
      
      {dataQualityStatus === 'NO_STRIPE_CONNECTED' && !isDemo && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <AlertTitle className="flex items-center gap-2">
            Revenue Verification Required
            <Badge variant="outline" className="text-destructive border-destructive">Setup Required</Badge>
          </AlertTitle>
          <AlertDescription>
            Connect Stripe to verify won revenue. Unverified revenue is shown as $0 in live mode.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards - Using gated pipeline truth */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Value</p>
                <p className="text-2xl font-bold">
                  ${(pipelineTruth?.pipeline_value || totalPipelineValue).toLocaleString()}
                </p>
                {isDemo && <Badge variant="outline" className="text-xs mt-1">Projected</Badge>}
              </div>
              <DollarSign className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Won Revenue</p>
                <p className="text-2xl font-bold">
                  ${(pipelineTruth?.won_revenue || 0).toLocaleString()}
                </p>
                {!isDemo && stripeConnected && pipelineTruth?.verified_won_count !== undefined && (
                  <div className="flex items-center gap-1 mt-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    <span className="text-xs text-muted-foreground">
                      {pipelineTruth.verified_won_count} verified
                    </span>
                  </div>
                )}
                {!isDemo && !stripeConnected && (
                  <Badge variant="outline" className="text-xs mt-1 text-destructive border-destructive">
                    Unverified
                  </Badge>
                )}
              </div>
              <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Deals</p>
                <p className="text-2xl font-bold">
                  {pipelineTruth?.pipeline_count || deals.filter(d => !["closed_won", "closed_lost"].includes(d.stage)).length}
                </p>
              </div>
              <Building className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Dialog open={showNewDeal} onOpenChange={setShowNewDeal}>
              <DialogTrigger asChild>
                <Button className="w-full h-full min-h-[60px]">
                  <Plus className="mr-2 h-4 w-4" />
                  New Deal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Deal</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Deal Name</Label>
                    <Input
                      value={newDeal.name}
                      onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
                      placeholder="Enterprise Software License"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Value ($)</Label>
                      <Input
                        type="number"
                        value={newDeal.value}
                        onChange={(e) => setNewDeal({ ...newDeal, value: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Stage</Label>
                      <Select value={newDeal.stage} onValueChange={(v) => setNewDeal({ ...newDeal, stage: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.filter(s => s.id !== "closed_lost").map(stage => (
                            <SelectItem key={stage.id} value={stage.id}>{stage.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Associated Lead</Label>
                    <Select value={newDeal.lead_id} onValueChange={(v) => setNewDeal({ ...newDeal, lead_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a lead..." />
                      </SelectTrigger>
                      <SelectContent>
                        {leads.map(lead => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.first_name} {lead.last_name} {lead.company && `(${lead.company})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Expected Close Date</Label>
                    <Input
                      type="date"
                      value={newDeal.expected_close_date}
                      onChange={(e) => setNewDeal({ ...newDeal, expected_close_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={newDeal.notes}
                      onChange={(e) => setNewDeal({ ...newDeal, notes: e.target.value })}
                      placeholder="Deal notes..."
                    />
                  </div>
                  <Button onClick={handleCreateDeal} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create Deal
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Board */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {STAGES.map(stage => (
          <Card key={stage.id} className="min-h-[400px]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Badge className={stage.color}>{stage.label}</Badge>
                <span className="text-sm text-muted-foreground">{getStageDeals(stage.id).length}</span>
              </div>
              <p className="text-sm font-semibold text-muted-foreground">
                ${getStageValue(stage.id).toLocaleString()}
              </p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px] pr-2">
                <div className="space-y-2">
                  {getStageDeals(stage.id).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No deals in this stage
                    </div>
                  ) : getStageDeals(stage.id).map(deal => (
                    <Card key={deal.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-medium text-sm truncate">{deal.name}</p>
                              {/* Verification badge for closed_won deals */}
                              {deal.stage === 'closed_won' && (
                                deal.revenue_verified ? (
                                  <span title="Revenue verified via Stripe">
                                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                  </span>
                                ) : (
                                  <span title="Revenue not verified">
                                    <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                                  </span>
                                )
                              )}
                            </div>
                            {deal.leads && (
                              <p className="text-xs text-muted-foreground truncate">
                                {deal.leads.first_name} {deal.leads.last_name}
                              </p>
                            )}
                          </div>
                          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-semibold text-primary">
                            ${(deal.value || 0).toLocaleString()}
                          </span>
                          {deal.expected_close_date && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(deal.expected_close_date), "MMM d")}
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <Select value={deal.stage} onValueChange={(v) => handleStageChange(deal.id, v)}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STAGES.map(s => (
                                <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}