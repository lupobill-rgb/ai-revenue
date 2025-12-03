import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarIcon, Clock, Bell, Check, Plus, Loader2 } from "lucide-react";
import { format, addDays, addHours, isAfter, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface FollowUpSchedulerProps {
  leadId: string;
  leadName: string;
  workspaceId: string;
  currentFollowUp?: string | null;
  onUpdate: () => void;
}

const QUICK_OPTIONS = [
  { label: "In 1 hour", getValue: () => addHours(new Date(), 1) },
  { label: "Tomorrow 9 AM", getValue: () => { const d = addDays(startOfDay(new Date()), 1); d.setHours(9); return d; } },
  { label: "In 3 days", getValue: () => addDays(new Date(), 3) },
  { label: "Next week", getValue: () => addDays(new Date(), 7) },
  { label: "In 2 weeks", getValue: () => addDays(new Date(), 14) },
];

const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"
];

export function FollowUpScheduler({ leadId, leadName, workspaceId, currentFollowUp, onUpdate }: FollowUpSchedulerProps) {
  const [date, setDate] = useState<Date | undefined>(currentFollowUp ? new Date(currentFollowUp) : undefined);
  const [time, setTime] = useState(currentFollowUp ? format(new Date(currentFollowUp), "HH:00") : "10:00");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);

  const handleSchedule = async () => {
    if (!date) {
      toast.error("Please select a date");
      return;
    }

    setSaving(true);
    try {
      const [hours, minutes] = time.split(":").map(Number);
      const followUpDate = new Date(date);
      followUpDate.setHours(hours, minutes, 0, 0);

      // Update lead with follow-up date
      const { error: updateError } = await supabase
        .from("leads")
        .update({ next_follow_up_at: followUpDate.toISOString() })
        .eq("id", leadId);

      if (updateError) throw updateError;

      // Create a task for the follow-up
      const { data: user } = await supabase.auth.getUser();
      const { error: taskError } = await supabase.from("tasks").insert({
        title: `Follow up with ${leadName}`,
        description: notes || `Scheduled follow-up for ${leadName}`,
        due_date: followUpDate.toISOString(),
        priority: "high",
        task_type: "follow_up",
        lead_id: leadId,
        created_by: user.user?.id,
        workspace_id: workspaceId,
      });

      if (taskError) throw taskError;

      // Log activity
      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        activity_type: "task",
        description: `Follow-up scheduled for ${format(followUpDate, "MMM d, yyyy 'at' h:mm a")}`,
        metadata: { follow_up_date: followUpDate.toISOString(), notes },
        workspace_id: workspaceId,
      });

      toast.success("Follow-up scheduled");
      setShowScheduler(false);
      setNotes("");
      onUpdate();
    } catch (error) {
      console.error("Error scheduling follow-up:", error);
      toast.error("Failed to schedule follow-up");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickSchedule = async (getDate: () => Date) => {
    const followUpDate = getDate();
    setSaving(true);
    
    try {
      const { error: updateError } = await supabase
        .from("leads")
        .update({ next_follow_up_at: followUpDate.toISOString() })
        .eq("id", leadId);

      if (updateError) throw updateError;

      const { data: user } = await supabase.auth.getUser();
      await supabase.from("tasks").insert({
        title: `Follow up with ${leadName}`,
        description: `Quick scheduled follow-up`,
        due_date: followUpDate.toISOString(),
        priority: "high",
        task_type: "follow_up",
        lead_id: leadId,
        created_by: user.user?.id,
        workspace_id: workspaceId,
      });

      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        activity_type: "task",
        description: `Follow-up scheduled for ${format(followUpDate, "MMM d, yyyy 'at' h:mm a")}`,
        workspace_id: workspaceId,
      });

      toast.success("Follow-up scheduled");
      onUpdate();
    } catch (error) {
      console.error("Error scheduling follow-up:", error);
      toast.error("Failed to schedule follow-up");
    } finally {
      setSaving(false);
    }
  };

  const handleClearFollowUp = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({ next_follow_up_at: null })
        .eq("id", leadId);

      if (error) throw error;

      toast.success("Follow-up cleared");
      setDate(undefined);
      onUpdate();
    } catch (error) {
      console.error("Error clearing follow-up:", error);
      toast.error("Failed to clear follow-up");
    } finally {
      setSaving(false);
    }
  };

  const isOverdue = currentFollowUp && isBefore(new Date(currentFollowUp), new Date());
  const isUpcoming = currentFollowUp && isAfter(new Date(currentFollowUp), new Date());

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          Follow-up Scheduling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentFollowUp && (
          <div className={cn(
            "p-3 rounded-lg border flex items-center justify-between",
            isOverdue ? "bg-red-500/10 border-red-500/20" : "bg-green-500/10 border-green-500/20"
          )}>
            <div className="flex items-center gap-2">
              <Clock className={cn("h-4 w-4", isOverdue ? "text-red-500" : "text-green-500")} />
              <div>
                <p className="text-sm font-medium">
                  {format(new Date(currentFollowUp), "MMM d, yyyy 'at' h:mm a")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isOverdue ? "Overdue" : "Upcoming follow-up"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant={isOverdue ? "destructive" : "default"}>
                {isOverdue ? "Overdue" : "Scheduled"}
              </Badge>
              <Button variant="ghost" size="sm" onClick={handleClearFollowUp} disabled={saving}>
                Clear
              </Button>
            </div>
          </div>
        )}

        {!showScheduler ? (
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Quick Schedule</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_OPTIONS.map((option) => (
                <Button
                  key={option.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSchedule(option.getValue)}
                  disabled={saving}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => setShowScheduler(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Custom Date & Time
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(date) => isBefore(date, startOfDay(new Date()))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Time</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {format(new Date(`2000-01-01T${slot}`), "h:mm a")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this follow-up..."
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowScheduler(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSchedule} disabled={saving || !date} className="flex-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Schedule
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
