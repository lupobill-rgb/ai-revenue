/**
 * Campaign Launch Prerequisites Panel
 * Shows green checks/red X for each requirement before launching
 */

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Requirement {
  id: string;
  name: string;
  pass: boolean;
  message: string;
}

interface PrerequisitesResult {
  pass: boolean;
  channel: string;
  requirements: Requirement[];
}

interface CampaignLaunchPrerequisitesProps {
  campaignId: string;
  workspaceId: string;
  channel: string;
  onLaunchSuccess?: (runId: string) => void;
  onClose?: () => void;
}

export function CampaignLaunchPrerequisites({
  campaignId,
  workspaceId,
  channel,
  onLaunchSuccess,
  onClose,
}: CampaignLaunchPrerequisitesProps) {
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [prerequisites, setPrerequisites] = useState<PrerequisitesResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkPrerequisites = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "check_campaign_launch_prerequisites",
        {
          p_campaign_id: campaignId,
          p_tenant_id: workspaceId,
        }
      );

      if (rpcError) throw rpcError;

      const result = data as unknown as PrerequisitesResult;
      setPrerequisites(result);
    } catch (err) {
      console.error("Error checking prerequisites:", err);
      setError(err instanceof Error ? err.message : "Failed to check prerequisites");
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = async () => {
    if (!prerequisites?.pass) {
      toast.error("Please resolve all prerequisites before launching");
      return;
    }

    setLaunching(true);
    try {
      const { data, error: deployError } = await supabase.rpc("deploy_campaign", {
        p_campaign_id: campaignId,
      });

      if (deployError) throw deployError;

      const result = data as unknown as { success: boolean; error?: string; run_id?: string; prerequisites?: Requirement[] };

      if (!result.success) {
        // Show detailed prerequisites if available
        if (result.prerequisites) {
          setPrerequisites({
            pass: false,
            channel,
            requirements: result.prerequisites,
          });
        }
        throw new Error(result.error || "Launch failed");
      }

      toast.success("Campaign launched successfully!");
      onLaunchSuccess?.(result.run_id || "");
    } catch (err) {
      console.error("Launch error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to launch campaign");
    } finally {
      setLaunching(false);
    }
  };

  // Auto-check on mount
  useState(() => {
    checkPrerequisites();
  });

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Launch Prerequisites</CardTitle>
            <CardDescription>
              All requirements must pass before launching the {channel} campaign
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={checkPrerequisites}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !prerequisites && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Checking prerequisites...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {prerequisites && (
          <>
            <div className="space-y-2">
              {prerequisites.requirements.map((req) => (
                <div
                  key={req.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    req.pass
                      ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                      : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                  }`}
                >
                  {req.pass ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{req.name}</span>
                      <Badge variant={req.pass ? "default" : "destructive"} className="text-xs">
                        {req.pass ? "Pass" : "Required"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 break-words">
                      {req.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {!prerequisites.pass && (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm">
                  Please configure all required settings before launching.{" "}
                  <a
                    href="/settings/integrations"
                    className="underline font-medium hover:no-underline"
                  >
                    Go to Settings
                  </a>
                </span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {onClose && (
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
              )}
              <Button
                onClick={handleLaunch}
                disabled={!prerequisites.pass || launching}
                className="flex-1"
              >
                {launching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Launching...
                  </>
                ) : (
                  "Launch Campaign"
                )}
              </Button>
            </div>
          </>
        )}

        {!loading && !prerequisites && !error && (
          <Button onClick={checkPrerequisites} className="w-full">
            Check Prerequisites
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default CampaignLaunchPrerequisites;
