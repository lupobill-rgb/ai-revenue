import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Mail, Video, Megaphone, Globe, Phone } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  parseISO,
  isToday,
} from "date-fns";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  channel: string;
  scheduled_at: string;
  status: string;
}

interface CampaignCalendarProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-3 w-3" />,
  video: <Video className="h-3 w-3" />,
  social: <Megaphone className="h-3 w-3" />,
  landing_page: <Globe className="h-3 w-3" />,
  voice: <Phone className="h-3 w-3" />,
};

const CHANNEL_COLORS: Record<string, string> = {
  email: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  video: "bg-purple-500/20 text-purple-500 border-purple-500/30",
  social: "bg-pink-500/20 text-pink-500 border-pink-500/30",
  landing_page: "bg-green-500/20 text-green-500 border-green-500/30",
  voice: "bg-amber-500/20 text-amber-500 border-amber-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500",
  published: "bg-green-500",
  draft: "bg-muted-foreground",
  failed: "bg-red-500",
};

export default function CampaignCalendar({ events, onEventClick }: CampaignCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState<"month" | "week">("month");

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => {
      const eventDate = parseISO(event.scheduled_at);
      return isSameDay(eventDate, day);
    });
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) =>
      direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Campaign Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Select value={view} onValueChange={(v) => setView(v as "month" | "week")}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="week">Week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigateMonth("prev")}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-semibold min-w-[180px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => navigateMonth("next")}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {Object.entries(CHANNEL_ICONS).map(([channel, icon]) => (
              <div key={channel} className="flex items-center gap-1">
                {icon}
                <span className="capitalize">{channel.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={index}
                className={cn(
                  "min-h-[100px] p-1 rounded-lg border border-transparent transition-colors",
                  isCurrentMonth ? "bg-card" : "bg-muted/30",
                  isCurrentDay && "border-primary bg-primary/5",
                  "hover:bg-muted/50"
                )}
              >
                <div
                  className={cn(
                    "text-sm font-medium mb-1 text-center rounded-full w-7 h-7 flex items-center justify-center mx-auto",
                    !isCurrentMonth && "text-muted-foreground/50",
                    isCurrentDay && "bg-primary text-primary-foreground"
                  )}
                >
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border cursor-pointer truncate flex items-center gap-1",
                        CHANNEL_COLORS[event.channel] || "bg-muted text-muted-foreground"
                      )}
                      onClick={() => onEventClick?.(event)}
                      title={event.title}
                    >
                      {CHANNEL_ICONS[event.channel]}
                      <span className="truncate">{event.title}</span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground text-center">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", color)} />
              <span className="text-xs text-muted-foreground capitalize">{status}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
