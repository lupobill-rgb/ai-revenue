import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Mail, Share2, Video, Phone, Calendar as CalendarIcon, Clock, Send, Trash2, Database } from "lucide-react";
import { format, isSameDay, startOfMonth, endOfMonth } from "date-fns";
import { Json } from "@/integrations/supabase/types";
import { SAMPLE_CONTENT_CALENDAR } from "@/lib/sampleData";

interface ContentItem {
  id: string;
  title: string;
  content_type: string;
  channel: string | null;
  scheduled_at: string;
  published_at: string | null;
  status: string;
  asset_id: string | null;
  content: Json;
}

interface ContentCalendarProps {
  workspaceId: string;
}

const contentTypeIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  social: <Share2 className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  voice: <Phone className="h-4 w-4" />,
};

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  published: "bg-green-500/20 text-green-400 border-green-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground",
};

export default function ContentCalendar({ workspaceId }: ContentCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSampleData, setShowSampleData] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newContent, setNewContent] = useState({
    title: "",
    content_type: "email",
    channel: "",
    scheduled_at: "",
    description: "",
  });

  useEffect(() => {
    if (showSampleData) {
      setContentItems(SAMPLE_CONTENT_CALENDAR as ContentItem[]);
      setLoading(false);
    } else {
      fetchContent();
    }
  }, [selectedDate, workspaceId, showSampleData]);

  const fetchContent = async () => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);

    const { data, error } = await supabase
      .from("content_calendar")
      .select("*")
      .eq("workspace_id", workspaceId)
      .gte("scheduled_at", start.toISOString())
      .lte("scheduled_at", end.toISOString())
      .order("scheduled_at", { ascending: true });

    if (error) {
      toast.error("Failed to load calendar");
      console.error(error);
    } else {
      setContentItems((data as ContentItem[]) || []);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newContent.title || !newContent.scheduled_at) {
      toast.error("Please fill in all required fields");
      return;
    }

    const { error } = await supabase.from("content_calendar").insert({
      title: newContent.title,
      content_type: newContent.content_type,
      channel: newContent.channel || null,
      scheduled_at: new Date(newContent.scheduled_at).toISOString(),
      content: { description: newContent.description },
      workspace_id: workspaceId,
    });

    if (error) {
      toast.error("Failed to schedule content");
    } else {
      toast.success("Content scheduled!");
      setDialogOpen(false);
      setNewContent({ title: "", content_type: "email", channel: "", scheduled_at: "", description: "" });
      fetchContent();
    }
  };

  const handlePublishNow = async (contentId: string) => {
    try {
      const { error } = await supabase.functions.invoke("publish-scheduled-content", {
        body: { contentId, action: "publish_now" },
      });

      if (error) throw error;
      toast.success("Content published!");
      fetchContent();
    } catch (e) {
      toast.error("Failed to publish content");
    }
  };

  const handleDelete = async (contentId: string) => {
    const { error } = await supabase.from("content_calendar").delete().eq("id", contentId);

    if (error) {
      toast.error("Failed to delete");
    } else {
      toast.success("Content removed");
      fetchContent();
    }
  };

  const selectedDateContent = contentItems.filter((item) =>
    isSameDay(new Date(item.scheduled_at), selectedDate)
  );

  const datesWithContent = contentItems.map((item) => new Date(item.scheduled_at));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Content Calendar
            </CardTitle>
            <CardDescription>Schedule and manage content across channels</CardDescription>
          </div>
          <div className="flex items-center gap-3 bg-muted/50 px-3 py-1.5 rounded-lg border border-border">
            <Database className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="sample-data-calendar" className="text-sm font-medium cursor-pointer">
              Demo
            </Label>
            <Switch
              id="sample-data-calendar"
              checked={showSampleData}
              onCheckedChange={setShowSampleData}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showSampleData && (
          <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary flex items-center gap-2">
            <Database className="h-4 w-4" />
            Showing sample demo data. Toggle off to view real content.
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calendar */}
          <div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              modifiers={{
                hasContent: datesWithContent,
              }}
              modifiersStyles={{
                hasContent: { fontWeight: "bold", textDecoration: "underline" },
              }}
              className="rounded-md border"
            />
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Content
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule New Content</DialogTitle>
                  <DialogDescription>Add content to your calendar for automated publishing</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={newContent.title}
                      onChange={(e) => setNewContent({ ...newContent, title: e.target.value })}
                      placeholder="e.g., Weekly Newsletter"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Content Type</Label>
                      <Select
                        value={newContent.content_type}
                        onValueChange={(v) => setNewContent({ ...newContent, content_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="social">Social Media</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="voice">Voice</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Channel</Label>
                      <Input
                        value={newContent.channel}
                        onChange={(e) => setNewContent({ ...newContent, channel: e.target.value })}
                        placeholder="e.g., LinkedIn"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Scheduled Date & Time</Label>
                    <Input
                      type="datetime-local"
                      value={newContent.scheduled_at}
                      onChange={(e) => setNewContent({ ...newContent, scheduled_at: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={newContent.description}
                      onChange={(e) => setNewContent({ ...newContent, description: e.target.value })}
                      placeholder="Brief description or notes..."
                    />
                  </div>
                  <Button onClick={handleCreate} className="w-full">
                    Schedule Content
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Selected Date Content */}
          <div>
            <h3 className="font-semibold mb-2">{format(selectedDate, "EEEE, MMMM d, yyyy")}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {selectedDateContent.length} item{selectedDateContent.length !== 1 ? "s" : ""} scheduled
            </p>
            <ScrollArea className="h-[300px]">
              {selectedDateContent.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No content scheduled</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateContent.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          {contentTypeIcons[item.content_type] || <CalendarIcon className="h-4 w-4" />}
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">{item.title}</h4>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(item.scheduled_at), "h:mm a")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${statusColors[item.status]}`}>
                          {item.status}
                        </Badge>
                        {item.status === "scheduled" && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handlePublishNow(item.id)}>
                            <Send className="h-3 w-3" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
