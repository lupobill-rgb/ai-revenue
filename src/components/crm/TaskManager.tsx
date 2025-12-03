import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Calendar, Clock, CheckCircle2, Circle, AlertCircle, Loader2, Phone, Mail, FileText, Users } from "lucide-react";
import { format, isToday, isTomorrow, isPast, addDays } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  task_type: string;
  lead_id: string | null;
  deal_id: string | null;
  completed_at: string | null;
  created_at: string;
  leads?: { first_name: string; last_name: string } | null;
  deals?: { name: string } | null;
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
}

const TASK_TYPES = [
  { id: "follow_up", label: "Follow Up", icon: Phone },
  { id: "email", label: "Email", icon: Mail },
  { id: "meeting", label: "Meeting", icon: Users },
  { id: "document", label: "Document", icon: FileText },
  { id: "other", label: "Other", icon: Circle },
];

const PRIORITIES = [
  { id: "low", label: "Low", color: "bg-blue-500/10 text-blue-500" },
  { id: "medium", label: "Medium", color: "bg-amber-500/10 text-amber-500" },
  { id: "high", label: "High", color: "bg-red-500/10 text-red-500" },
];

interface TaskManagerProps {
  leadId?: string;
  dealId?: string;
  workspaceId: string;
}

export function TaskManager({ leadId, dealId, workspaceId }: TaskManagerProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "today" | "overdue" | "completed">("all");
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "medium",
    task_type: "follow_up",
    lead_id: leadId || "",
  });

  useEffect(() => {
    fetchTasks();
    if (!leadId) fetchLeads();
  }, [leadId, dealId]);

  const fetchTasks = async () => {
    try {
      let query = supabase
        .from("tasks")
        .select("*, leads(first_name, last_name), deals(name)")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (leadId) query = query.eq("lead_id", leadId);
      if (dealId) query = query.eq("deal_id", dealId);

      const { data, error } = await query;
      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("id, first_name, last_name")
        .order("first_name");
      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title) {
      toast.error("Please enter a task title");
      return;
    }

    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("tasks").insert([{
        title: newTask.title,
        description: newTask.description || null,
        due_date: newTask.due_date || null,
        priority: newTask.priority,
        task_type: newTask.task_type,
        lead_id: newTask.lead_id || leadId || null,
        deal_id: dealId || null,
        created_by: user.user?.id,
        workspace_id: workspaceId,
      }]);

      if (error) throw error;

      toast.success("Task created");
      setShowNewTask(false);
      setNewTask({ title: "", description: "", due_date: "", priority: "medium", task_type: "follow_up", lead_id: "" });
      fetchTasks();
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleComplete = async (task: Task) => {
    try {
      const newStatus = task.status === "completed" ? "pending" : "completed";
      const { error } = await supabase
        .from("tasks")
        .update({ 
          status: newStatus,
          completed_at: newStatus === "completed" ? new Date().toISOString() : null
        })
        .eq("id", task.id);

      if (error) throw error;
      fetchTasks();
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === "completed") return task.status === "completed";
    if (filter === "today") return task.due_date && isToday(new Date(task.due_date)) && task.status !== "completed";
    if (filter === "overdue") return task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && task.status !== "completed";
    if (filter === "all") return task.status !== "completed";
    return true;
  });

  const getDueDateLabel = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    if (isToday(date)) return { label: "Today", color: "text-amber-500" };
    if (isTomorrow(date)) return { label: "Tomorrow", color: "text-blue-500" };
    if (isPast(date)) return { label: "Overdue", color: "text-red-500" };
    return { label: format(date, "MMM d"), color: "text-muted-foreground" };
  };

  const getTaskIcon = (type: string) => {
    const taskType = TASK_TYPES.find(t => t.id === type);
    const Icon = taskType?.icon || Circle;
    return <Icon className="h-4 w-4" />;
  };

  const todayCount = tasks.filter(t => t.due_date && isToday(new Date(t.due_date)) && t.status !== "completed").length;
  const overdueCount = tasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)) && t.status !== "completed").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Tasks
          </CardTitle>
          <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Follow up with client"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Task details..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input
                      type="datetime-local"
                      value={newTask.due_date}
                      onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newTask.task_type} onValueChange={(v) => setNewTask({ ...newTask, task_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_TYPES.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!leadId && (
                    <div className="space-y-2">
                      <Label>Lead</Label>
                      <Select value={newTask.lead_id} onValueChange={(v) => setNewTask({ ...newTask, lead_id: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select lead..." />
                        </SelectTrigger>
                        <SelectContent>
                          {leads.map(lead => (
                            <SelectItem key={lead.id} value={lead.id}>
                              {lead.first_name} {lead.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <Button onClick={handleCreateTask} disabled={saving} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Task
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="today" className="relative">
              Today
              {todayCount > 0 && (
                <Badge className="ml-1 h-5 w-5 p-0 justify-center">{todayCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="overdue" className="relative">
              Overdue
              {overdueCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 justify-center">{overdueCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <div className="space-y-2">
            {filteredTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No tasks found</p>
            ) : (
              filteredTasks.map(task => {
                const dueLabel = getDueDateLabel(task.due_date);
                const priority = PRIORITIES.find(p => p.id === task.priority);

                return (
                  <div
                    key={task.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      task.status === "completed" ? "bg-muted/30 opacity-60" : "hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={task.status === "completed"}
                      onCheckedChange={() => handleToggleComplete(task)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getTaskIcon(task.task_type)}
                        <span className={`font-medium ${task.status === "completed" ? "line-through" : ""}`}>
                          {task.title}
                        </span>
                        <Badge className={priority?.color}>{priority?.label}</Badge>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {dueLabel && (
                          <span className={`flex items-center gap-1 ${dueLabel.color}`}>
                            <Clock className="h-3 w-3" />
                            {dueLabel.label}
                          </span>
                        )}
                        {task.leads && (
                          <span>{task.leads.first_name} {task.leads.last_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}