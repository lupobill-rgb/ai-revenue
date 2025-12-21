import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  ArrowRight,
  Shield,
  Users,
  Globe,
  AlertTriangle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface RolloutPhase {
  id: string;
  phase_number: number;
  phase_name: string;
  description: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  required_duration_hours: number;
  tenant_filter: Record<string, unknown>;
}

interface GateCheck {
  id: string;
  phase_id: string;
  gate_name: string;
  gate_type: string;
  description: string;
  is_passed: boolean;
  last_checked_at: string | null;
  check_result: { passed?: boolean; message?: string } | null;
  required: boolean;
}

interface TenantAssignment {
  id: string;
  phase_id: string;
  tenant_id: string;
  status: string;
  assigned_at: string;
  tenant?: { name: string };
}

interface Tenant {
  id: string;
  name: string;
}

export default function RolloutPlan() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [phases, setPhases] = useState<RolloutPhase[]>([]);
  const [gates, setGates] = useState<Map<string, GateCheck[]>>(new Map());
  const [assignments, setAssignments] = useState<Map<string, TenantAssignment[]>>(new Map());
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [checking, setChecking] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: isPlatformAdminResult, error } = await supabase.rpc("is_platform_admin");
    
    if (error || !isPlatformAdminResult) {
      toast.error("Access denied. Platform admin role required.");
      navigate("/");
      return;
    }

    setIsAdmin(true);
  }

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch phases
      const { data: phasesData } = await supabase
        .from("rollout_phases")
        .select("*")
        .order("phase_number");
      
      setPhases((phasesData || []) as RolloutPhase[]);

      // Fetch gates
      const { data: gatesData } = await supabase
        .from("rollout_gate_checks")
        .select("*")
        .order("gate_name");
      
      const gatesMap = new Map<string, GateCheck[]>();
      for (const gate of (gatesData || []) as GateCheck[]) {
        const existing = gatesMap.get(gate.phase_id) || [];
        existing.push(gate);
        gatesMap.set(gate.phase_id, existing);
      }
      setGates(gatesMap);

      // Fetch assignments
      const { data: assignmentsData } = await supabase
        .from("rollout_tenant_assignments")
        .select("*")
        .order("assigned_at");
      
      const assignmentsMap = new Map<string, TenantAssignment[]>();
      for (const assignment of (assignmentsData || []) as TenantAssignment[]) {
        const existing = assignmentsMap.get(assignment.phase_id) || [];
        existing.push(assignment);
        assignmentsMap.set(assignment.phase_id, existing);
      }
      setAssignments(assignmentsMap);

      // Fetch tenants
      const { data: tenantsData } = await supabase
        .from("tenants")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      
      setTenants((tenantsData || []) as Tenant[]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch rollout data");
    } finally {
      setLoading(false);
    }
  }

  async function checkAllGates(phaseId: string) {
    setChecking(true);
    try {
      const phaseGates = gates.get(phaseId) || [];
      for (const gate of phaseGates) {
        await supabase.rpc("check_rollout_gate", { p_gate_id: gate.id });
      }
      toast.success("Gate checks completed");
      await fetchData();
    } catch (error) {
      console.error("Error checking gates:", error);
      toast.error("Failed to check gates");
    } finally {
      setChecking(false);
    }
  }

  async function startPhase(phaseId: string) {
    try {
      await supabase
        .from("rollout_phases")
        .update({ status: "active", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", phaseId);
      
      toast.success("Phase started");
      await fetchData();
    } catch (error) {
      console.error("Error starting phase:", error);
      toast.error("Failed to start phase");
    }
  }

  async function advancePhase(phaseId: string) {
    setAdvancing(true);
    try {
      const { data, error } = await supabase.rpc("advance_rollout_phase", { p_phase_id: phaseId });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; next_phase?: string };
      if (result.success) {
        toast.success(`Advanced to ${result.next_phase || "completion"}`);
        await fetchData();
      } else {
        toast.error(result.error || "Cannot advance phase");
      }
    } catch (error) {
      console.error("Error advancing phase:", error);
      toast.error("Failed to advance phase");
    } finally {
      setAdvancing(false);
    }
  }

  async function assignTenant(phaseId: string, tenantId: string) {
    try {
      await supabase
        .from("rollout_tenant_assignments")
        .insert({ phase_id: phaseId, tenant_id: tenantId });
      
      toast.success("Tenant assigned to phase");
      await fetchData();
    } catch (error) {
      console.error("Error assigning tenant:", error);
      toast.error("Failed to assign tenant");
    }
  }

  async function removeTenantAssignment(assignmentId: string) {
    try {
      await supabase
        .from("rollout_tenant_assignments")
        .delete()
        .eq("id", assignmentId);
      
      toast.success("Tenant removed from phase");
      await fetchData();
    } catch (error) {
      console.error("Error removing tenant:", error);
      toast.error("Failed to remove tenant");
    }
  }

  function getPhaseIcon(phaseNumber: number) {
    switch (phaseNumber) {
      case 1: return <Shield className="h-5 w-5" />;
      case 2: return <Users className="h-5 w-5" />;
      case 3: return <Globe className="h-5 w-5" />;
      default: return <Clock className="h-5 w-5" />;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "active":
        return <Badge className="bg-blue-500">Active</Badge>;
      case "blocked":
        return <Badge variant="destructive">Blocked</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  }

  function getPhaseProgress(phase: RolloutPhase): number {
    if (phase.status === "completed") return 100;
    if (phase.status !== "active" || !phase.started_at) return 0;
    
    const startTime = new Date(phase.started_at).getTime();
    const now = Date.now();
    const requiredMs = phase.required_duration_hours * 60 * 60 * 1000;
    
    return Math.min(100, Math.round(((now - startTime) / requiredMs) * 100));
  }

  function canAdvance(phase: RolloutPhase): boolean {
    if (phase.status !== "active") return false;
    
    const phaseGates = gates.get(phase.id) || [];
    const allGatesPassed = phaseGates.filter(g => g.required).every(g => g.is_passed);
    
    if (!allGatesPassed) return false;
    if (!phase.started_at) return false;
    
    const startTime = new Date(phase.started_at).getTime();
    const requiredMs = phase.required_duration_hours * 60 * 60 * 1000;
    
    return Date.now() - startTime >= requiredMs;
  }

  if (!isAdmin) return null;

  const activePhase = phases.find(p => p.status === "active");
  const completedPhases = phases.filter(p => p.status === "completed").length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavBar />
      <main className="flex-1 container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Rollout Plan
            </h1>
            <p className="text-muted-foreground mt-1">
              Phased deployment with go/no-go gates
            </p>
          </div>
          <Button onClick={fetchData} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Progress Overview */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Rollout Progress</h3>
              <span className="text-sm text-muted-foreground">
                {completedPhases} of {phases.length} phases completed
              </span>
            </div>
            <div className="flex items-center gap-4">
              {phases.map((phase, idx) => (
                <div key={phase.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    phase.status === "completed" ? "bg-green-500 border-green-500 text-white" :
                    phase.status === "active" ? "bg-blue-500 border-blue-500 text-white" :
                    "border-muted-foreground/30 text-muted-foreground"
                  }`}>
                    {phase.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      getPhaseIcon(phase.phase_number)
                    )}
                  </div>
                  <div className="ml-2">
                    <p className="text-sm font-medium">{phase.phase_name}</p>
                    <p className="text-xs text-muted-foreground">{phase.required_duration_hours}h min</p>
                  </div>
                  {idx < phases.length - 1 && (
                    <ArrowRight className="h-4 w-4 mx-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="phases">
          <TabsList className="mb-4">
            <TabsTrigger value="phases">Phases & Gates</TabsTrigger>
            <TabsTrigger value="tenants">Tenant Assignments</TabsTrigger>
            <TabsTrigger value="checklist">Go/No-Go Checklist</TabsTrigger>
          </TabsList>

          <TabsContent value="phases">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-4">
                {phases.map((phase) => {
                  const phaseGates = gates.get(phase.id) || [];
                  const phaseAssignments = assignments.get(phase.id) || [];
                  const progress = getPhaseProgress(phase);
                  const canAdvancePhase = canAdvance(phase);
                  
                  return (
                    <Card key={phase.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              phase.status === "completed" ? "bg-green-500/10 text-green-500" :
                              phase.status === "active" ? "bg-blue-500/10 text-blue-500" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {getPhaseIcon(phase.phase_number)}
                            </div>
                            <div>
                              <CardTitle className="flex items-center gap-2">
                                Phase {phase.phase_number}: {phase.phase_name}
                                {getStatusBadge(phase.status)}
                              </CardTitle>
                              <CardDescription>{phase.description}</CardDescription>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {phase.status === "pending" && phases.findIndex(p => p.status === "active") === -1 && (
                              <Button onClick={() => startPhase(phase.id)} size="sm">
                                <Play className="h-4 w-4 mr-2" />
                                Start Phase
                              </Button>
                            )}
                            {phase.status === "active" && (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => checkAllGates(phase.id)}
                                  disabled={checking}
                                >
                                  <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
                                  Check Gates
                                </Button>
                                <Button 
                                  size="sm" 
                                  onClick={() => advancePhase(phase.id)}
                                  disabled={!canAdvancePhase || advancing}
                                >
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                  Advance
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {phase.status === "active" && (
                          <div className="mb-4">
                            <div className="flex justify-between text-sm mb-1">
                              <span>Duration Progress</span>
                              <span>
                                {phase.started_at && formatDistanceToNow(new Date(phase.started_at))} elapsed
                                {" / "}
                                {phase.required_duration_hours}h required
                              </span>
                            </div>
                            <Progress value={progress} />
                          </div>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Gates */}
                          <div>
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              Go/No-Go Gates
                            </h4>
                            <div className="space-y-2">
                              {phaseGates.map((gate) => (
                                <div key={gate.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                  <div className="flex items-center gap-2">
                                    {gate.is_passed ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <span className="text-sm">{gate.gate_name}</span>
                                    {gate.required && <Badge variant="outline" className="text-xs">Required</Badge>}
                                  </div>
                                  {gate.last_checked_at && (
                                    <span className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(gate.last_checked_at))} ago
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Assigned Tenants */}
                          <div>
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Assigned Tenants ({phaseAssignments.length})
                            </h4>
                            {phaseAssignments.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No tenants assigned</p>
                            ) : (
                              <div className="space-y-1">
                                {phaseAssignments.slice(0, 5).map((assignment) => {
                                  const tenant = tenants.find(t => t.id === assignment.tenant_id);
                                  return (
                                    <div key={assignment.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                                      <span>{tenant?.name || assignment.tenant_id}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeTenantAssignment(assignment.id)}
                                      >
                                        <XCircle className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  );
                                })}
                                {phaseAssignments.length > 5 && (
                                  <p className="text-xs text-muted-foreground">
                                    +{phaseAssignments.length - 5} more
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tenants">
            <Card>
              <CardHeader>
                <CardTitle>Tenant Phase Assignments</CardTitle>
                <CardDescription>Assign tenants to rollout phases</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      {phases.map((phase) => (
                        <TableHead key={phase.id} className="text-center">
                          Phase {phase.phase_number}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell className="font-medium">{tenant.name}</TableCell>
                        {phases.map((phase) => {
                          const isAssigned = assignments.get(phase.id)?.some(a => a.tenant_id === tenant.id);
                          return (
                            <TableCell key={phase.id} className="text-center">
                              <Checkbox
                                checked={isAssigned}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    assignTenant(phase.id, tenant.id);
                                  } else {
                                    const assignment = assignments.get(phase.id)?.find(a => a.tenant_id === tenant.id);
                                    if (assignment) {
                                      removeTenantAssignment(assignment.id);
                                    }
                                  }
                                }}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checklist">
            <Card>
              <CardHeader>
                <CardTitle>Go/No-Go Checklist</CardTitle>
                <CardDescription>All criteria must be met before advancing phases</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {phases.map((phase) => {
                    const phaseGates = gates.get(phase.id) || [];
                    const allPassed = phaseGates.filter(g => g.required).every(g => g.is_passed);
                    
                    return (
                      <div key={phase.id}>
                        <div className="flex items-center gap-2 mb-3">
                          {getPhaseIcon(phase.phase_number)}
                          <h4 className="font-semibold">Phase {phase.phase_number}: {phase.phase_name}</h4>
                          {getStatusBadge(phase.status)}
                          {phase.status === "active" && (
                            allPassed ? (
                              <Badge className="bg-green-500">All Gates Passed</Badge>
                            ) : (
                              <Badge variant="destructive">Gates Failing</Badge>
                            )
                          )}
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8">Status</TableHead>
                              <TableHead>Gate</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Last Check</TableHead>
                              <TableHead>Result</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {phaseGates.map((gate) => (
                              <TableRow key={gate.id}>
                                <TableCell>
                                  {gate.is_passed ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                  ) : (
                                    <XCircle className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {gate.gate_name}
                                  {gate.required && (
                                    <Badge variant="outline" className="ml-2 text-xs">Required</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {gate.description}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {gate.last_checked_at 
                                    ? format(new Date(gate.last_checked_at), "MMM d, HH:mm")
                                    : "Never"
                                  }
                                </TableCell>
                                <TableCell>
                                  {gate.check_result?.message || "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}