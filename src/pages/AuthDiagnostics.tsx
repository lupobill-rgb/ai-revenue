import { useEffect, useMemo, useState } from "react";
import { supabase, SUPABASE_URL, supabaseEnvError } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type JwtPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  sub?: string;
  ref?: string;
};

function base64UrlDecode(input: string) {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64);
}

function decodeJwtPayload(jwt: string): JwtPayload | null {
  try {
    const part = jwt.split(".")[1];
    if (!part) return null;
    return JSON.parse(base64UrlDecode(part));
  } catch {
    return null;
  }
}

function inferProjectRefFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname || "";
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
}

function inferProjectRefFromIssuer(iss: string | undefined): string | null {
  if (!iss) return null;
  try {
    const u = new URL(iss);
    const host = u.hostname || "";
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
}

export default function AuthDiagnostics() {
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionExp, setSessionExp] = useState<number | null>(null);
  const [tokenIss, setTokenIss] = useState<string | null>(null);
  const [tokenAud, setTokenAud] = useState<string | null>(null);
  const [tokenRef, setTokenRef] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [storageOk, setStorageOk] = useState<boolean | null>(null);
  const [sbKeyCount, setSbKeyCount] = useState<number>(0);
  const [testEmail, setTestEmail] = useState("");
  const [testPassword, setTestPassword] = useState("");
  const [testingSignIn, setTestingSignIn] = useState(false);
  const [lastSignInResult, setLastSignInResult] = useState<string | null>(null);

  const envRef = useMemo(() => inferProjectRefFromUrl(SUPABASE_URL), []);

  const refresh = async () => {
    setLoading(true);
    setLastError(null);
    try {
      // Storage diagnostics
      try {
        const k = "__auth_diag_test__";
        window.localStorage.setItem(k, "1");
        window.localStorage.removeItem(k);
        setStorageOk(true);
      } catch {
        setStorageOk(false);
      }

      try {
        let count = 0;
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k?.startsWith("sb-")) count++;
        }
        setSbKeyCount(count);
      } catch {
        setSbKeyCount(0);
      }

      await supabase.auth.refreshSession();
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      const token = data.session?.access_token ?? null;
      setAccessToken(token);
      setUserId(data.session?.user?.id ?? null);

      if (token) {
        const payload = decodeJwtPayload(token);
        setTokenIss(payload?.iss ?? null);
        setTokenAud(Array.isArray(payload?.aud) ? payload?.aud.join(",") : (payload?.aud ?? null));
        setTokenRef(inferProjectRefFromIssuer(payload?.iss));
        setSessionExp(payload?.exp ?? null);
      } else {
        setTokenIss(null);
        setTokenAud(null);
        setTokenRef(null);
        setSessionExp(null);
      }
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mismatch = Boolean(envRef && tokenRef && envRef !== tokenRef);

  const clearAuthStorageAndReload = () => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k) keys.push(k);
      }
      keys
        .filter((k) => k.startsWith("sb-"))
        .forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // ignore
    } finally {
      window.location.reload();
    }
  };

  const signOut = async () => {
    setLastError(null);
    try {
      await supabase.auth.signOut();
      window.location.reload();
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    }
  };

  const testSignInWithPassword = async () => {
    setLastSignInResult(null);
    setLastError(null);
    setTestingSignIn(true);
    try {
      const email = testEmail.trim();
      const password = testPassword;
      if (!email || !password) {
        setLastSignInResult("Missing email or password");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLastSignInResult(`ERROR: ${error.message}`);
        return;
      }

      // Important: Supabase can return user but no session in some scenarios (e.g. not confirmed).
      const hasSessionNow = Boolean(data.session?.access_token);
      setLastSignInResult(
        `OK: user=${data.user?.id ?? "(none)"} session=${hasSessionNow ? "present" : "missing"}`
      );

      // Re-read from client to confirm persistence.
      await refresh();
    } catch (e) {
      setLastSignInResult(e instanceof Error ? `ERROR: ${e.message}` : `ERROR: ${String(e)}`);
    } finally {
      setTestingSignIn(false);
    }
  };

  const copyReport = async () => {
    const report = {
      supabaseUrl: SUPABASE_URL,
      supabaseEnvError,
      envRef,
      hasSession: Boolean(accessToken),
      userId,
      tokenIss,
      tokenAud,
      tokenRef,
      tokenExp: sessionExp,
      tokenExpISO: sessionExp ? new Date(sessionExp * 1000).toISOString() : null,
      projectMismatch: mismatch,
      lastError,
      origin: typeof window !== "undefined" ? window.location.origin : null,
      localStorageAvailable: storageOk,
      sbKeyCount,
      lastSignInResult,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Auth Diagnostics</CardTitle>
            <CardDescription>
              Use this page when Edge Functions return <span className="font-mono">401 Invalid JWT</span> and you
              can’t access DevTools/Console.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {supabaseEnvError ? (
              <div className="p-3 rounded border border-destructive/40 bg-destructive/10">
                <div className="font-medium">Supabase config error</div>
                <div className="text-sm font-mono mt-1">{supabaseEnvError}</div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Origin</div>
                <div className="font-mono text-sm break-all">{typeof window !== "undefined" ? window.location.origin : "(unknown)"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">SUPABASE_URL</div>
                <div className="font-mono text-sm break-all">{SUPABASE_URL || "(missing)"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">localStorage</div>
                <div className="flex items-center gap-2">
                  {storageOk === null ? (
                    <Badge variant="secondary">Checking…</Badge>
                  ) : storageOk ? (
                    <Badge className="bg-green-600">Available</Badge>
                  ) : (
                    <Badge variant="destructive">Blocked</Badge>
                  )}
                  <Badge variant="secondary">sb-keys: {sbKeyCount}</Badge>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Configured project ref</div>
                <div className="font-mono text-sm">{envRef || "(unknown)"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Session</div>
                <div className="flex items-center gap-2">
                  {loading ? (
                    <Badge variant="secondary">Loading…</Badge>
                  ) : accessToken ? (
                    <Badge className="bg-green-600">Present</Badge>
                  ) : (
                    <Badge variant="destructive">Missing</Badge>
                  )}
                  {mismatch ? <Badge variant="destructive">Project mismatch</Badge> : null}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Token issuer</div>
                <div className="font-mono text-sm break-all">{tokenIss || "(none)"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Token project ref</div>
                <div className="font-mono text-sm">{tokenRef || "(unknown)"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Token expires</div>
                <div className="font-mono text-sm">
                  {sessionExp ? new Date(sessionExp * 1000).toLocaleString() : "(unknown)"}
                </div>
              </div>
            </div>

            {lastError ? (
              <div className="p-3 rounded border border-destructive/40 bg-destructive/10">
                <div className="font-medium">Last error</div>
                <div className="text-sm font-mono mt-1 break-all">{lastError}</div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={copyReport} disabled={loading}>
                Copy report
              </Button>
              <Button variant="outline" onClick={refresh} disabled={loading}>
                Refresh
              </Button>
              <Button variant="outline" onClick={signOut} disabled={loading}>
                Sign out
              </Button>
              <Button variant="destructive" onClick={clearAuthStorageAndReload}>
                Clear auth storage + reload
              </Button>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <div className="font-medium">Test sign-in (no DevTools required)</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="diag-email">Email</Label>
                  <Input
                    id="diag-email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="diag-password">Password</Label>
                  <Input
                    id="diag-password"
                    type="password"
                    value={testPassword}
                    onChange={(e) => setTestPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={testSignInWithPassword} disabled={testingSignIn}>
                  {testingSignIn ? "Signing in…" : "Test signInWithPassword"}
                </Button>
                {lastSignInResult ? <Badge variant="secondary">{lastSignInResult}</Badge> : null}
              </div>
              <div className="text-xs text-muted-foreground">
                If this returns <b>OK ... session=missing</b>, your Supabase Auth is not issuing a session for this user
                (often email not confirmed or auth policy). If it returns an error, we can act on that message.
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              If you see <b>Project mismatch</b>, click <b>Clear auth storage + reload</b>, then sign in again.
            </div>
            {!accessToken ? (
              <div className="text-sm text-muted-foreground">
                If <b>Session</b> is missing and <b>localStorage</b> is blocked, you must allow site data/cookies for this
                origin in your browser security settings, then sign in again.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

