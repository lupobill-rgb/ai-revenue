import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Phone,
  Mail,
  MessageSquare,
  UserCheck,
  ArrowRight,
  Calendar,
  FileText,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Activity {
  id: string;
  lead_id: string;
  activity_type: string;
  description: string;
  created_at: string;
  metadata?: unknown;
}

interface LeadTimelineProps {
  leadId: string;
  workspaceId: string;
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  note: MessageSquare,
  status_change: ArrowRight,
  meeting: Calendar,
  task: FileText,
  qualification: UserCheck,
};

const ACTIVITY_COLORS: Record<string, string> = {
  call: "bg-blue-500",
  email: "bg-purple-500",
  note: "bg-yellow-500",
  status_change: "bg-green-500",
  meeting: "bg-pink-500",
  task: "bg-orange-500",
  qualification: "bg-emerald-500",
};

export default function LeadTimeline({ leadId, workspaceId }: LeadTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [newActivity, setNewActivity] = useState({
    type: "note",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, [leadId]);

  const fetchActivities = async () => {
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
      const { error } = await supabase.from("lead_activities").insert({
        lead_id: leadId,
        activity_type: newActivity.type,
        description: newActivity.description,
        workspace_id: workspaceId,
      });

      if (error) throw error;

      toast.success("Activity added");
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

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading activities...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Activity Timeline</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddActivity(!showAddActivity)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Activity
        </Button>
      </div>

      {showAddActivity && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <Select
            value={newActivity.type}
            onValueChange={(value) => setNewActivity({ ...newActivity, type: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Activity type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="note">Note</SelectItem>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="meeting">Meeting</SelectItem>
              <SelectItem value="task">Task</SelectItem>
            </SelectContent>
          </Select>

          <Textarea
            placeholder="Describe the activity..."
            value={newActivity.description}
            onChange={(e) =>
              setNewActivity({ ...newActivity, description: e.target.value })
            }
            rows={3}
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddActivity(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddActivity} disabled={submitting}>
              {submitting ? "Adding..." : "Add"}
            </Button>
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No activities recorded yet
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.activity_type] || MessageSquare;
              const color = ACTIVITY_COLORS[activity.activity_type] || "bg-gray-500";

              return (
                <div key={activity.id} className="relative pl-10">
                  <div
                    className={`absolute left-2 w-5 h-5 rounded-full ${color} flex items-center justify-center`}
                  >
                    <Icon className="h-3 w-3 text-white" />
                  </div>

                  <div className="border rounded-lg p-3 bg-card">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-medium uppercase text-muted-foreground">
                          {activity.activity_type.replace("_", " ")}
                        </span>
                        <p className="mt-1 text-sm">{activity.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {format(new Date(activity.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
