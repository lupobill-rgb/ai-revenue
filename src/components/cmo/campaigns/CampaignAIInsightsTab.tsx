import { useState, useEffect } from "react";
import { fetchCampaignOptimizations, fetchRecommendations } from "@/lib/cmo/apiClient";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { 
  Lightbulb, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Zap,
  Bot,
  ArrowRight
} from "lucide-react";
import type { CampaignOptimization } from "@/lib/cmo/apiClient";

interface CampaignAIInsightsTabProps {
  campaignId: string;
  tenantId: string;
  autopilotEnabled: boolean;
}

interface Recommendation {
  id: string;
  title: string;
  description: string | null;
  recommendation_type: string;
  priority: string | null;
  status: string | null;
  rationale: string | null;
  expected_impact: string | null;
  effort_level: string | null;
  action_items: string[] | null;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  high: "bg-warning/10 text-warning",
  medium: "bg-primary/10 text-primary",
  low: "bg-muted text-muted-foreground",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  implemented: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  dismissed: <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
};

export default function CampaignAIInsightsTab({ 
  campaignId, 
  tenantId, 
  autopilotEnabled 
}: CampaignAIInsightsTabProps) {
  const [optimizations, setOptimizations] = useState<CampaignOptimization[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [optData, recData] = await Promise.all([
          fetchCampaignOptimizations(campaignId),
          fetchRecommendations(tenantId, campaignId),
        ]);
        setOptimizations(optData);
        setRecommendations(recData as Recommendation[]);
      } catch (err) {
        console.error("Error fetching AI insights:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [campaignId, tenantId]);

  const handleApplyRecommendation = async (recId: string) => {
    try {
      const { error } = await supabase
        .from("cmo_recommendations")
        .update({ status: "implemented", implemented_at: new Date().toISOString() })
        .eq("id", recId);

      if (error) throw error;
      
      toast.success("Recommendation marked as implemented");
      setRecommendations((prev) =>
        prev.map((r) => (r.id === recId ? { ...r, status: "implemented" } : r))
      );
    } catch (err) {
      toast.error("Failed to update recommendation");
    }
  };

  const handleDismissRecommendation = async (recId: string) => {
    try {
      const { error } = await supabase
        .from("cmo_recommendations")
        .update({ status: "dismissed" })
        .eq("id", recId);

      if (error) throw error;
      
      toast.success("Recommendation dismissed");
      setRecommendations((prev) =>
        prev.map((r) => (r.id === recId ? { ...r, status: "dismissed" } : r))
      );
    } catch (err) {
      toast.error("Failed to dismiss recommendation");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const pendingRecs = recommendations.filter((r) => r.status === "pending");
  const appliedRecs = recommendations.filter((r) => r.status === "implemented");

  return (
    <div className="space-y-6">
      {/* Autopilot Status */}
      <Card className={autopilotEnabled ? "border-primary/50 bg-primary/5" : ""}>
        <CardHeader className="py-4">
          <div className="flex items-center gap-3">
            <Bot className={`h-5 w-5 ${autopilotEnabled ? "text-primary" : "text-muted-foreground"}`} />
            <div>
              <CardTitle className="text-sm font-medium">
                Autopilot {autopilotEnabled ? "Enabled" : "Disabled"}
              </CardTitle>
              <CardDescription className="text-xs">
                {autopilotEnabled 
                  ? "AI will automatically apply optimizations to this campaign"
                  : "AI will suggest changes for your review before applying"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Pending Recommendations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                AI Recommendations
              </CardTitle>
              <CardDescription>
                {pendingRecs.length} pending recommendations
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pendingRecs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
              <p>No pending recommendations</p>
              <p className="text-sm">Your campaign is performing well!</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {pendingRecs.map((rec) => (
                <AccordionItem key={rec.id} value={rec.id} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <Badge className={PRIORITY_COLORS[rec.priority || "medium"]}>
                        {rec.priority || "medium"}
                      </Badge>
                      <span className="font-medium">{rec.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    {rec.description && (
                      <p className="text-sm text-muted-foreground">{rec.description}</p>
                    )}
                    
                    {rec.rationale && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Why this matters:</p>
                        <p className="text-sm">{rec.rationale}</p>
                      </div>
                    )}
                    
                    {rec.expected_impact && (
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span>Expected impact: {rec.expected_impact}</span>
                      </div>
                    )}
                    
                    {rec.action_items && rec.action_items.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Action items:</p>
                        <ul className="space-y-1">
                          {rec.action_items.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <ArrowRight className="h-3 w-3 mt-1 text-muted-foreground" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={() => handleApplyRecommendation(rec.id)}>
                        <Zap className="h-4 w-4 mr-1" />
                        Apply
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleDismissRecommendation(rec.id)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Applied Optimizations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Applied Optimizations
          </CardTitle>
          <CardDescription>
            {optimizations.length} optimizations applied by AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          {optimizations.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">
              No optimizations applied yet
            </p>
          ) : (
            <div className="space-y-3">
              {optimizations.slice(0, 10).map((opt) => (
                <div 
                  key={opt.id} 
                  className="flex items-start justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{opt.summary || opt.optimization_type}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(opt.created_at).toLocaleDateString()} • {opt.optimization_type}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Applied
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
