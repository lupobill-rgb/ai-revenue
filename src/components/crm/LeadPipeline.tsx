import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { GripVertical, Phone, Mail, Building, Star } from "lucide-react";
import { useTenantSegments } from "@/hooks/useTenantSegments";
import { SegmentBadge } from "./SegmentBadge";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  job_title?: string;
  status: string;
  score: number;
  source: string;
  vertical?: string;
  created_at: string;
  segment_code?: string;
}

interface LeadPipelineProps {
  leads: Lead[];
  workspaceId: string;
  onLeadClick: (lead: Lead) => void;
  onLeadUpdate: () => void;
}

const PIPELINE_STAGES = [
  { id: "new", label: "New", color: "bg-blue-500" },
  { id: "contacted", label: "Contacted", color: "bg-purple-500" },
  { id: "qualified", label: "Qualified", color: "bg-green-500" },
  { id: "won", label: "Won", color: "bg-emerald-500" },
  { id: "lost", label: "Lost", color: "bg-muted" },
];

export default function LeadPipeline({ leads, workspaceId, onLeadClick, onLeadUpdate }: LeadPipelineProps) {
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const { getSegmentByCode } = useTenantSegments();

  const getLeadsByStage = (stage: string) => {
    const stageMap: Record<string, string[]> = {
      new: ["new"],
      contacted: ["contacted"],
      qualified: ["qualified"],
      won: ["converted", "won"],
      lost: ["lost", "unqualified"],
    };
    return leads.filter((lead) => stageMap[stage]?.includes(lead.status));
  };

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setDragOverStage(stage);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedLead) return;

    const statusMap: Record<string, string> = {
      new: "new",
      contacted: "contacted",
      qualified: "qualified",
      won: "converted",
      lost: "lost",
    };

    const newStatus = statusMap[newStage];
    if (draggedLead.status === newStatus) {
      setDraggedLead(null);
      return;
    }

    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", draggedLead.id);

      if (error) throw error;

      // Log the activity
      await supabase.from("lead_activities").insert({
        lead_id: draggedLead.id,
        activity_type: "status_change",
        description: `Status changed from ${draggedLead.status} to ${newStatus}`,
        workspace_id: workspaceId,
      });

      toast.success(`Lead moved to ${newStage}`);
      onLeadUpdate();
    } catch (error) {
      console.error("Error updating lead:", error);
      toast.error("Failed to update lead status");
    }

    setDraggedLead(null);
  };

  const getScoreStars = (score: number) => {
    const stars = Math.ceil(score / 20);
    return Array(5)
      .fill(0)
      .map((_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i < stars ? "fill-yellow-400 text-yellow-400" : "text-muted"}`}
        />
      ));
  };

  return (
    <div className="grid grid-cols-5 gap-4 min-h-[600px]">
      {PIPELINE_STAGES.map((stage) => {
        const stageLeads = getLeadsByStage(stage.id);
        const isOver = dragOverStage === stage.id;

        return (
          <div
            key={stage.id}
            className={`flex flex-col rounded-lg border bg-card transition-colors ${
              isOver ? "border-primary bg-primary/5" : "border-border"
            }`}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            <div className={`px-4 py-3 rounded-t-lg ${stage.color}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">{stage.label}</h3>
                <Badge variant="secondary" className="bg-white/20 text-white">
                  {stageLeads.length}
                </Badge>
              </div>
            </div>

            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[500px]">
              {stageLeads.map((lead) => (
                <Card
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead)}
                  onClick={() => onLeadClick(lead)}
                  className={`cursor-pointer hover:shadow-md transition-all ${
                    draggedLead?.id === lead.id ? "opacity-50" : ""
                  }`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground mt-1 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {lead.first_name[0]}
                              {lead.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm truncate block">
                              {lead.first_name} {lead.last_name}
                            </span>
                            {lead.segment_code && (() => {
                              const seg = getSegmentByCode(lead.segment_code);
                              return seg ? <SegmentBadge code={seg.code} name={seg.name} color={seg.color} size="sm" /> : null;
                            })()}
                          </div>
                        </div>

                        {lead.company && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <Building className="h-3 w-3" />
                            <span className="truncate">{lead.company}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {lead.email && <Mail className="h-3 w-3" />}
                          {lead.phone && <Phone className="h-3 w-3" />}
                        </div>

                        <div className="flex items-center gap-1 mt-2">
                          {getScoreStars(lead.score)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {stageLeads.length === 0 && (
                <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                  No leads
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
