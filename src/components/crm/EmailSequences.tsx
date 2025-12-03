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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Mail, Play, Pause, Users, Clock, CheckCircle, Loader2, ChevronRight, Edit, Trash2, Sparkles } from "lucide-react";

interface EmailSequence {
  id: string;
  name: string;
  description: string | null;
  status: string;
  trigger_type: string;
  total_steps: number;
  enrolled_count: number;
  completed_count: number;
  created_at: string;
}

interface SequenceStep {
  id: string;
  sequence_id: string;
  step_order: number;
  delay_days: number;
  subject: string;
  body: string;
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface EmailSequencesProps {
  workspaceId: string;
}

export function EmailSequences({ workspaceId }: EmailSequencesProps) {
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [selectedSequence, setSelectedSequence] = useState<EmailSequence | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewSequence, setShowNewSequence] = useState(false);
  const [showNewStep, setShowNewStep] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newSequence, setNewSequence] = useState({ name: "", description: "", trigger_type: "manual" });
  const [newStep, setNewStep] = useState({ delay_days: 0, subject: "", body: "" });
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  useEffect(() => {
    fetchSequences();
    fetchLeads();
  }, []);

  useEffect(() => {
    if (selectedSequence) {
      fetchSteps(selectedSequence.id);
    }
  }, [selectedSequence]);

  const fetchSequences = async () => {
    try {
      const { data, error } = await supabase
        .from("email_sequences")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSequences(data || []);
    } catch (error) {
      console.error("Error fetching sequences:", error);
      toast.error("Failed to load sequences");
    } finally {
      setLoading(false);
    }
  };

  const fetchSteps = async (sequenceId: string) => {
    try {
      const { data, error } = await supabase
        .from("email_sequence_steps")
        .select("*")
        .eq("sequence_id", sequenceId)
        .order("step_order");

      if (error) throw error;
      setSteps(data || []);
    } catch (error) {
      console.error("Error fetching steps:", error);
    }
  };

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("id, first_name, last_name, email")
        .in("status", ["new", "contacted", "qualified"])
        .order("first_name");

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
    }
  };

  const handleCreateSequence = async () => {
    if (!newSequence.name) {
      toast.error("Please enter a sequence name");
      return;
    }

    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("email_sequences")
        .insert([{ ...newSequence, created_by: user.user?.id, workspace_id: workspaceId }])
        .select()
        .single();

      if (error) throw error;

      toast.success("Sequence created");
      setShowNewSequence(false);
      setNewSequence({ name: "", description: "", trigger_type: "manual" });
      fetchSequences();
      if (data) setSelectedSequence(data);
    } catch (error) {
      console.error("Error creating sequence:", error);
      toast.error("Failed to create sequence");
    } finally {
      setSaving(false);
    }
  };

  const handleAddStep = async () => {
    if (!selectedSequence || !newStep.subject || !newStep.body) {
      toast.error("Please fill in subject and body");
      return;
    }

    setSaving(true);
    try {
      const stepOrder = steps.length + 1;
      const { error } = await supabase.from("email_sequence_steps").insert([{
        sequence_id: selectedSequence.id,
        step_order: stepOrder,
        delay_days: newStep.delay_days,
        subject: newStep.subject,
        body: newStep.body,
      }]);

      if (error) throw error;

      // Update total steps count
      await supabase
        .from("email_sequences")
        .update({ total_steps: stepOrder })
        .eq("id", selectedSequence.id);

      toast.success("Step added");
      setShowNewStep(false);
      setNewStep({ delay_days: 0, subject: "", body: "" });
      fetchSteps(selectedSequence.id);
      fetchSequences();
    } catch (error) {
      console.error("Error adding step:", error);
      toast.error("Failed to add step");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateWithAI = async () => {
    if (!selectedSequence) return;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-lead-nurturing", {
        body: { 
          action: "generate_sequence",
          leadId: leads[0]?.id, // Use first lead as template
          sequenceContext: {
            name: selectedSequence.name,
            description: selectedSequence.description,
          }
        },
      });

      if (error) throw error;

      if (data?.sequence) {
        // Insert AI-generated steps
        for (const step of data.sequence) {
          await supabase.from("email_sequence_steps").insert([{
            sequence_id: selectedSequence.id,
            step_order: step.step_number,
            delay_days: step.delay_days,
            subject: step.subject_line,
            body: step.email_body,
          }]);
        }

        await supabase
          .from("email_sequences")
          .update({ total_steps: data.sequence.length })
          .eq("id", selectedSequence.id);

        toast.success("AI generated sequence steps");
        fetchSteps(selectedSequence.id);
        fetchSequences();
      }
    } catch (error) {
      console.error("Error generating sequence:", error);
      toast.error("Failed to generate sequence");
    } finally {
      setGenerating(false);
    }
  };

  const handleEnrollLeads = async () => {
    if (!selectedSequence || selectedLeadIds.length === 0) {
      toast.error("Please select leads to enroll");
      return;
    }

    setSaving(true);
    try {
      const enrollments = selectedLeadIds.map(leadId => ({
        sequence_id: selectedSequence.id,
        lead_id: leadId,
        current_step: 1,
        next_email_at: new Date().toISOString(),
        workspace_id: workspaceId,
      }));

      const { error } = await supabase.from("sequence_enrollments").insert(enrollments);
      if (error) throw error;

      // Update enrolled count
      await supabase
        .from("email_sequences")
        .update({ enrolled_count: selectedSequence.enrolled_count + selectedLeadIds.length })
        .eq("id", selectedSequence.id);

      toast.success(`Enrolled ${selectedLeadIds.length} leads`);
      setShowEnroll(false);
      setSelectedLeadIds([]);
      fetchSequences();
    } catch (error: any) {
      console.error("Error enrolling leads:", error);
      toast.error(error.message?.includes("duplicate") ? "Some leads are already enrolled" : "Failed to enroll leads");
    } finally {
      setSaving(false);
    }
  };

  const toggleSequenceStatus = async (sequence: EmailSequence) => {
    const newStatus = sequence.status === "active" ? "paused" : "active";
    try {
      const { error } = await supabase
        .from("email_sequences")
        .update({ status: newStatus })
        .eq("id", sequence.id);

      if (error) throw error;
      toast.success(`Sequence ${newStatus}`);
      fetchSequences();
    } catch (error) {
      console.error("Error updating sequence:", error);
      toast.error("Failed to update sequence");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Sequences List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Sequences
            </CardTitle>
            <Dialog open={showNewSequence} onOpenChange={setShowNewSequence}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Email Sequence</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={newSequence.name}
                      onChange={(e) => setNewSequence({ ...newSequence, name: e.target.value })}
                      placeholder="Welcome Series"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newSequence.description}
                      onChange={(e) => setNewSequence({ ...newSequence, description: e.target.value })}
                      placeholder="Sequence description..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Trigger</Label>
                    <Select value={newSequence.trigger_type} onValueChange={(v) => setNewSequence({ ...newSequence, trigger_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual Enrollment</SelectItem>
                        <SelectItem value="new_lead">New Lead Created</SelectItem>
                        <SelectItem value="status_change">Status Change</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreateSequence} disabled={saving} className="w-full">
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Create Sequence
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {sequences.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No sequences yet</p>
              ) : (
                sequences.map(seq => (
                  <div
                    key={seq.id}
                    onClick={() => setSelectedSequence(seq)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSequence?.id === seq.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{seq.name}</span>
                      <Badge variant={seq.status === "active" ? "default" : "secondary"}>
                        {seq.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {seq.total_steps} steps
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {seq.enrolled_count} enrolled
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Sequence Details */}
      <Card className="lg:col-span-2">
        {selectedSequence ? (
          <>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedSequence.name}</CardTitle>
                  <CardDescription>{selectedSequence.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSequenceStatus(selectedSequence)}
                  >
                    {selectedSequence.status === "active" ? (
                      <><Pause className="h-4 w-4 mr-1" /> Pause</>
                    ) : (
                      <><Play className="h-4 w-4 mr-1" /> Activate</>
                    )}
                  </Button>
                  <Dialog open={showEnroll} onOpenChange={setShowEnroll}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Users className="h-4 w-4 mr-1" />
                        Enroll Leads
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Enroll Leads</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <ScrollArea className="h-[300px] border rounded-lg p-2">
                          {leads.map(lead => (
                            <div
                              key={lead.id}
                              onClick={() => {
                                setSelectedLeadIds(prev =>
                                  prev.includes(lead.id)
                                    ? prev.filter(id => id !== lead.id)
                                    : [...prev, lead.id]
                                );
                              }}
                              className={`p-2 rounded cursor-pointer transition-colors ${
                                selectedLeadIds.includes(lead.id) ? "bg-primary/10" : "hover:bg-muted"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <CheckCircle className={`h-4 w-4 ${selectedLeadIds.includes(lead.id) ? "text-primary" : "text-muted-foreground"}`} />
                                <div>
                                  <p className="font-medium text-sm">{lead.first_name} {lead.last_name}</p>
                                  <p className="text-xs text-muted-foreground">{lead.email}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </ScrollArea>
                        <Button onClick={handleEnrollLeads} disabled={saving || selectedLeadIds.length === 0} className="w-full">
                          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                          Enroll {selectedLeadIds.length} Leads
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">Sequence Steps</h4>
                <div className="flex gap-2">
                  {steps.length === 0 && (
                    <Button variant="outline" size="sm" onClick={handleGenerateWithAI} disabled={generating}>
                      {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                      Generate with AI
                    </Button>
                  )}
                  <Dialog open={showNewStep} onOpenChange={setShowNewStep}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Step
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Email Step</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Delay (days after previous)</Label>
                          <Input
                            type="number"
                            value={newStep.delay_days}
                            onChange={(e) => setNewStep({ ...newStep, delay_days: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Subject Line</Label>
                          <Input
                            value={newStep.subject}
                            onChange={(e) => setNewStep({ ...newStep, subject: e.target.value })}
                            placeholder="Email subject..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email Body</Label>
                          <Textarea
                            value={newStep.body}
                            onChange={(e) => setNewStep({ ...newStep, body: e.target.value })}
                            rows={6}
                            placeholder="Email content..."
                          />
                        </div>
                        <Button onClick={handleAddStep} disabled={saving} className="w-full">
                          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                          Add Step
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <ScrollArea className="h-[350px]">
                {steps.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No steps yet. Add steps or generate with AI.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {steps.map((step, idx) => (
                      <Card key={step.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                                {step.step_order}
                              </div>
                              {idx < steps.length - 1 && <div className="w-0.5 h-8 bg-border mt-2" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="gap-1">
                                  <Clock className="h-3 w-3" />
                                  {step.delay_days === 0 ? "Immediately" : `+${step.delay_days} days`}
                                </Badge>
                              </div>
                              <p className="font-medium">{step.subject}</p>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{step.body}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex items-center justify-center h-[500px]">
            <div className="text-center text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Select a sequence to view details</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}