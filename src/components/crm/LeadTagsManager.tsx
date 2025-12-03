import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tags, X, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadTagsManagerProps {
  leadId: string;
  workspaceId: string;
  currentTags: string[] | null;
  onUpdate: () => void;
}

const SUGGESTED_TAGS = [
  { name: "Hot Lead", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  { name: "Decision Maker", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { name: "Budget Approved", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  { name: "Needs Demo", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { name: "Referral", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { name: "Enterprise", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  { name: "SMB", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
  { name: "Follow Up", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  { name: "Priority", color: "bg-pink-500/10 text-pink-500 border-pink-500/20" },
  { name: "Competitor", color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
];

const getTagColor = (tag: string) => {
  const suggested = SUGGESTED_TAGS.find(t => t.name.toLowerCase() === tag.toLowerCase());
  if (suggested) return suggested.color;
  
  // Generate consistent color based on tag name
  const colors = [
    "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "bg-green-500/10 text-green-500 border-green-500/20",
    "bg-purple-500/10 text-purple-500 border-purple-500/20",
    "bg-amber-500/10 text-amber-500 border-amber-500/20",
    "bg-pink-500/10 text-pink-500 border-pink-500/20",
    "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  ];
  const index = tag.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
};

export function LeadTagsManager({ leadId, workspaceId, currentTags, onUpdate }: LeadTagsManagerProps) {
  const [tags, setTags] = useState<string[]>(currentTags || []);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const saveTags = async (updatedTags: string[]) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({ tags: updatedTags })
        .eq("id", leadId);

      if (error) throw error;
      
      setTags(updatedTags);
      onUpdate();
    } catch (error) {
      console.error("Error updating tags:", error);
      toast.error("Failed to update tags");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = async () => {
    const trimmedTag = newTag.trim();
    if (!trimmedTag) return;
    
    if (tags.includes(trimmedTag)) {
      toast.error("Tag already exists");
      return;
    }

    const updatedTags = [...tags, trimmedTag];
    await saveTags(updatedTags);
    setNewTag("");
    
    // Log activity
    await supabase.from("lead_activities").insert({
      lead_id: leadId,
      activity_type: "note",
      description: `Tag added: ${trimmedTag}`,
      workspace_id: workspaceId,
    });
    
    toast.success("Tag added");
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updatedTags = tags.filter(t => t !== tagToRemove);
    await saveTags(updatedTags);
    
    await supabase.from("lead_activities").insert({
      lead_id: leadId,
      activity_type: "note",
      description: `Tag removed: ${tagToRemove}`,
      workspace_id: workspaceId,
    });
    
    toast.success("Tag removed");
  };

  const handleAddSuggestedTag = async (tag: string) => {
    if (tags.includes(tag)) {
      toast.error("Tag already exists");
      return;
    }

    const updatedTags = [...tags, tag];
    await saveTags(updatedTags);
    
    await supabase.from("lead_activities").insert({
      lead_id: leadId,
      activity_type: "note",
      description: `Tag added: ${tag}`,
      workspace_id: workspaceId,
    });
    
    toast.success("Tag added");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const unusedSuggestions = SUGGESTED_TAGS.filter(
    t => !tags.some(tag => tag.toLowerCase() === t.name.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Tags className="h-4 w-4 text-primary" />
          Lead Tags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Tags */}
        <div className="flex flex-wrap gap-2 min-h-[32px]">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tags yet</p>
          ) : (
            tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className={cn("pr-1 gap-1", getTagColor(tag))}
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                  disabled={saving}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {/* Add New Tag */}
        <div className="flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a tag..."
            className="flex-1"
          />
          <Button onClick={handleAddTag} disabled={!newTag.trim() || saving} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Suggested Tags */}
        <div className="space-y-2">
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showSuggestions ? "Hide suggestions" : "Show suggested tags"}
          </button>
          
          {showSuggestions && unusedSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {unusedSuggestions.map((suggestion) => (
                <Badge
                  key={suggestion.name}
                  variant="outline"
                  className={cn(
                    "cursor-pointer hover:opacity-80 transition-opacity",
                    suggestion.color
                  )}
                  onClick={() => handleAddSuggestedTag(suggestion.name)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {suggestion.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
