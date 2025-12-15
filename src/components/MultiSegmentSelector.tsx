import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Segment {
  id: string;
  name: string;
  description?: string;
}

interface MultiSegmentSelectorProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  placeholder?: string;
  showLeadCounts?: boolean;
}

export function MultiSegmentSelector({
  selectedIds,
  onSelectionChange,
  placeholder = "Select segments",
  showLeadCounts = true,
}: MultiSegmentSelectorProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSegments();
  }, []);

  useEffect(() => {
    if (showLeadCounts && selectedIds.length > 0) {
      fetchLeadCounts();
    }
  }, [selectedIds, showLeadCounts]);

  const fetchSegments = async () => {
    const { data, error } = await supabase
      .from("segments")
      .select("id, name, description")
      .order("name");

    if (!error && data) {
      setSegments(data);
    }
    setLoading(false);
  };

  const fetchLeadCounts = async () => {
    if (selectedIds.length === 0) return;
    
    const counts: Record<string, number> = {};
    
    // Fetch contact counts for each selected segment
    for (const segmentId of selectedIds) {
      try {
        const response = await (supabase as any)
          .from("crm_contacts")
          .select("id", { count: "exact", head: true })
          .eq("segment_id", segmentId);
        
        counts[segmentId] = response.count || 0;
      } catch {
        counts[segmentId] = 0;
      }
    }
    
    setLeadCounts(counts);
  };

  const toggleSegment = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((s) => s !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const removeSegment = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selectedIds.filter((s) => s !== id));
  };

  const selectedSegments = segments.filter((s) => selectedIds.includes(s.id));
  const totalLeads = Object.values(leadCounts).reduce((sum, count) => sum + count, 0);

  if (loading) {
    return (
      <div className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
        Loading segments...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-background border-input hover:bg-accent min-h-10 h-auto py-2"
          >
            <div className="flex flex-wrap gap-1 flex-1">
              {selectedSegments.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                selectedSegments.map((segment) => (
                  <Badge
                    key={segment.id}
                    variant="secondary"
                    className="mr-1 mb-1"
                  >
                    {segment.name}
                    <button
                      className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          removeSegment(segment.id, e as unknown as React.MouseEvent);
                        }
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => removeSegment(segment.id, e)}
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full min-w-[300px] p-0" align="start">
          <div className="max-h-64 overflow-auto p-2">
            {segments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No segments available
              </p>
            ) : (
              segments.map((segment) => {
                const isSelected = selectedIds.includes(segment.id);
                const count = leadCounts[segment.id] || 0;
                
                return (
                  <div
                    key={segment.id}
                    className={cn(
                      "flex items-center space-x-3 rounded-md px-3 py-2 cursor-pointer hover:bg-accent",
                      isSelected && "bg-accent"
                    )}
                    onClick={() => toggleSegment(segment.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSegment(segment.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{segment.name}</p>
                      {segment.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {segment.description}
                        </p>
                      )}
                    </div>
                    {showLeadCounts && isSelected && count > 0 && (
                      <Badge variant="outline" className="shrink-0">
                        <Users className="h-3 w-3 mr-1" />
                        {count}
                      </Badge>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {showLeadCounts && selectedIds.length > 0 && totalLeads > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>
            {totalLeads} lead{totalLeads !== 1 ? "s" : ""} in selected segment{selectedIds.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
