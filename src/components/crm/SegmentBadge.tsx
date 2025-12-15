import { Badge } from "@/components/ui/badge";

interface SegmentBadgeProps {
  code: string;
  name?: string;
  color?: string;
  size?: "sm" | "default";
}

export function SegmentBadge({ code, name, color = "#6B7280", size = "default" }: SegmentBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`${size === "sm" ? "text-xs px-1.5 py-0" : ""}`}
      style={{ 
        borderColor: color, 
        color: color,
        backgroundColor: `${color}15`
      }}
    >
      {name || code}
    </Badge>
  );
}
