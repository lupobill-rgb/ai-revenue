import { useEffect, useState } from "react";
import AdsOperatorLayout, { type AdsAccount } from "./AdsOperatorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { supabaseOperator } from "@/integrations/supabase/operatorClient";
import { Check, X, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Proposal = {
  id: string;
  created_at: string;
  proposal_type: string;
  status: string;
  title: string;
  rationale: string;
  governor_decision: unknown;
  payload: unknown;
};

function formatTs(ts: string) {
  return new Date(ts).toLocaleString();
}

export default function ApprovalQueue() {
  const { toast } = useToast();
  const [items, setItems] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  async function load(workspaceId: string, adAccount: AdsAccount) {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabaseOperator
        .from("action_proposals")
        .select("id, created_at, proposal_type, status, title, rationale, governor_decision, payload")
        .eq("workspace_id", workspaceId)
        .eq("ad_account_id", adAccount.id)
        .eq("status", "needs_approval")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setItems((data || []) as Proposal[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load approval queue");
    } finally {
      setLoading(false);
    }
  }

  async function logDecision(args: {
    workspaceId: string;
    adAccountId: string;
    proposalId: string;
    eventType: "approved" | "rejected";
    actorId: string;
  }) {
    const { error } = await supabaseOperator.from("action_events").insert({
      workspace_id: args.workspaceId,
      ad_account_id: args.adAccountId,
      proposal_id: args.proposalId,
      event_type: args.eventType,
      actor_type: "human",
      actor_id: args.actorId,
      message: args.eventType === "approved" ? "Approved for execution" : "Rejected",
      details: {},
    });
    if (error) throw error;
  }

  async function approve(workspaceId: string, adAccount: AdsAccount, proposalId: string) {
    setActing(proposalId);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const now = new Date().toISOString();
      const { error } = await supabaseOperator
        .from("action_proposals")
        .update({ status: "approved", approved_by: userId, approved_at: now })
        .eq("id", proposalId);
      if (error) throw error;

      await logDecision({ workspaceId, adAccountId: adAccount.id, proposalId, eventType: "approved", actorId: userId });
      toast({ title: "Approved", description: "Proposal approved for execution." });
      await load(workspaceId, adAccount);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to approve", variant: "destructive" });
    } finally {
      setActing(null);
    }
  }

  async function reject(workspaceId: string, adAccount: AdsAccount, proposalId: string) {
    setActing(proposalId);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const now = new Date().toISOString();
      const { error } = await supabaseOperator
        .from("action_proposals")
        .update({ status: "rejected", rejected_by: userId, rejected_at: now })
        .eq("id", proposalId);
      if (error) throw error;

      await logDecision({ workspaceId, adAccountId: adAccount.id, proposalId, eventType: "rejected", actorId: userId });
      toast({ title: "Rejected", description: "Proposal rejected." });
      await load(workspaceId, adAccount);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to reject", variant: "destructive" });
    } finally {
      setActing(null);
    }
  }

  return (
    <AdsOperatorLayout title="Approval Queue">
      {({ workspaceId, adAccount }) => (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">Yes/No decisions only. No manual edits.</div>
            <Button variant="outline" size="sm" onClick={() => load(workspaceId, adAccount)} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {error && <div className="text-sm text-destructive mb-4">{error}</div>}

          <div className="space-y-3">
            {items.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-sm text-muted-foreground">No approvals pending.</CardContent>
              </Card>
            ) : (
              items.map((p) => (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-base">{p.title}</CardTitle>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatTs(p.created_at)} • <span className="font-mono">{p.proposal_type}</span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {p.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-sm mb-3">{p.rationale}</div>

                    {p.governor_decision && (
                      <div className="mb-3">
                        <div className="text-xs text-muted-foreground mb-1">Governor</div>
                        <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-56">
                          {JSON.stringify(p.governor_decision, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => approve(workspaceId, adAccount, p.id)}
                        disabled={acting === p.id}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/10"
                        onClick={() => reject(workspaceId, adAccount, p.id)}
                        disabled={acting === p.id}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
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

