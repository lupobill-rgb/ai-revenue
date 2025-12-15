import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { SegmentBadge } from "./SegmentBadge";

interface Segment {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string;
}

interface CampaignSegmentFilterProps {
  selectedCodes: string[];
  onSelectionChange: (codes: string[]) => void;
}

export function CampaignSegmentFilter({ selectedCodes, onSelectionChange }: CampaignSegmentFilterProps) {
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

  const toggleSegment = (code: string) => {
    if (selectedCodes.includes(code)) {
      onSelectionChange(selectedCodes.filter(c => c !== code));
    } else {
      onSelectionChange([...selectedCodes, code]);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading segments...</div>;
  }

  if (segments.length === 0) {
    return <div className="text-sm text-muted-foreground">No segments configured</div>;
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Target Segments</Label>
      <p className="text-xs text-muted-foreground">
        Select which segments this campaign should target. Leave empty to target all contacts.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {segments.map((segment) => (
          <div 
            key={segment.id} 
            className="flex items-center gap-2 p-2 rounded border border-border hover:bg-accent/50 cursor-pointer"
            onClick={() => toggleSegment(segment.code)}
          >
            <Checkbox 
              checked={selectedCodes.includes(segment.code)}
              onCheckedChange={() => toggleSegment(segment.code)}
            />
            <SegmentBadge 
              code={segment.code} 
              name={segment.name} 
              color={segment.color}
              size="sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
