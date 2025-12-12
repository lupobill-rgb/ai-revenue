import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Zap, 
  Play, 
  Pause, 
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ChevronRight,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface OptimizationAction {
  id: string;
  action_id: string;
  priority_rank: number;
  owner_subsystem: string;
  type: string;
  target_metric: string;
  status: string;
  config: {
    proposed_change?: {
      description?: string;
    };
    guardrails?: {
      max_additional_spend?: number;
    };
    notes_for_humans?: string;
  };
  expected_observation_window_days: number;
  created_at: string;
  result?: {
    baseline_value?: number;
    observed_value?: number;
    delta?: number;
    delta_direction?: string;
  };
}

interface Props {
  tenantId: string | null;
}

export default function OSActionsPanel({ tenantId }: Props) {
  const [actions, setActions] = useState<OptimizationAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;

    const fetchActions = async () => {
      setLoading(true);

      const { data } = await supabase
        .from("optimization_actions")
        .select(`
          *,
          optimization_action_results (
            baseline_value,
            observed_value,
            delta,
            delta_direction
          )
        `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        setActions(data.map(d => ({
          ...d,
          config: (d.config as OptimizationAction['config']) || {},
          result: d.optimization_action_results?.[0]
        })));
      }

      setLoading(false);
    };

    fetchActions();

    // Real-time subscription
    const channel = supabase
      .channel("os-actions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "optimization_actions", filter: `tenant_id=eq.${tenantId}` },
        () => fetchActions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case "executing": return <Play className="h-4 w-4 text-primary" />;
      case "pending": return <Clock className="h-4 w-4 text-amber-400" />;
      case "aborted": return <XCircle className="h-4 w-4 text-destructive" />;
      case "scheduled": return <Clock className="h-4 w-4 text-blue-400" />;
      default: return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "executing": return "bg-primary/10 text-primary border-primary/20";
      case "pending": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "scheduled": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "aborted": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "experiment": return "Experiment";
      case "config_change": return "Config Change";
      case "data_correction": return "Data Fix";
      case "alert": return "Alert";
      case "forecast_update": return "Forecast";
      default: return type;
    }
  };

  const handleAction = async (actionId: string, newStatus: string) => {
    await supabase
      .from("optimization_actions")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", actionId);
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">OS Actions & Experiments</CardTitle>
            <CardDescription>AI decisions and their impact on revenue</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-secondary/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : actions.length > 0 ? (
          <div className="space-y-3">
            {actions.map((action) => (
              <div 
                key={action.id} 
                className="p-4 rounded-lg bg-secondary/30 border border-border/50 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        P{action.priority_rank}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">
                        {action.owner_subsystem}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${getStatusColor(action.status)}`}>
                        {getStatusIcon(action.status)}
                        <span className="ml-1">{action.status}</span>
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {getTypeLabel(action.type)}
                      </span>
                    </div>
                    
                    <p className="text-sm font-medium mb-1">
                      {action.config?.proposed_change?.description || action.action_id}
                    </p>
                    
                    <p className="text-xs text-muted-foreground mb-2">
                      Target: <span className="text-foreground">{action.target_metric}</span>
                      {" • "}
                      Window: <span className="text-foreground">{action.expected_observation_window_days} days</span>
                    </p>

                    {action.config?.notes_for_humans && (
                      <p className="text-xs text-muted-foreground italic">
                        "{action.config.notes_for_humans}"
                      </p>
                    )}

                    {/* Results display */}
                    {action.result && action.status === "completed" && (
                      <div className="mt-3 p-2 rounded bg-background/50 border border-border/30">
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-muted-foreground">Before: {action.result.baseline_value?.toLocaleString()}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">After: {action.result.observed_value?.toLocaleString()}</span>
                          <span className={`flex items-center gap-1 ${
                            action.result.delta_direction === "increase" ? "text-emerald-400" : 
                            action.result.delta_direction === "decrease" ? "text-destructive" : 
                            "text-muted-foreground"
                          }`}>
                            {action.result.delta_direction === "increase" ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : action.result.delta_direction === "decrease" ? (
                              <TrendingDown className="h-3 w-3" />
                            ) : null}
                            {action.result.delta !== undefined && (
                              <span>{action.result.delta > 0 ? "+" : ""}{action.result.delta.toLocaleString()}</span>
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {action.status === "pending" && (
                      <>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0"
                          onClick={() => handleAction(action.id, "executing")}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-destructive"
                          onClick={() => handleAction(action.id, "aborted")}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {action.status === "executing" && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-8 p-0"
                        onClick={() => handleAction(action.id, "pending")}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    {action.status === "completed" && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-8 p-0"
                        onClick={() => handleAction(action.id, "pending")}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  {format(new Date(action.created_at), "MMM d, yyyy 'at' h:mm a")}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No optimization actions yet</p>
            <p className="text-xs mt-1">The OS will generate actions based on your targets and data</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
