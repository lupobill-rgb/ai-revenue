import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Play, 
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Shield,
  DollarSign
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, formatDistanceToNow } from "date-fns";

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
      max_budget?: number;
      exposure_pct?: number;
    };
    notes_for_humans?: string;
  };
  expected_observation_window_days: number;
  created_at: string;
  updated_at?: string;
  result?: {
    baseline_value?: number;
    observed_value?: number;
    delta?: number;
    delta_direction?: string;
    metric_id?: string;
  };
}

interface Props {
  tenantId: string | null;
}

// Metrics where LOWER is better
const LOWER_IS_BETTER = ["payback_months", "cac_blended", "churn_rate", "avg_sales_cycle_days"];

function getOutcomeTag(action: OptimizationAction): "improved" | "hurt" | "neutral" | null {
  if (action.status !== "completed" || !action.result) return null;
  
  const { delta, delta_direction, metric_id } = action.result;
  if (delta === undefined || delta === null || !delta_direction) return "neutral";
  
  const isLowerBetter = LOWER_IS_BETTER.includes(metric_id || action.target_metric);
  
  if (delta === 0) return "neutral";
  
  if (isLowerBetter) {
    return delta_direction === "decrease" ? "improved" : "hurt";
  } else {
    return delta_direction === "increase" ? "improved" : "hurt";
  }
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
            delta_direction,
            metric_id
          )
        `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);

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
      case "completed": return <CheckCircle2 className="h-4 w-4" />;
      case "executing": return <Play className="h-4 w-4" />;
      case "pending": return <Clock className="h-4 w-4" />;
      case "failed": return <XCircle className="h-4 w-4" />;
      case "aborted": return <XCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "executing": return "bg-primary/10 text-primary border-primary/20";
      case "pending": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "failed": return "bg-destructive/10 text-destructive border-destructive/20";
      case "aborted": return "bg-muted text-muted-foreground border-muted";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getOutcomeColor = (outcome: "improved" | "hurt" | "neutral") => {
    switch (outcome) {
      case "improved": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "hurt": return "bg-destructive/10 text-destructive border-destructive/20";
      case "neutral": return "bg-muted text-muted-foreground border-muted";
    }
  };

  const getOutcomeIcon = (outcome: "improved" | "hurt" | "neutral") => {
    switch (outcome) {
      case "improved": return <TrendingUp className="h-3 w-3" />;
      case "hurt": return <TrendingDown className="h-3 w-3" />;
      case "neutral": return <Minus className="h-3 w-3" />;
    }
  };

  const getObservationWindowEnd = (action: OptimizationAction) => {
    if (action.status !== "executing") return null;
    const startDate = new Date(action.updated_at || action.created_at);
    const endDate = addDays(startDate, action.expected_observation_window_days);
    const now = new Date();
    
    if (endDate <= now) {
      return "Ending soon";
    }
    return `Ends ${formatDistanceToNow(endDate, { addSuffix: true })}`;
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
            <CardDescription>Autonomous decisions scheduled and executed by the kernel</CardDescription>
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
            {actions.map((action) => {
              const outcome = getOutcomeTag(action);
              const windowEnd = getObservationWindowEnd(action);
              
              return (
                <div 
                  key={action.id} 
                  className="p-4 rounded-lg bg-secondary/30 border border-border/50"
                >
                  {/* Header row: status badges */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant="outline" className={`text-xs ${getStatusColor(action.status)}`}>
                      {getStatusIcon(action.status)}
                      <span className="ml-1 capitalize">{action.status}</span>
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">
                      {action.owner_subsystem}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      P{action.priority_rank}
                    </Badge>
                    {outcome && (
                      <Badge variant="outline" className={`text-xs ${getOutcomeColor(outcome)}`}>
                        {getOutcomeIcon(outcome)}
                        <span className="ml-1 capitalize">{outcome}</span>
                      </Badge>
                    )}
                  </div>
                  
                  {/* Description */}
                  <p className="text-sm font-medium mb-2">
                    {action.config?.proposed_change?.description || action.action_id}
                  </p>
                  
                  {/* Metrics row */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      {action.target_metric}
                    </span>
                    {action.config?.guardrails && (
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {action.config.guardrails.max_budget !== undefined && (
                          <span>Budget: ${action.config.guardrails.max_budget.toLocaleString()}</span>
                        )}
                        {action.config.guardrails.exposure_pct !== undefined && (
                          <span>Exposure: {action.config.guardrails.exposure_pct}%</span>
                        )}
                      </span>
                    )}
                    <span>{action.expected_observation_window_days}d window</span>
                  </div>

                  {/* Status-specific content */}
                  {action.status === "pending" && (
                    <p className="text-xs text-amber-400/80 italic">
                      Scheduled by OS — waiting for execution slot
                    </p>
                  )}

                  {action.status === "executing" && windowEnd && (
                    <p className="text-xs text-primary/80">
                      Active • {windowEnd}
                    </p>
                  )}

                  {/* Results for completed/failed */}
                  {(action.status === "completed" || action.status === "failed") && action.result && (
                    <div className="mt-2 p-2 rounded bg-background/50 border border-border/30">
                      <div className="flex items-center gap-4 text-xs flex-wrap">
                        <span className="text-muted-foreground">
                          Before: <span className="text-foreground">{action.result.baseline_value?.toLocaleString() ?? "—"}</span>
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-muted-foreground">
                          After: <span className="text-foreground">{action.result.observed_value?.toLocaleString() ?? "—"}</span>
                        </span>
                        {action.result.delta !== undefined && (
                          <span className={outcome === "improved" ? "text-emerald-400" : outcome === "hurt" ? "text-destructive" : "text-muted-foreground"}>
                            {action.result.delta > 0 ? "+" : ""}{action.result.delta.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {action.config?.notes_for_humans && (
                    <p className="text-xs text-muted-foreground italic mt-2">
                      "{action.config.notes_for_humans}"
                    </p>
                  )}

                  {/* Paid channel hint - show if action involves paid metrics */}
                  {(action.target_metric?.includes("paid") || 
                    action.owner_subsystem === "campaigns" ||
                    action.action_id?.includes("budget") ||
                    action.action_id?.includes("channel")) && (
                    <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/10">
                      <p className="text-xs text-primary/80">
                        <DollarSign className="h-3 w-3 inline mr-1" />
                        Paid channel context available in Revenue Spine
                      </p>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {format(new Date(action.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                </div>
              );
            })}
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