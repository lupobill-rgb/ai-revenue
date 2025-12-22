// Sample Data Toggle - Controls workspace demo_mode with mutual exclusivity to live providers
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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

  const disabledReason = useMemo(() => {
    if (!ws) return "Loading workspace…";
    if (hasLiveProviders && ws.demo_mode) return "Demo mode is ON while providers are connected.";
    if (hasLiveProviders) return "Disable providers (Stripe/Analytics) to enable demo mode.";
    return null;
  }, [ws, hasLiveProviders]);

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
        <Badge variant={ws.demo_mode ? "secondary" : "outline"} className="text-xs">
          {ws.demo_mode ? "Sample Data" : "Live"}
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

// Backward compatibility alias
export { SampleDataToggle as DemoModeToggle };
