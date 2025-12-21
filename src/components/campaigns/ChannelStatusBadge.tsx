/**
 * ChannelStatusBadge - Displays honest channel status
 * Enforces UX contract for channel availability
 */

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Clock, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChannelStatus = "connected" | "not_configured" | "coming_soon" | "blocked";

interface ChannelStatusBadgeProps {
  channel: string;
  status: ChannelStatus;
  message?: string;
  className?: string;
}

const statusConfig: Record<ChannelStatus, {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  icon: React.ElementType;
  className: string;
}> = {
  connected: {
    label: "Connected",
    variant: "default",
    icon: CheckCircle2,
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
  },
  not_configured: {
    label: "Not Configured",
    variant: "outline",
    icon: AlertCircle,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  coming_soon: {
    label: "Coming Soon",
    variant: "secondary",
    icon: Clock,
    className: "bg-muted text-muted-foreground",
  },
  blocked: {
    label: "Blocked",
    variant: "destructive",
    icon: Ban,
    className: "",
  },
};

// Channels that are permanently "Coming Soon" until real provider integration exists
const COMING_SOON_CHANNELS = ["instagram", "facebook", "twitter", "tiktok"];

export function getChannelStatus(channel: string, isConnected: boolean): ChannelStatus {
  const normalizedChannel = channel.toLowerCase();
  
  // Social channels are always "Coming Soon" until real integration exists
  if (COMING_SOON_CHANNELS.includes(normalizedChannel)) {
    return "coming_soon";
  }
  
  return isConnected ? "connected" : "not_configured";
}

export function ChannelStatusBadge({
  channel,
  status,
  message,
  className,
}: ChannelStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn("flex items-center gap-1 font-normal", config.className, className)}
      title={message}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export function SocialComingSoonBadge() {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-muted">
      <Clock className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm font-medium text-muted-foreground">Coming Soon</p>
        <p className="text-xs text-muted-foreground">
          Social media integration is in development. Real provider connections will be available in a future release.
        </p>
      </div>
    </div>
  );
}

export default ChannelStatusBadge;
