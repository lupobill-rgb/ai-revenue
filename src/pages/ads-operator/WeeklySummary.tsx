import { useEffect, useState } from "react";
import AdsOperatorLayout, { type AdsAccount } from "./AdsOperatorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabaseOperator } from "@/integrations/supabase/operatorClient";
import { RefreshCw } from "lucide-react";

type Weekly = {
  id: string;
  week_start_date: string;
  summary: unknown;
  created_at: string;
};

export default function WeeklySummary() {
  const [rows, setRows] = useState<Weekly[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(workspaceId: string, adAccount: AdsAccount) {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabaseOperator
        .from("weekly_summaries")
        .select("id, week_start_date, summary, created_at")
        .eq("workspace_id", workspaceId)
        .eq("ad_account_id", adAccount.id)
        .order("week_start_date", { ascending: false })
        .limit(12);
      if (error) throw error;
      setRows((data || []) as Weekly[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load weekly summaries");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdsOperatorLayout title="Weekly Summary">
      {({ workspaceId, adAccount }) => (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">Read-only weekly rollups for this account.</div>
            <Button variant="outline" size="sm" onClick={() => load(workspaceId, adAccount)} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {error && <div className="text-sm text-destructive mb-4">{error}</div>}

          <div className="space-y-3">
            {rows.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-sm text-muted-foreground">No weekly summaries yet.</CardContent>
              </Card>
            ) : (
              rows.map((w) => (
                <Card key={w.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Week of {w.week_start_date}</CardTitle>
                    <div className="text-xs text-muted-foreground">Generated: {new Date(w.created_at).toLocaleString()}</div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">{JSON.stringify(w.summary, null, 2)}</pre>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

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

