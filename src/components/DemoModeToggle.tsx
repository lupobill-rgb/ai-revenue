// Sample Data Toggle - Controls workspace demo_mode with mutual exclusivity to live providers
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Database, Zap } from "lucide-react";

type WorkspaceRow = {
  id: string;
  tenant_id: string;
  demo_mode: boolean;
  stripe_connected: boolean;
};

interface SampleDataToggleProps {
  workspaceId: string;
  compact?: boolean;
}

export function SampleDataToggle({ workspaceId, compact = false }: SampleDataToggleProps) {
  const [ws, setWs] = useState<WorkspaceRow | null>(null);
  const [analyticsConnected, setAnalyticsConnected] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  // Load workspace + integration state
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: wsData, error: wsErr } = await supabase
        .from("workspaces")
        .select("id,tenant_id,demo_mode,stripe_connected")
        .eq("id", workspaceId)
        .maybeSingle();

      if (!mounted) return;

      if (wsErr || !wsData) {
        console.error("Failed to load workspace:", wsErr?.message);
        return;
      }
      setWs(wsData);

      // analytics connected: any active GA/Meta/LinkedIn integration
      const { data: siData, error: siErr } = await supabase
        .from("social_integrations")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .in("platform", ["google_analytics", "meta", "facebook", "linkedin"])
        .limit(1);

      if (!mounted) return;

      if (siErr) {
        console.warn("analyticsConnected lookup failed:", siErr.message);
        setAnalyticsConnected(false);
      } else {
        setAnalyticsConnected((siData?.length || 0) > 0);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [workspaceId]);

  const hasLiveProviders = useMemo(() => {
    if (!ws) return false;
    return Boolean(ws.stripe_connected || analyticsConnected);
  }, [ws, analyticsConnected]);

  const allProvidersConnected = useMemo(() => {
    if (!ws) return false;
    return Boolean(ws.stripe_connected && analyticsConnected);
  }, [ws, analyticsConnected]);

  const disabledReason = useMemo(() => {
    if (!ws) return "Loading workspace…";
    if (hasLiveProviders && ws.demo_mode) return "Demo mode is ON while providers are connected.";
    if (hasLiveProviders) return "Disable providers (Stripe/Analytics) to enable demo mode.";
    return null;
  }, [ws, hasLiveProviders]);

  // Badge text per spec
  const badgeText = useMemo(() => {
    if (!ws) return "Loading";
    if (ws.demo_mode) return "SAMPLE DATA";
    if (allProvidersConnected) return "LIVE";
    return "LIVE (SETUP REQUIRED)";
  }, [ws, allProvidersConnected]);

  const badgeVariant = useMemo(() => {
    if (!ws) return "outline" as const;
    if (ws.demo_mode) return "secondary" as const;
    if (allProvidersConnected) return "default" as const;
    return "destructive" as const;
  }, [ws, allProvidersConnected]);

  // If providers become connected, force demo_mode OFF (hard rule)
  useEffect(() => {
    if (!ws) return;
    if (hasLiveProviders && ws.demo_mode) {
      (async () => {
        setSaving(true);
        const { error } = await supabase
          .from("workspaces")
          .update({ demo_mode: false })
          .eq("id", ws.id);

        setSaving(false);

        if (error) {
          toast.error(`Failed to disable demo mode: ${error.message}`);
          return;
        }
        setWs({ ...ws, demo_mode: false });
        toast.warning("Sample Data was turned off because live providers are connected.");
      })();
    }
  }, [hasLiveProviders]);

  const onToggle = async (next: boolean) => {
    if (!ws) return;

    // enforce rule: cannot enable demo mode if providers connected
    if (next === true && hasLiveProviders) {
      toast.error("Cannot enable Sample Data while Stripe/Analytics are connected.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("workspaces")
      .update({ demo_mode: next })
      .eq("id", ws.id);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setWs({ ...ws, demo_mode: next });
    toast.success(next ? "Sample Data enabled" : "Sample Data disabled");
  };

  if (!ws) return null;

  // Compact version for dashboard header
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant={badgeVariant} className="text-xs font-medium">
          {badgeText}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={saving || (hasLiveProviders && !ws.demo_mode)}
          onClick={() => onToggle(!ws.demo_mode)}
          title={disabledReason || undefined}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : ws.demo_mode ? "Go Live" : "Preview"}
        </Button>
      </div>
    );
  }

  // Full version for settings page
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold">Show Sample Data (Preview Mode)</div>
          <div className="text-sm text-muted-foreground">
            When enabled, dashboards show illustrative numbers so users can visualize outputs.
            {hasLiveProviders ? " Live providers are connected." : " No live providers connected."}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {disabledReason && !hasLiveProviders && (
            <span className="text-xs text-muted-foreground">{disabledReason}</span>
          )}

          <Button
            variant={ws.demo_mode ? "default" : "outline"}
            disabled={saving || (hasLiveProviders && !ws.demo_mode)}
            onClick={() => onToggle(!ws.demo_mode)}
            title={hasLiveProviders && !ws.demo_mode ? "Disconnect providers to enable." : ""}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {saving ? "Saving…" : ws.demo_mode ? "ON" : "OFF"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Data Mode Banner - shows at top of dashboard
interface DataModeBannerProps {
  workspaceId: string;
  onConnectStripe?: () => void;
  onConnectAnalytics?: () => void;
}

export function DataModeBanner({ workspaceId, onConnectStripe, onConnectAnalytics }: DataModeBannerProps) {
  const [ws, setWs] = useState<WorkspaceRow | null>(null);
  const [analyticsConnected, setAnalyticsConnected] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: wsData } = await supabase
        .from("workspaces")
        .select("id,tenant_id,demo_mode,stripe_connected")
        .eq("id", workspaceId)
        .maybeSingle();

      if (!mounted || !wsData) return;
      setWs(wsData);

      const { data: siData } = await supabase
        .from("social_integrations")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .in("platform", ["google_analytics", "meta", "facebook", "linkedin"])
        .limit(1);

      if (!mounted) return;
      setAnalyticsConnected((siData?.length || 0) > 0);
    })();

    return () => { mounted = false; };
  }, [workspaceId]);

  const onDisableSampleData = async () => {
    if (!ws) return;
    setSaving(true);
    const { error } = await supabase
      .from("workspaces")
      .update({ demo_mode: false })
      .eq("id", ws.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setWs({ ...ws, demo_mode: false });
    toast.success("Sample Data disabled");
  };

  if (!ws) return null;

  // Demo mode ON banner
  if (ws.demo_mode) {
    return (
      <Alert className="mb-6 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
        <Database className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <Badge className="bg-amber-500 text-white text-xs px-2 py-0.5">Demo Data</Badge>
          Preview Mode
        </AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300">
          <p className="mb-2 font-medium">These metrics are simulated to show potential outcomes.</p>
          <p className="text-sm">KPIs below are projections based on sample data. Connect providers and run real campaigns to see live results.</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {onConnectStripe && (
              <Button size="sm" variant="outline" onClick={onConnectStripe}>
                Connect Stripe
              </Button>
            )}
            {onConnectAnalytics && (
              <Button size="sm" variant="outline" onClick={onConnectAnalytics}>
                Connect Analytics
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={onDisableSampleData} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Exit Demo Mode
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Live mode but missing providers
  const missingStripe = !ws.stripe_connected;
  const missingAnalytics = !analyticsConnected;

  if (missingStripe || missingAnalytics) {
    let providerMessage = "";
    if (missingStripe && missingAnalytics) {
      providerMessage = "Stripe isn't connected, so revenue will show as $0. Analytics isn't connected, so impressions/clicks will show as 0.";
    } else if (missingStripe) {
      providerMessage = "Stripe isn't connected, so revenue will show as $0.";
    } else {
      providerMessage = "Analytics isn't connected, so impressions/clicks will show as 0.";
    }

    return (
      <Alert className="mb-6 border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertTitle className="text-orange-800 dark:text-orange-200">Setup Required</AlertTitle>
        <AlertDescription className="text-orange-700 dark:text-orange-300">
          <p className="mb-2 font-medium">Metrics are zeroed because providers are not connected.</p>
          <p className="text-sm">{providerMessage}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {missingStripe && onConnectStripe && (
              <Button size="sm" variant="default" onClick={onConnectStripe}>
                <Zap className="h-3 w-3 mr-1" />
                Connect Stripe
              </Button>
            )}
            {missingAnalytics && onConnectAnalytics && (
              <Button size="sm" variant="default" onClick={onConnectAnalytics}>
                Connect Analytics
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // All good - no banner needed
  return null;
}

// Backward compatibility alias
export { SampleDataToggle as DemoModeToggle };
