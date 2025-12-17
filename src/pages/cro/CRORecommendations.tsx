// CRO Recommendations - Queue of revenue recommendations

import { useState, useEffect } from "react";
import { 
  Lightbulb, 
  Check, 
  Clock, 
  X,
  AlertTriangle,
  TrendingUp,
  Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import NavBar from "@/components/NavBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Recommendation {
  id: string;
  source_type: string | null;
  source_id: string | null;
  severity: string;
  title: string;
  description: string | null;
  suggested_actions: string | null;
  status: string;
  created_at: string;
}

const STATUSES = [
  { value: "all", label: "All Status" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

export default function CRORecommendations() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [statusFilter, setStatusFilter] = useState("open");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRecommendations();
  }, [user, statusFilter]);

  const loadRecommendations = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      let query = supabase
        .from("cro_recommendations")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRecommendations(data || []);
    } catch (error) {
      console.error("Error loading recommendations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("cro_recommendations")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      
      setRecommendations((prev) =>
        prev.map((rec) =>
          rec.id === id ? { ...rec, status: newStatus } : rec
        )
      );
      
      toast.success(`Marked as ${newStatus}`);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "high": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default: return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-blue-500/10 text-blue-500";
      case "in_progress": return "bg-yellow-500/10 text-yellow-500";
      case "resolved": return "bg-green-500/10 text-green-500";
      case "dismissed": return "bg-muted text-muted-foreground";
      default: return "bg-muted";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
      case "high":
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      default:
        return <Lightbulb className="h-5 w-5 text-blue-500" />;
    }
  };

  const openCount = recommendations.filter((r) => r.status === "open").length;
  const inProgressCount = recommendations.filter((r) => r.status === "in_progress").length;

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Revenue Recommendations</h1>
            <p className="text-muted-foreground mt-1">
              AI-generated actions to accelerate revenue
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1">
              {openCount} open
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              {inProgressCount} in progress
            </Badge>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Recommendations List */}
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Loading recommendations...
              </CardContent>
            </Card>
          ) : recommendations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No recommendations found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {statusFilter !== "all" 
                    ? `No ${statusFilter} recommendations`
                    : "AI recommendations will appear here"}
                </p>
              </CardContent>
            </Card>
          ) : (
            recommendations.map((rec) => (
              <Card key={rec.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {getSeverityIcon(rec.severity)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-lg">{rec.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={getSeverityColor(rec.severity)}>
                              {rec.severity}
                            </Badge>
                            <Badge className={getStatusColor(rec.status)}>
                              {rec.status.replace("_", " ")}
                            </Badge>
                            {rec.source_type && (
                              <Badge variant="outline" className="capitalize">
                                {rec.source_type}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {rec.status === "open" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatus(rec.id, "in_progress")}
                              >
                                <Clock className="h-4 w-4 mr-1" /> Start
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => updateStatus(rec.id, "dismissed")}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {rec.status === "in_progress" && (
                            <Button
                              size="sm"
                              onClick={() => updateStatus(rec.id, "resolved")}
                            >
                              <Check className="h-4 w-4 mr-1" /> Done
                            </Button>
                          )}
                          {(rec.status === "resolved" || rec.status === "dismissed") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(rec.id, "open")}
                            >
                              Reopen
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      {rec.description && (
                        <p className="text-muted-foreground mt-3">
                          {rec.description}
                        </p>
                      )}

                      {/* Suggested Actions */}
                      {rec.suggested_actions && (
                        <div className="mt-4 bg-muted/50 rounded-lg p-4">
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" /> Suggested Actions
                          </h4>
                          <p className="text-sm whitespace-pre-wrap">
                            {rec.suggested_actions}
                          </p>
                        </div>
                      )}

                      {/* Meta */}
                      <p className="text-xs text-muted-foreground mt-4">
                        Created {new Date(rec.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}