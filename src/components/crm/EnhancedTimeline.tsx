import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  Phone, Mail, MessageSquare, UserCheck, ArrowRight, Calendar, FileText,
  Plus, Filter, Clock, Video, DollarSign, Star, Bell, Loader2, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  lead_id: string;
  activity_type: string;
  description: string;
  created_at: string;
  metadata?: unknown;
}

interface EnhancedTimelineProps {
  leadId: string;
  workspaceId: string;
}

const ACTIVITY_CONFIG: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  call: { icon: Phone, color: "text-blue-500", bgColor: "bg-blue-500", label: "Call" },
  email: { icon: Mail, color: "text-purple-500", bgColor: "bg-purple-500", label: "Email" },
  email_reply: { icon: Mail, color: "text-green-500", bgColor: "bg-green-500", label: "Email Reply" },
  email_replied: { icon: Mail, color: "text-green-500", bgColor: "bg-green-500", label: "Email Reply" },
  note: { icon: MessageSquare, color: "text-amber-500", bgColor: "bg-amber-500", label: "Note" },
  status_change: { icon: ArrowRight, color: "text-green-500", bgColor: "bg-green-500", label: "Status Change" },
  meeting: { icon: Calendar, color: "text-pink-500", bgColor: "bg-pink-500", label: "Meeting" },
  task: { icon: FileText, color: "text-orange-500", bgColor: "bg-orange-500", label: "Task" },
  qualification: { icon: UserCheck, color: "text-emerald-500", bgColor: "bg-emerald-500", label: "Qualification" },
  video_call: { icon: Video, color: "text-indigo-500", bgColor: "bg-indigo-500", label: "Video Call" },
  deal: { icon: DollarSign, color: "text-green-600", bgColor: "bg-green-600", label: "Deal" },
  score_change: { icon: Star, color: "text-yellow-500", bgColor: "bg-yellow-500", label: "Score Change" },
  follow_up: { icon: Bell, color: "text-red-500", bgColor: "bg-red-500", label: "Follow-up" },
  sequence_paused_on_reply: { icon: Bell, color: "text-amber-500", bgColor: "bg-amber-500", label: "Sequence Paused" },
  sequence_resumed: { icon: RefreshCw, color: "text-cyan-500", bgColor: "bg-cyan-500", label: "Sequence Resumed" },
};

const ACTIVITY_TYPES = [
  { value: "all", label: "All Activities" },
  { value: "note", label: "Notes" },
  { value: "call", label: "Calls" },
  { value: "email", label: "Emails" },
  { value: "email_reply", label: "Email Replies" },
  { value: "meeting", label: "Meetings" },
  { value: "task", label: "Tasks" },
  { value: "status_change", label: "Status Changes" },
  { value: "sequence_paused_on_reply", label: "Sequence Paused" },
  { value: "sequence_resumed", label: "Sequence Resumed" },
];

const NEW_ACTIVITY_TYPES = [
  { value: "note", label: "Note", icon: MessageSquare },
  { value: "call", label: "Call", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Meeting", icon: Calendar },
  { value: "video_call", label: "Video Call", icon: Video },
];

export function EnhancedTimeline({ leadId, workspaceId }: EnhancedTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [newActivity, setNewActivity] = useState({ type: "note", description: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, [leadId]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error("Error fetching activities:", error);
      toast.error("Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  const handleAddActivity = async () => {
    if (!newActivity.description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    setSubmitting(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("lead_activities").insert({
        lead_id: leadId,
        activity_type: newActivity.type,
        description: newActivity.description,
        created_by: user.user?.id,
        workspace_id: workspaceId,
      });

      if (error) throw error;

      // Update last_contacted_at if it's a contact activity
      if (["call", "email", "meeting", "video_call"].includes(newActivity.type)) {
        await supabase
          .from("leads")
          .update({ last_contacted_at: new Date().toISOString() })
          .eq("id", leadId);
      }

      toast.success("Activity logged");
      setNewActivity({ type: "note", description: "" });
      setShowAddActivity(false);
      fetchActivities();
    } catch (error) {
      console.error("Error adding activity:", error);
      toast.error("Failed to add activity");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredActivities = filter === "all" 
    ? activities 
    : activities.filter(a => a.activity_type === filter);

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMMM d, yyyy");
  };

  // Group activities by date
  const groupedActivities = filteredActivities.reduce((groups, activity) => {
    const dateLabel = getDateLabel(activity.created_at);
    if (!groups[dateLabel]) groups[dateLabel] = [];
    groups[dateLabel].push(activity);
    return groups;
  }, {} as Record<string, Activity[]>);

  const activityCount = activities.length;
  const recentActivityCount = activities.filter(a => 
    isToday(new Date(a.created_at)) || isYesterday(new Date(a.created_at))
  ).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Activity Timeline
            </CardTitle>
            <Badge variant="secondary">{activityCount} total</Badge>
            {recentActivityCount > 0 && (
              <Badge variant="outline" className="text-green-500 border-green-500/20">
                {recentActivityCount} recent
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={fetchActivities} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setShowAddActivity(!showAddActivity)}>
              <Plus className="h-4 w-4 mr-1" />
              Log Activity
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showAddActivity && (
          <div className="mb-6 p-4 rounded-lg border bg-muted/30 space-y-3">
            <div className="flex gap-2">
              {NEW_ACTIVITY_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = newActivity.type === type.value;
                return (
                  <Button
                    key={type.value}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewActivity({ ...newActivity, type: type.value })}
                    className="gap-1"
                  >
                    <Icon className="h-4 w-4" />
                    {type.label}
                  </Button>
                );
              })}
            </div>

            <Textarea
              placeholder={`Describe the ${newActivity.type}...`}
              value={newActivity.description}
              onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
              rows={3}
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddActivity(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddActivity} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Log Activity
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No activities recorded yet</p>
            <p className="text-sm">Log your first activity to start tracking engagement</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-6">
              {Object.entries(groupedActivities).map(([dateLabel, dateActivities]) => (
                <div key={dateLabel}>
                  <div className="sticky top-0 bg-background py-2 z-10">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {dateLabel}
                    </span>
                  </div>
                  
                  <div className="relative pl-6">
                    <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-border" />
                    
                    <div className="space-y-4">
                      {dateActivities.map((activity) => {
                        const config = ACTIVITY_CONFIG[activity.activity_type] || ACTIVITY_CONFIG.note;
                        const Icon = config.icon;
                        
                        return (
                          <div key={activity.id} className="relative">
                            <div className={cn(
                              "absolute -left-4 w-6 h-6 rounded-full flex items-center justify-center",
                              config.bgColor
                            )}>
                              <Icon className="h-3 w-3 text-white" />
                            </div>
                            
                            <div className="ml-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className={cn("text-xs", config.color)}>
                                      {config.label}
                                    </Badge>
                                  </div>
                                  <p className="text-sm">{activity.description}</p>
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {format(new Date(activity.created_at), "h:mm a")}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
