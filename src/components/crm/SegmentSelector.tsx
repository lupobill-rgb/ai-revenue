import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { SegmentBadge } from "./SegmentBadge";

interface Segment {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string;
}

interface SegmentSelectorProps {
  value?: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
}

export function SegmentSelector({ value, onValueChange, placeholder = "Select segment" }: SegmentSelectorProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    const { data, error } = await supabase
      .from("tenant_segments")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    if (!error && data) {
      setSegments(data);
    }
    setLoading(false);
  };

  const selectedSegment = segments.find(s => s.code === value);

  return (
    <Select 
      value={value || ""} 
      onValueChange={(v) => onValueChange(v === "" ? null : v)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {selectedSegment ? (
            <SegmentBadge 
              code={selectedSegment.code} 
              name={selectedSegment.name} 
              color={selectedSegment.color}
              size="sm"
            />
          ) : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">
          <span className="text-muted-foreground">No segment</span>
        </SelectItem>
        {segments.map((segment) => (
          <SelectItem key={segment.id} value={segment.code}>
            <div className="flex items-center gap-2">
              <SegmentBadge 
                code={segment.code} 
                name={segment.name} 
                color={segment.color}
                size="sm"
              />
              {segment.description && (
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {segment.description}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
