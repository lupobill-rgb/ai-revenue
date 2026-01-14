import { useEffect, useState } from "react";
import AdsOperatorLayout, { type AdsAccount } from "./AdsOperatorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabaseOperator } from "@/integrations/supabase/operatorClient";
import { RefreshCw } from "lucide-react";

type ActionEvent = {
  id: string;
  created_at: string;
  event_type: string;
  message: string;
  details: unknown;
  proposal_id: string | null;
};

function formatTs(ts: string) {
  return new Date(ts).toLocaleString();
}

export default function ActivityFeed() {
  const [events, setEvents] = useState<ActionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(workspaceId: string, adAccount: AdsAccount) {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabaseOperator
        .from("action_events")
        .select("id, created_at, event_type, message, details, proposal_id")
        .eq("workspace_id", workspaceId)
        .eq("ad_account_id", adAccount.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setEvents((data || []) as ActionEvent[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdsOperatorLayout title="Activity Feed">
      {({ workspaceId, adAccount }) => (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">Latest actions and audits for this account.</div>
            <Button variant="outline" size="sm" onClick={() => load(workspaceId, adAccount)} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {error && <div className="text-sm text-destructive mb-4">{error}</div>}

          <div className="space-y-3">
            {events.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-sm text-muted-foreground">No activity recorded yet.</CardContent>
              </Card>
            ) : (
              events.map((e) => (
                <Card key={e.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-base">{e.message}</CardTitle>
                      <Badge variant="secondary" className="shrink-0">
                        {e.event_type}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{formatTs(e.created_at)}</div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {e.proposal_id && (
                      <div className="text-xs text-muted-foreground mb-2">
                        Proposal: <span className="font-mono">{e.proposal_id}</span>
                      </div>
                    )}
                    {e.details && typeof e.details === "object" && Object.keys(e.details as Record<string, unknown>).length > 0 && (
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-56">
                        {JSON.stringify(e.details, null, 2)}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* initial load */}
          {!loading && events.length === 0 && !error && (
            <div className="hidden">
              {/* noop placeholder to avoid lint warnings */}
            </div>
          )}

          <LoadOnMount workspaceId={workspaceId} adAccount={adAccount} load={load} />
        </>
      )}
    </AdsOperatorLayout>
  );
}

function LoadOnMount(props: {
  workspaceId: string;
  adAccount: AdsAccount;
  load: (workspaceId: string, adAccount: AdsAccount) => Promise<void>;
}) {
  const { workspaceId, adAccount, load } = props;
  useEffect(() => {
    load(workspaceId, adAccount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, adAccount.id]);
  return null;
}

