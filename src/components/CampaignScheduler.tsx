import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock } from "lucide-react";

interface ScheduleConfig {
  days: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  timesOfDay: ("morning" | "midday" | "afternoon" | "evening")[];
  timezone: string;
}

interface CampaignSchedulerProps {
  value: ScheduleConfig;
  onChange: (config: ScheduleConfig) => void;
}

const DAYS_OF_WEEK = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
] as const;

const TIME_SLOTS = [
  { value: "morning", label: "Morning (8 AM - 11 AM)", description: "Best for B2B outreach" },
  { value: "midday", label: "Midday (11 AM - 2 PM)", description: "High engagement period" },
  { value: "afternoon", label: "Afternoon (2 PM - 5 PM)", description: "Good for follow-ups" },
  { value: "evening", label: "Evening (5 PM - 8 PM)", description: "Consumer-focused campaigns" },
] as const;

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "UTC", label: "UTC" },
];

export const DEFAULT_SCHEDULE: ScheduleConfig = {
  days: {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  },
  timesOfDay: ["midday"],
  timezone: "America/New_York",
};

export function CampaignScheduler({ value, onChange }: CampaignSchedulerProps) {
  const toggleDay = (day: keyof ScheduleConfig["days"]) => {
    onChange({
      ...value,
      days: {
        ...value.days,
        [day]: !value.days[day],
      },
    });
  };

  const selectWeekdays = () => {
    onChange({
      ...value,
      days: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      },
    });
  };

  const selectAllDays = () => {
    onChange({
      ...value,
      days: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
      },
    });
  };

  const selectedDaysCount = Object.values(value.days).filter(Boolean).length;

  return (
    <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-primary" />
        <Label className="text-sm font-semibold">Campaign Schedule</Label>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Choose when your campaign content should be sent
      </p>

      {/* Days of Week */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Active Days</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectWeekdays}
              className="text-xs text-primary hover:underline"
            >
              Weekdays
            </button>
            <span className="text-muted-foreground">|</span>
            <button
              type="button"
              onClick={selectAllDays}
              className="text-xs text-primary hover:underline"
            >
              All Days
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day.key}
              type="button"
              onClick={() => toggleDay(day.key)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors border ${
                value.days[day.key]
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {selectedDaysCount === 0
            ? "No days selected"
            : `${selectedDaysCount} day${selectedDaysCount > 1 ? "s" : ""} selected`}
        </p>
      </div>

      {/* Time of Day - Multi-select */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm">Times of Day</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {value.timesOfDay.length === 0
              ? "Select at least one"
              : `${value.timesOfDay.length} time${value.timesOfDay.length > 1 ? "s" : ""} selected`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TIME_SLOTS.map((slot) => {
            const isSelected = value.timesOfDay.includes(slot.value);
            return (
              <button
                key={slot.value}
                type="button"
                onClick={() => {
                  const newTimes = isSelected
                    ? value.timesOfDay.filter((t) => t !== slot.value)
                    : [...value.timesOfDay, slot.value];
                  onChange({ ...value, timesOfDay: newTimes });
                }}
                className={`p-3 rounded-md text-left transition-colors border ${
                  isSelected
                    ? "bg-primary/10 border-primary text-foreground"
                    : "bg-background border-border hover:border-primary/50 text-muted-foreground"
                }`}
              >
                <p className="text-sm font-medium">{slot.label}</p>
                <p className="text-xs text-muted-foreground">{slot.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Timezone */}
      <div className="space-y-2">
        <Label className="text-sm">Timezone</Label>
        <Select
          value={value.timezone}
          onValueChange={(tz) => onChange({ ...value, timezone: tz })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export type { ScheduleConfig };
