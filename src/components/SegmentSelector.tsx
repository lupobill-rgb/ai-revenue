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
  code: string;
  name: string;
  description?: string;
  color?: string;
}

interface SegmentSelectorProps {
  selectedCodes: string[];
  onSelectionChange: (codes: string[]) => void;
  placeholder?: string;
  workspaceId?: string;
}

export function SegmentSelector({
  selectedCodes,
  onSelectionChange,
  placeholder = "Select segments to target",
  workspaceId,
}: SegmentSelectorProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    const { data, error } = await supabase
      .from("tenant_segments")
      .select("id, code, name, description, color")
      .eq("is_active", true)
      .order("sort_order");

    if (!error && data) {
      setSegments(data);
    }
    setLoading(false);
  };

  const toggleSegment = (code: string) => {
    if (selectedCodes.includes(code)) {
      onSelectionChange(selectedCodes.filter((c) => c !== code));
    } else {
      onSelectionChange([...selectedCodes, code]);
    }
  };

  const removeSegment = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selectedCodes.filter((c) => c !== code));
  };

  const selectedSegments = segments.filter((s) => selectedCodes.includes(s.code));

  if (loading) {
    return (
      <div className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
        Loading segments...
      </div>
    );
  }

  return (
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
                  key={segment.code}
                  variant="secondary"
                  className="mr-1 mb-1"
                  style={segment.color ? { 
                    backgroundColor: `${segment.color}20`, 
                    borderColor: `${segment.color}40`,
                    color: segment.color 
                  } : undefined}
                >
                  {segment.name}
                  <button
                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        removeSegment(segment.code, e as unknown as React.MouseEvent);
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => removeSegment(segment.code, e)}
                  >
                    <X className="h-3 w-3 hover:opacity-70" />
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
              const isSelected = selectedCodes.includes(segment.code);
              
              return (
                <div
                  key={segment.code}
                  className={cn(
                    "flex items-center space-x-3 rounded-md px-3 py-2 cursor-pointer hover:bg-accent",
                    isSelected && "bg-accent"
                  )}
                  onClick={() => toggleSegment(segment.code)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSegment(segment.code)}
                  />
                  <div 
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: segment.color || '#6B7280' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{segment.name}</p>
                    {segment.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {segment.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {selectedCodes.length > 0 && (
          <div className="border-t p-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-xs"
              onClick={() => {
                onSelectionChange([]);
                setOpen(false);
              }}
            >
              Clear selection (send to all)
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}