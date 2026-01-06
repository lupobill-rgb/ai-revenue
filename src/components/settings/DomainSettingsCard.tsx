/**
 * Domain Settings Card Component
 * Handles custom domain configuration with DNS verification
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Globe, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Loader2, 
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";

interface DomainSettings {
  tenant_id: string;
  domain: string;
  cname_verified: boolean;
  updated_at: string | null;
}

interface DomainSettingsCardProps {
  domain: string;
  setDomain: (domain: string) => void;
  domainSettings: DomainSettings | null;
  setDomainSettings: (settings: DomainSettings | null) => void;
  tenantId: string | null;
  saving: string | null;
  setSaving: (saving: string | null) => void;
  copyToClipboard: (text: string) => void;
  formatUpdatedAt: (date: string) => string;
  detectChanges: (oldData: any, newData: any) => Record<string, { old: any; new: any }>;
  logAuditEntry: (type: string, changes: Record<string, { old: any; new: any }>, isCreate: boolean) => Promise<void>;
  formatChangesList: (changes: Record<string, { old: any; new: any }>) => string[];
}

// DNS verification is now handled server-side without hardcoded target

export function DomainSettingsCard({
  domain,
  setDomain,
  domainSettings,
  setDomainSettings,
  tenantId,
  saving,
  setSaving,
  copyToClipboard,
  formatUpdatedAt,
  detectChanges,
  logAuditEntry,
  formatChangesList,
}: DomainSettingsCardProps) {
  const [verifying, setVerifying] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState<boolean | null>(null);

  const verifyDomainDns = async () => {
    if (!domain) {
      toast({ 
        title: "No domain", 
        description: "Please enter a domain first.", 
        variant: "destructive" 
      });
      return;
    }

    setVerifying(true);
    setVerificationMessage(null);
    setVerificationSuccess(null);

    try {
      const { data, error } = await supabase.functions.invoke("verify-domain-dns", {
        body: { domain, tenantId },
      });

      if (error) {
        console.error("Domain verification error:", error);
        setVerificationMessage("Failed to verify domain. Please try again.");
        setVerificationSuccess(false);
        toast({ 
          title: "Verification failed", 
          description: error.message, 
          variant: "destructive" 
        });
        return;
      }

      setVerificationMessage(data.message);
      setVerificationSuccess(data.verified);

      if (data.verified) {
        // Update local state to reflect verification
        if (domainSettings) {
          setDomainSettings({
            ...domainSettings,
            cname_verified: true,
            updated_at: new Date().toISOString(),
          });
        }
        toast({ 
          title: "✓ Domain Verified!", 
          description: `${domain} is correctly configured.`
        });
      } else {
        toast({ 
          title: "Verification incomplete", 
          description: data.message,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Domain verification error:", error);
      setVerificationMessage("Failed to verify domain. Please try again.");
      setVerificationSuccess(false);
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setVerifying(false);
    }
  };

  const saveDomainSettings = async () => {
    if (!tenantId) return;
    setSaving("domain");

    try {
      const payload = {
        tenant_id: tenantId,
        domain: domain,
        cname_verified: domainSettings?.cname_verified || false,
        updated_at: new Date().toISOString(),
      };

      const changes = detectChanges(domainSettings || {}, payload);
      const isCreate = !domainSettings;

      if (Object.keys(changes).length === 0) {
        toast({ title: "No changes", description: "No changes were detected to save." });
        setSaving(null);
        return;
      }

      const { error } = await supabase
        .from("ai_settings_domain")
        .upsert(payload, { onConflict: "tenant_id" });

      if (error) throw error;

      await logAuditEntry('domain', changes, isCreate);

      setDomainSettings({ ...payload, updated_at: payload.updated_at });
      
      const changesList = formatChangesList(changes);
      toast({ 
        title: "✓ Domain Settings Updated", 
        description: (
          <div className="mt-2 space-y-1">
            {changesList.map((change, i) => (
              <div key={i} className="text-sm">• {change}</div>
            ))}
            <div className="text-xs text-muted-foreground mt-2">
              Saved at {format(new Date(), "h:mm a")}
            </div>
          </div>
        ),
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          Custom Domain
        </CardTitle>
        <CardDescription>
          Use your own domain for landing pages and email tracking links.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="custom-domain">Domain</Label>
          <div className="flex items-center gap-2">
            <Input
              id="custom-domain"
              placeholder="campaigns.yourcompany.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            {domainSettings?.cname_verified ? (
              <Badge variant="outline" className="text-green-600 border-green-600 shrink-0">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
              </Badge>
            ) : domain ? (
              <Badge variant="outline" className="text-yellow-600 border-yellow-600 shrink-0">
                <XCircle className="h-3 w-3 mr-1" /> Not Verified
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">DNS Configuration</p>
          <p className="text-sm text-muted-foreground">
            Configure your domain's DNS to point to your production server. You can use either:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 mt-2">
            <li><strong>CNAME record</strong>: Point to your production domain</li>
            <li><strong>A record</strong>: Point to your server's IP address</li>
          </ul>

          <div className="pt-2">
            <Button
              variant="default"
              onClick={verifyDomainDns}
              disabled={verifying || !domain}
              className="w-full sm:w-auto"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying DNS...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Verify Domain Now
                </>
              )}
            </Button>
          </div>
        </div>

        {verificationMessage && (
          <Alert className={verificationSuccess ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}>
            {verificationSuccess ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <AlertDescription className={verificationSuccess ? "text-green-600" : "text-amber-600"}>
              {verificationMessage}
            </AlertDescription>
          </Alert>
        )}

        {!domainSettings?.cname_verified && domain && (
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">How to configure DNS:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Log in to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)</li>
              <li>Navigate to DNS settings for <strong>{domain.split('.').slice(-2).join('.')}</strong></li>
              <li>Add a <strong>CNAME</strong> or <strong>A</strong> record for your subdomain</li>
              <li>Set the <strong>Name/Host</strong> to: <code className="bg-muted px-1 rounded">{domain.split('.')[0]}</code></li>
              <li>Point it to your production domain or server IP</li>
              <li>Save and wait 5-30 minutes for DNS propagation</li>
              <li>Click "Verify Domain Now" above</li>
            </ol>
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            {domainSettings?.updated_at && (
              <p className="text-sm text-muted-foreground">
                Last updated: {formatUpdatedAt(domainSettings.updated_at)}
              </p>
            )}
          </div>
          <Button onClick={saveDomainSettings} disabled={saving === "domain"}>
            {saving === "domain" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Domain Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default DomainSettingsCard;
