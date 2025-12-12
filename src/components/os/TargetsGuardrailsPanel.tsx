import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Target, 
  Shield, 
  DollarSign, 
  TrendingUp, 
  Clock,
  Percent,
  Zap,
  Mail,
  Phone,
  MessageSquare,
  Globe
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MetricTarget {
  id: string;
  label: string;
  current: number;
  target: number;
  unit: string;
  icon: React.ReactNode;
  status: "on_track" | "at_risk" | "off_track";
}

interface Guardrail {
  id: string;
  label: string;
  enabled: boolean;
  value?: number;
  unit?: string;
}

interface Props {
  tenantId: string | null;
}

export default function TargetsGuardrailsPanel({ tenantId }: Props) {
  const [metrics, setMetrics] = useState<MetricTarget[]>([
    { id: "pipeline", label: "Pipeline", current: 0, target: 500000, unit: "$", icon: <TrendingUp className="h-4 w-4" />, status: "on_track" },
    { id: "bookings", label: "Bookings", current: 0, target: 150000, unit: "$", icon: <DollarSign className="h-4 w-4" />, status: "on_track" },
    { id: "cac", label: "CAC", current: 0, target: 2500, unit: "$", icon: <DollarSign className="h-4 w-4" />, status: "on_track" },
    { id: "payback", label: "Payback", current: 0, target: 12, unit: "mo", icon: <Clock className="h-4 w-4" />, status: "on_track" },
    { id: "margin", label: "Gross Margin", current: 0, target: 75, unit: "%", icon: <Percent className="h-4 w-4" />, status: "on_track" },
  ]);

  const [guardrails, setGuardrails] = useState<Guardrail[]>([
    { id: "budget_cap", label: "Monthly Budget Cap", enabled: true, value: 50000, unit: "$" },
    { id: "payback_threshold", label: "Max Payback Months", enabled: true, value: 18, unit: "mo" },
    { id: "experiment_risk", label: "Experiment Risk Level", enabled: true, value: 20, unit: "%" },
  ]);

  const [levers, setLevers] = useState([
    { id: "email", label: "Email Campaigns", icon: <Mail className="h-4 w-4" />, enabled: true },
    { id: "voice", label: "Voice/AI Calling", icon: <Phone className="h-4 w-4" />, enabled: true },
    { id: "sms", label: "SMS Sequences", icon: <MessageSquare className="h-4 w-4" />, enabled: false },
    { id: "landing", label: "Landing Pages", icon: <Globe className="h-4 w-4" />, enabled: true },
  ]);

  useEffect(() => {
    if (!tenantId) return;
    
    const fetchMetrics = async () => {
      const { data } = await supabase
        .from("metric_snapshots_daily")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("date", { ascending: false })
        .limit(10);

      if (data && data.length > 0) {
        setMetrics(prev => prev.map(m => {
          const snapshot = data.find(d => d.metric_id === m.id);
          if (snapshot) {
            const current = Number(snapshot.value) || 0;
            const ratio = m.target > 0 ? current / m.target : 0;
            let status: "on_track" | "at_risk" | "off_track" = "on_track";
            if (m.id === "cac" || m.id === "payback") {
              status = ratio <= 1 ? "on_track" : ratio <= 1.2 ? "at_risk" : "off_track";
            } else {
              status = ratio >= 0.9 ? "on_track" : ratio >= 0.7 ? "at_risk" : "off_track";
            }
            return { ...m, current, status };
          }
          return m;
        }));
      }
    };

    fetchMetrics();
  }, [tenantId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on_track": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "at_risk": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "off_track": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === "$") return `$${value.toLocaleString()}`;
    if (unit === "%") return `${value}%`;
    if (unit === "mo") return `${value} mo`;
    return value.toString();
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Targets & Guardrails</CardTitle>
            <CardDescription>Define what good looks like and what's off-limits</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Revenue Targets */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Revenue & Efficiency Targets
          </h3>
          <div className="grid gap-3">
            {metrics.map((metric) => (
              <div key={metric.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded bg-primary/10 text-primary">
                    {metric.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{metric.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatValue(metric.current, metric.unit)} / {formatValue(metric.target, metric.unit)}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={getStatusColor(metric.status)}>
                  {metric.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Guardrails */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Guardrails & Limits
          </h3>
          <div className="grid gap-3">
            {guardrails.map((guardrail) => (
              <div key={guardrail.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex items-center gap-3">
                  <Switch 
                    checked={guardrail.enabled}
                    onCheckedChange={(checked) => {
                      setGuardrails(prev => prev.map(g => 
                        g.id === guardrail.id ? { ...g, enabled: checked } : g
                      ));
                    }}
                  />
                  <Label className="text-sm">{guardrail.label}</Label>
                </div>
                {guardrail.value !== undefined && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={guardrail.value}
                      onChange={(e) => {
                        setGuardrails(prev => prev.map(g =>
                          g.id === guardrail.id ? { ...g, value: Number(e.target.value) } : g
                        ));
                      }}
                      className="w-24 h-8 text-right"
                      disabled={!guardrail.enabled}
                    />
                    <span className="text-sm text-muted-foreground w-6">{guardrail.unit}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Allowed Levers */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            OS Allowed Levers
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {levers.map((lever) => (
              <div key={lever.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded ${lever.enabled ? 'text-primary' : 'text-muted-foreground'}`}>
                    {lever.icon}
                  </div>
                  <span className="text-sm">{lever.label}</span>
                </div>
                <Switch
                  checked={lever.enabled}
                  onCheckedChange={(checked) => {
                    setLevers(prev => prev.map(l =>
                      l.id === lever.id ? { ...l, enabled: checked } : l
                    ));
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
