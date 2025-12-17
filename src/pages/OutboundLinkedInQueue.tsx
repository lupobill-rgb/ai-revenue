import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Linkedin,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  User,
  Building,
  Sparkles
} from "lucide-react";

interface LinkedInTask {
  id: string;
  tenant_id: string;
  prospect_id: string;
  sequence_run_id: string;
  step_id: string;
  message_text: string;
  linkedin_url: string | null;
  status: string;
  created_at: string;
  sent_at?: string | null;
  notes?: string | null;
  prospect?: {
    first_name: string;
    last_name: string;
    company: string;
    title: string;
  };
}

export default function OutboundLinkedInQueue() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<LinkedInTask[]>([]);
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());
  const [regenerating, setRegenerating] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch pending LinkedIn tasks (RLS filters by tenant_id = auth.uid())
      const { data: tasks, error } = await supabase
        .from("linkedin_tasks")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching LinkedIn tasks:", error);
        throw error;
      }

      if (!tasks || tasks.length === 0) {
        setQueue([]);
        setLoading(false);
        return;
      }

      // Get prospect details for the tasks
      const prospectIds = tasks.map(t => t.prospect_id);
      const { data: prospects } = await supabase
        .from("prospects")
        .select("id, first_name, last_name, company, title")
        .in("id", prospectIds);

      // Merge prospect data into tasks
      const tasksWithProspects = tasks.map(task => ({
        ...task,
        prospect: prospects?.find(p => p.id === task.prospect_id)
      }));

      setQueue(tasksWithProspects);
    } catch (error) {
      console.error("Error fetching queue:", error);
      toast({
        title: "Error",
        description: "Could not load LinkedIn queue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = async (task: LinkedInTask) => {
    try {
      // Personalize message with prospect data
      let personalizedMessage = task.message_text;
      if (task.prospect) {
        personalizedMessage = personalizedMessage
          .replace(/\{\{first_name\}\}/g, task.prospect.first_name || "")
          .replace(/\{\{last_name\}\}/g, task.prospect.last_name || "")
          .replace(/\{\{company\}\}/g, task.prospect.company || "")
          .replace(/\{\{title\}\}/g, task.prospect.title || "");
      }

      await navigator.clipboard.writeText(personalizedMessage);
      
      setCopiedIds(prev => new Set([...prev, task.id]));
      
      toast({
        title: "Copied!",
        description: "Message copied to clipboard. Paste it in LinkedIn.",
      });

      // Reset copy state after 3 seconds
      setTimeout(() => {
        setCopiedIds(prev => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
      }, 3000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const markAsSent = async (task: LinkedInTask) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update the linkedin_task status to sent
      const { error: updateError } = await supabase
        .from("linkedin_tasks")
        .update({ 
          status: "sent", 
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        })
        .eq("id", task.id);

      if (updateError) throw updateError;

      // Log the event in outbound_message_events
      await supabase.from("outbound_message_events").insert({
        sequence_run_id: task.sequence_run_id,
        step_id: task.step_id || task.id,
        tenant_id: task.tenant_id,
        event_type: "sent",
        channel: "linkedin",
        message_text: task.message_text,
        metadata: {
          manual_send: true,
          linkedin_url: task.linkedin_url,
          prospect_id: task.prospect_id,
        },
      });

      // If there's an associated sequence run, advance it
      if (task.sequence_run_id) {
        const { data: run } = await supabase
          .from("outbound_sequence_runs")
          .select("last_step_sent, sequence_id")
          .eq("id", task.sequence_run_id)
          .single();

        if (run) {
          const nextStepOrder = (run.last_step_sent || 0) + 1;
          
          // Get the next step's delay
          const { data: nextStep } = await supabase
            .from("outbound_sequence_steps")
            .select("delay_days")
            .eq("sequence_id", run.sequence_id)
            .eq("step_order", nextStepOrder + 1)
            .maybeSingle();

          const nextDueAt = nextStep
            ? new Date(Date.now() + (nextStep.delay_days || 3) * 24 * 60 * 60 * 1000).toISOString()
            : null;

          await supabase
            .from("outbound_sequence_runs")
            .update({
              last_step_sent: nextStepOrder,
              next_step_due_at: nextDueAt,
              status: nextDueAt ? "active" : "completed",
            })
            .eq("id", task.sequence_run_id);
        }
      }

      // Remove from queue
      setQueue(prev => prev.filter(q => q.id !== task.id));

      toast({
        title: "Marked as sent",
        description: "Message logged and sequence advanced",
      });
    } catch (error) {
      console.error("Error marking as sent:", error);
      toast({
        title: "Error",
        description: "Could not update status",
        variant: "destructive",
      });
    }
  };

  const regenerateMessage = async (task: LinkedInTask) => {
    setRegenerating(task.id);
    try {
      const { data, error } = await supabase.functions.invoke("outbound-message-gen", {
        body: {
          mode: "personalize",
          prospect_id: task.prospect_id,
          prospect: task.prospect,
          step_type: "connect",
          channel: "linkedin",
        },
      });

      if (error) throw error;

      if (data?.message) {
        // Update the task in database
        await supabase
          .from("linkedin_tasks")
          .update({ 
            message_text: data.message,
            updated_at: new Date().toISOString()
          })
          .eq("id", task.id);

        setQueue(prev => prev.map(q => 
          q.id === task.id ? { ...q, message_text: data.message } : q
        ));
        toast({ title: "Message regenerated!" });
      }
    } catch (error) {
      console.error("Error regenerating:", error);
      toast({
        title: "Error",
        description: "Could not regenerate message",
        variant: "destructive",
      });
    } finally {
      setRegenerating(null);
    }
  };

  const getPersonalizedMessage = (task: LinkedInTask) => {
    let message = task.message_text;
    if (task.prospect) {
      message = message
        .replace(/\{\{first_name\}\}/g, task.prospect.first_name || "")
        .replace(/\{\{last_name\}\}/g, task.prospect.last_name || "")
        .replace(/\{\{company\}\}/g, task.prospect.company || "")
        .replace(/\{\{title\}\}/g, task.prospect.title || "");
    }
    return message;
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/outbound")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Linkedin className="h-6 w-6 text-[#0A66C2]" />
                  LinkedIn Queue
                </h1>
                <p className="text-muted-foreground">
                  Copy messages and send manually to stay ToS-compliant
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={fetchQueue}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Info Banner */}
          <Card className="mb-6 border-[#0A66C2]/30 bg-[#0A66C2]/5">
            <CardContent className="pt-4">
              <p className="text-sm">
                <strong>Human-in-the-loop approach:</strong> AI generates personalized messages, 
                you copy and send them via LinkedIn. This keeps you compliant with LinkedIn's 
                Terms of Service while leveraging AI for message creation.
              </p>
            </CardContent>
          </Card>

          {/* Queue */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : queue.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Linkedin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold mb-2">No messages in queue</h3>
                <p className="text-muted-foreground text-sm">
                  LinkedIn messages will appear here when campaigns generate them
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {queue.map((task) => (
                <Card key={task.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-[#0A66C2]" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {task.prospect?.first_name} {task.prospect?.last_name}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {task.prospect?.title} at {task.prospect?.company}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-[#0A66C2]/10 text-[#0A66C2]">
                        Pending
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Message Preview */}
                    <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                      {getPersonalizedMessage(task)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => regenerateMessage(task)}
                          disabled={regenerating === task.id}
                        >
                          {regenerating === task.id ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                          )}
                          Regenerate
                        </Button>
                        {task.linkedin_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a
                              href={task.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open LinkedIn
                            </a>
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={copiedIds.has(task.id) ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => copyMessage(task)}
                        >
                          {copiedIds.has(task.id) ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Message
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => markAsSent(task)}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Mark as Sent
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}