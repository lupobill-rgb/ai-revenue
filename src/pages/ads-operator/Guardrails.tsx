import { useEffect, useMemo, useState } from "react";
import AdsOperatorLayout, { type AdsAccount } from "./AdsOperatorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabaseOperator } from "@/integrations/supabase/operatorClient";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Save } from "lucide-react";

type GuardrailsRow = {
  id: string;
  workspace_id: string;
  ad_account_id: string;
  cpa_target_micros: number | null;
  roas_target: number | null;
  max_single_budget_change_pct: number;
  approval_budget_increase_pct: number;
  max_net_daily_spend_increase_pct: number;
  min_conversions_for_cpa_action: number;
  min_clicks_for_cpa_action: number;
  lookback_days: number;
  keyword_spend_threshold_micros: number;
  bid_reduction_pct: number;
  updated_at: string | null;
};

function microsToCurrency(micros: number) {
  return micros / 1_000_000;
}
function currencyToMicros(v: number) {
  return Math.trunc(v * 1_000_000);
}

export default function Guardrails() {
  const { toast } = useToast();
  const [row, setRow] = useState<GuardrailsRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionEnabled, setExecutionEnabled] = useState<boolean>(true);
  const [savingExecutionEnabled, setSavingExecutionEnabled] = useState(false);

  // Form state (currency units for micros fields; percentages as percent)
  const [cpaTarget, setCpaTarget] = useState<string>("");
  const [roasTarget, setRoasTarget] = useState<string>("");
  const [keywordSpendThreshold, setKeywordSpendThreshold] = useState<string>("");
  const [bidReductionPct, setBidReductionPct] = useState<string>("20");
  const [lookbackDays, setLookbackDays] = useState<string>("30");
  const [minConv, setMinConv] = useState<string>("5");
  const [minClicks, setMinClicks] = useState<string>("100");
  const [maxSingleBudgetChangePct, setMaxSingleBudgetChangePct] = useState<string>("20");
  const [approvalBudgetIncreasePct, setApprovalBudgetIncreasePct] = useState<string>("10");
  const [maxNetDailySpendIncreasePct, setMaxNetDailySpendIncreasePct] = useState<string>("15");

  function populateFromRow(r: GuardrailsRow | null) {
    setRow(r);
    setCpaTarget(r?.cpa_target_micros != null ? String(microsToCurrency(r.cpa_target_micros)) : "");
    setRoasTarget(r?.roas_target != null ? String(r.roas_target) : "");
    setKeywordSpendThreshold(String(microsToCurrency(r?.keyword_spend_threshold_micros ?? 5_000_000)));
    setBidReductionPct(String(Math.round((r?.bid_reduction_pct ?? 0.2) * 100)));
    setLookbackDays(String(r?.lookback_days ?? 30));
    setMinConv(String(r?.min_conversions_for_cpa_action ?? 5));
    setMinClicks(String(r?.min_clicks_for_cpa_action ?? 100));
    setMaxSingleBudgetChangePct(String(Math.round((r?.max_single_budget_change_pct ?? 0.2) * 100)));
    setApprovalBudgetIncreasePct(String(Math.round((r?.approval_budget_increase_pct ?? 0.1) * 100)));
    setMaxNetDailySpendIncreasePct(String(Math.round((r?.max_net_daily_spend_increase_pct ?? 0.15) * 100)));
  }

  async function load(workspaceId: string, adAccount: AdsAccount) {
    setLoading(true);
    setError(null);
    try {
      setExecutionEnabled(adAccount.execution_enabled !== false);
      const { data, error } = await supabaseOperator
        .from("guardrails")
        .select(
          "id, workspace_id, ad_account_id, cpa_target_micros, roas_target, max_single_budget_change_pct, approval_budget_increase_pct, max_net_daily_spend_increase_pct, min_conversions_for_cpa_action, min_clicks_for_cpa_action, lookback_days, keyword_spend_threshold_micros, bid_reduction_pct, updated_at",
        )
        .eq("workspace_id", workspaceId)
        .eq("ad_account_id", adAccount.id)
        .maybeSingle();
      if (error) throw error;
      populateFromRow((data as GuardrailsRow | null) ?? null);
    } catch (e: any) {
      setError(e?.message || "Failed to load guardrails");
      populateFromRow(null);
    } finally {
      setLoading(false);
    }
  }

  async function setKillSwitch(workspaceId: string, adAccount: AdsAccount, next: boolean) {
    setSavingExecutionEnabled(true);
    try {
      const { error } = await supabaseOperator
        .from("ad_accounts")
        .update({ execution_enabled: next })
        .eq("id", adAccount.id)
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      setExecutionEnabled(next);
      toast({ title: "Saved", description: `AI execution ${next ? "enabled" : "disabled"}.` });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to update execution setting", variant: "destructive" });
      // revert UI toggle
      setExecutionEnabled(adAccount.execution_enabled !== false);
    } finally {
      setSavingExecutionEnabled(false);
    }
  }

  const parsed = useMemo(() => {
    const cpa = cpaTarget.trim() ? Number(cpaTarget) : null;
    const roas = roasTarget.trim() ? Number(roasTarget) : null;
    const kwSpend = Number(keywordSpendThreshold);
    const bidPct = Number(bidReductionPct) / 100;
    const lookback = Number(lookbackDays);
    const minC = Number(minConv);
    const minCl = Number(minClicks);
    const maxSingle = Number(maxSingleBudgetChangePct) / 100;
    const approval = Number(approvalBudgetIncreasePct) / 100;
    const maxNet = Number(maxNetDailySpendIncreasePct) / 100;
    return { cpa, roas, kwSpend, bidPct, lookback, minC, minCl, maxSingle, approval, maxNet };
  }, [
    cpaTarget,
    roasTarget,
    keywordSpendThreshold,
    bidReductionPct,
    lookbackDays,
    minConv,
    minClicks,
    maxSingleBudgetChangePct,
    approvalBudgetIncreasePct,
    maxNetDailySpendIncreasePct,
  ]);

  function validateCaps() {
    if (parsed.maxSingle > 0.2) return "Max single budget change cannot exceed 20%";
    if (parsed.approval > 0.1) return "Approval threshold cannot exceed 10%";
    if (parsed.maxNet > 0.15) return "Max net daily increase cannot exceed 15%";
    if (!(parsed.bidPct > 0 && parsed.bidPct <= 0.5)) return "Bid reduction must be between 1% and 50%";
    if (!(parsed.lookback >= 1 && parsed.lookback <= 90)) return "Lookback days must be 1–90";
    return null;
  }

  async function save(workspaceId: string, adAccount: AdsAccount) {
    const capError = validateCaps();
    if (capError) {
      toast({ title: "Invalid guardrails", description: capError, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        workspace_id: workspaceId,
        ad_account_id: adAccount.id,
        cpa_target_micros: parsed.cpa != null && Number.isFinite(parsed.cpa) ? currencyToMicros(parsed.cpa) : null,
        roas_target: parsed.roas != null && Number.isFinite(parsed.roas) ? parsed.roas : null,
        max_single_budget_change_pct: parsed.maxSingle,
        approval_budget_increase_pct: parsed.approval,
        max_net_daily_spend_increase_pct: parsed.maxNet,
        min_conversions_for_cpa_action: Math.trunc(parsed.minC),
        min_clicks_for_cpa_action: Math.trunc(parsed.minCl),
        lookback_days: Math.trunc(parsed.lookback),
        keyword_spend_threshold_micros: currencyToMicros(parsed.kwSpend),
        bid_reduction_pct: parsed.bidPct,
      };

      const { data, error } = await supabaseOperator
        .from("guardrails")
        .upsert(payload, { onConflict: "workspace_id,ad_account_id" })
        .select(
          "id, workspace_id, ad_account_id, cpa_target_micros, roas_target, max_single_budget_change_pct, approval_budget_increase_pct, max_net_daily_spend_increase_pct, min_conversions_for_cpa_action, min_clicks_for_cpa_action, lookback_days, keyword_spend_threshold_micros, bid_reduction_pct, updated_at",
        )
        .maybeSingle();
      if (error) throw error;

      populateFromRow((data as GuardrailsRow | null) ?? null);
      toast({ title: "Saved", description: "Guardrails updated." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to save guardrails", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdsOperatorLayout title="Guardrails">
      {({ workspaceId, adAccount, currencyCode }) => (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">Edit policy only. Caps are enforced.</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => load(workspaceId, adAccount)} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button size="sm" onClick={() => save(workspaceId, adAccount)} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>

          {error && <div className="text-sm text-destructive mb-4">{error}</div>}

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Execution</CardTitle>
            </CardHeader>
            <CardContent className="flex items-start justify-between gap-6">
              <div className="space-y-1">
                <div className="font-medium">Allow AI execution</div>
                <div className="text-sm text-muted-foreground whitespace-pre-line">
                  When enabled, AI-approved changes will execute inside your guardrails.
                  {"\n"}When disabled, the AI will continue to analyze and propose actions, but nothing will execute.
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={executionEnabled}
                  onCheckedChange={(v) => setKillSwitch(workspaceId, adAccount, v)}
                  disabled={savingExecutionEnabled || loading}
                />
                <div className="text-sm text-muted-foreground w-10 text-right">
                  {executionEnabled ? "On" : "Off"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Policy</CardTitle>
              {row?.updated_at && (
                <div className="text-xs text-muted-foreground">Last updated: {new Date(row.updated_at).toLocaleString()}</div>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label>CPA target ({currencyCode})</Label>
                <Input value={cpaTarget} onChange={(e) => setCpaTarget(e.target.value)} placeholder="e.g. 50" inputMode="decimal" />
              </div>

              <div className="space-y-2">
                <Label>ROAS target</Label>
                <Input value={roasTarget} onChange={(e) => setRoasTarget(e.target.value)} placeholder="e.g. 3.0" inputMode="decimal" />
              </div>

              <div className="space-y-2">
                <Label>Keyword spend threshold ({currencyCode})</Label>
                <Input
                  value={keywordSpendThreshold}
                  onChange={(e) => setKeywordSpendThreshold(e.target.value)}
                  placeholder="e.g. 5"
                  inputMode="decimal"
                />
              </div>

              <div className="space-y-2">
                <Label>Bid reduction (%)</Label>
                <Input value={bidReductionPct} onChange={(e) => setBidReductionPct(e.target.value)} placeholder="20" inputMode="numeric" />
              </div>

              <div className="space-y-2">
                <Label>Lookback days</Label>
                <Input value={lookbackDays} onChange={(e) => setLookbackDays(e.target.value)} placeholder="30" inputMode="numeric" />
              </div>

              <div className="space-y-2">
                <Label>Min conversions for CPA action</Label>
                <Input value={minConv} onChange={(e) => setMinConv(e.target.value)} placeholder="5" inputMode="numeric" />
              </div>

              <div className="space-y-2">
                <Label>Min clicks for CPA action</Label>
                <Input value={minClicks} onChange={(e) => setMinClicks(e.target.value)} placeholder="100" inputMode="numeric" />
              </div>

              <div className="space-y-2">
                <Label>Max single budget change (%) (≤ 20)</Label>
                <Input
                  value={maxSingleBudgetChangePct}
                  onChange={(e) => setMaxSingleBudgetChangePct(e.target.value)}
                  placeholder="20"
                  inputMode="numeric"
                />
              </div>

              <div className="space-y-2">
                <Label>Budget increase approval threshold (%) (≤ 10)</Label>
                <Input
                  value={approvalBudgetIncreasePct}
                  onChange={(e) => setApprovalBudgetIncreasePct(e.target.value)}
                  placeholder="10"
                  inputMode="numeric"
                />
              </div>

              <div className="space-y-2">
                <Label>Max net daily spend increase (%) (≤ 15)</Label>
                <Input
                  value={maxNetDailySpendIncreasePct}
                  onChange={(e) => setMaxNetDailySpendIncreasePct(e.target.value)}
                  placeholder="15"
                  inputMode="numeric"
                />
              </div>
            </CardContent>
          </Card>

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

