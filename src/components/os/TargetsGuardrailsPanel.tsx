import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Globe,
  Linkedin,
  Save,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TenantTargets {
  tenant_id: string;
  target_pipeline: number;
  target_bookings: number;
  target_payback_months: number;
  margin_floor_pct: number;
  max_cac: number;
  cash_risk_tolerance: "low" | "medium" | "high";
  monthly_budget_cap: number;
  experiment_exposure_pct: number;
  email_enabled: boolean;
  voice_enabled: boolean;
  sms_enabled: boolean;
  landing_pages_enabled: boolean;
  linkedin_enabled: boolean;
}

interface Props {
  tenantId: string | null;
}

export default function TargetsGuardrailsPanel({ tenantId }: Props) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [config, setConfig] = useState<TenantTargets>({
    tenant_id: "",
    target_pipeline: 500000,
    target_bookings: 150000,
    target_payback_months: 12,
    margin_floor_pct: 60,
    max_cac: 2500,
    cash_risk_tolerance: "medium",
    monthly_budget_cap: 50000,
    experiment_exposure_pct: 20,
    email_enabled: true,
    voice_enabled: true,
    sms_enabled: false,
    landing_pages_enabled: true,
    linkedin_enabled: false,
  });

  useEffect(() => {
    if (!tenantId) return;
    
    const fetchConfig = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("tenant_targets")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      if (data) {
        setConfig(data as TenantTargets);
      } else if (error?.code === "PGRST116") {
        // No row exists, create one with defaults
        const { data: newData } = await supabase
          .from("tenant_targets")
          .insert({ tenant_id: tenantId })
          .select()
          .single();
        if (newData) setConfig(newData as TenantTargets);
      }
      setIsLoading(false);
    };

    fetchConfig();
  }, [tenantId]);

  const updateConfig = <K extends keyof TenantTargets>(key: K, value: TenantTargets[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!tenantId) return;
    
    setIsSaving(true);
    const { error } = await supabase
      .from("tenant_targets")
      .upsert({
        ...config,
        tenant_id: tenantId,
      });

    if (error) {
      toast({
        title: "Error saving",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Saved",
        description: "Targets and guardrails updated successfully.",
      });
      setHasChanges(false);
    }
    setIsSaving(false);
  };

  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Targets & Guardrails</CardTitle>
              <CardDescription>Define what good looks like and what's off-limits</CardDescription>
            </div>
          </div>
          {hasChanges && (
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Growth Targets */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Growth Targets
          </h3>
          <div className="grid gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-primary/10 text-primary">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Target Pipeline</p>
                  <p className="text-xs text-muted-foreground">Total pipeline value goal</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={config.target_pipeline}
                  onChange={(e) => updateConfig("target_pipeline", Number(e.target.value))}
                  className="w-32 h-8 text-right"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-primary/10 text-primary">
                  <DollarSign className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Target Bookings</p>
                  <p className="text-xs text-muted-foreground">Monthly bookings goal</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={config.target_bookings}
                  onChange={(e) => updateConfig("target_bookings", Number(e.target.value))}
                  className="w-32 h-8 text-right"
                />
              </div>
            </div>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Economics Guardrails */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Economics Guardrails
          </h3>
          <div className="grid gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-amber-500/10 text-amber-400">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Target Payback</p>
                  <p className="text-xs text-muted-foreground">Months to recover CAC</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={config.target_payback_months}
                  onChange={(e) => updateConfig("target_payback_months", Number(e.target.value))}
                  className="w-20 h-8 text-right"
                />
                <span className="text-sm text-muted-foreground w-8">mo</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-400">
                  <Percent className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Margin Floor</p>
                  <p className="text-xs text-muted-foreground">Minimum gross margin %</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={config.margin_floor_pct}
                  onChange={(e) => updateConfig("margin_floor_pct", Number(e.target.value))}
                  className="w-20 h-8 text-right"
                />
                <span className="text-sm text-muted-foreground w-8">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-destructive/10 text-destructive">
                  <DollarSign className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Max CAC</p>
                  <p className="text-xs text-muted-foreground">Customer acquisition cost cap</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={config.max_cac}
                  onChange={(e) => updateConfig("max_cac", Number(e.target.value))}
                  className="w-24 h-8 text-right"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-primary/10 text-primary">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Cash Risk Tolerance</p>
                  <p className="text-xs text-muted-foreground">How aggressive with spend</p>
                </div>
              </div>
              <Select
                value={config.cash_risk_tolerance}
                onValueChange={(value) => updateConfig("cash_risk_tolerance", value as "low" | "medium" | "high")}
              >
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-primary/10 text-primary">
                  <DollarSign className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Monthly Budget Cap</p>
                  <p className="text-xs text-muted-foreground">Max spend per month</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={config.monthly_budget_cap}
                  onChange={(e) => updateConfig("monthly_budget_cap", Number(e.target.value))}
                  className="w-28 h-8 text-right"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-amber-500/10 text-amber-400">
                  <Percent className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Experiment Exposure</p>
                  <p className="text-xs text-muted-foreground">Max budget for experiments</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={config.experiment_exposure_pct}
                  onChange={(e) => updateConfig("experiment_exposure_pct", Number(e.target.value))}
                  className="w-20 h-8 text-right"
                />
                <span className="text-sm text-muted-foreground w-8">%</span>
              </div>
            </div>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Allowed Channels */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            OS Allowed Channels
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded ${config.email_enabled ? 'text-primary' : 'text-muted-foreground'}`}>
                  <Mail className="h-4 w-4" />
                </div>
                <span className="text-sm">Email</span>
              </div>
              <Switch
                checked={config.email_enabled}
                onCheckedChange={(checked) => updateConfig("email_enabled", checked)}
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded ${config.voice_enabled ? 'text-primary' : 'text-muted-foreground'}`}>
                  <Phone className="h-4 w-4" />
                </div>
                <span className="text-sm">Voice/AI</span>
              </div>
              <Switch
                checked={config.voice_enabled}
                onCheckedChange={(checked) => updateConfig("voice_enabled", checked)}
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded ${config.sms_enabled ? 'text-primary' : 'text-muted-foreground'}`}>
                  <MessageSquare className="h-4 w-4" />
                </div>
                <span className="text-sm">SMS</span>
              </div>
              <Switch
                checked={config.sms_enabled}
                onCheckedChange={(checked) => updateConfig("sms_enabled", checked)}
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded ${config.landing_pages_enabled ? 'text-primary' : 'text-muted-foreground'}`}>
                  <Globe className="h-4 w-4" />
                </div>
                <span className="text-sm">Landing Pages</span>
              </div>
              <Switch
                checked={config.landing_pages_enabled}
                onCheckedChange={(checked) => updateConfig("landing_pages_enabled", checked)}
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/50 col-span-2">
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded ${config.linkedin_enabled ? 'text-primary' : 'text-muted-foreground'}`}>
                  <Linkedin className="h-4 w-4" />
                </div>
                <span className="text-sm">LinkedIn</span>
              </div>
              <Switch
                checked={config.linkedin_enabled}
                onCheckedChange={(checked) => updateConfig("linkedin_enabled", checked)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
