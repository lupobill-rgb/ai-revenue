import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveWorkspaceId } from "@/contexts/WorkspaceContext";
import { supabaseOperator } from "@/integrations/supabase/operatorClient";

export type AdsAccount = {
  id: string;
  customer_id: string;
  login_customer_id?: string | null;
  name?: string | null;
  currency_code?: string | null;
  time_zone?: string | null;
  is_active?: boolean | null;
  execution_enabled?: boolean | null;
};

export function useAdsAccounts(workspaceId: string | null) {
  const [accounts, setAccounts] = useState<AdsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!workspaceId) {
        setAccounts([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabaseOperator
          .from("ad_accounts")
          .select("id, customer_id, login_customer_id, name, currency_code, time_zone, is_active, execution_enabled")
          .eq("workspace_id", workspaceId)
          .eq("provider", "google_ads")
          .eq("is_active", true)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (!cancelled) setAccounts((data || []) as AdsAccount[]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load ad accounts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return { accounts, loading, error };
}

export default function AdsOperatorLayout(props: {
  title: string;
  children: (ctx: { workspaceId: string; adAccount: AdsAccount; currencyCode: string }) => React.ReactNode;
}) {
  const workspaceId = useActiveWorkspaceId();
  const { accounts, loading, error } = useAdsAccounts(workspaceId);
  const [selectedId, setSelectedId] = useState<string>("");
  const location = useLocation();

  useEffect(() => {
    if (!selectedId && accounts.length > 0) setSelectedId(accounts[0]!.id);
  }, [accounts, selectedId]);

  const selected = useMemo(() => accounts.find((a) => a.id === selectedId) || null, [accounts, selectedId]);
  const currencyCode = selected?.currency_code || "USD";

  const tabs = [
    { path: "/ads-operator", label: "Activity" },
    { path: "/ads-operator/approvals", label: "Approvals" },
    { path: "/ads-operator/guardrails", label: "Guardrails" },
    { path: "/ads-operator/weekly", label: "Weekly" },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-background">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">{props.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review-only UI for AI-executed Google Ads actions. No manual editing.
            </p>
          </div>

          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="w-full md:max-w-md">
                <Select value={selectedId} onValueChange={setSelectedId} disabled={loading || accounts.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={loading ? "Loading accounts…" : "Select an account"} />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name ? `${a.name} — ${a.customer_id}` : a.customer_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {error && <div className="text-sm text-destructive mt-2">{error}</div>}
                {!loading && accounts.length === 0 && (
                  <div className="text-sm text-muted-foreground mt-2">
                    No Google Ads accounts are connected for this workspace yet.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {tabs.map((t) => {
                  const active = location.pathname === t.path;
                  return (
                    <Link
                      key={t.path}
                      to={t.path}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      }`}
                    >
                      {t.label}
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {workspaceId && selected ? (
            props.children({ workspaceId, adAccount: selected, currencyCode })
          ) : (
            <Card>
              <CardContent className="py-10 text-muted-foreground text-sm">Select an ad account to continue.</CardContent>
            </Card>
          )}
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}

