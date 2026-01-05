/**
 * Domain Verification Helper
 * Helps users verify their sending domain with Resend
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  Loader2, 
  Globe, 
  ExternalLink,
  Copy,
  RefreshCw,
  AlertTriangle,
  Plus
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface DomainVerificationHelperProps {
  domain: string;
  emailMethod: "resend" | "gmail" | "smtp";
  isGmailConnected?: boolean;
}

interface DnsRecord {
  record: string;
  name: string;
  type: string;
  ttl: string;
  status: string;
  value: string;
  priority?: number;
}

type VerificationStatus = "unknown" | "checking" | "verified" | "pending" | "not_found" | "added";

export function DomainVerificationHelper({
  domain,
  emailMethod,
  isGmailConnected = false,
}: DomainVerificationHelperProps) {
  const [status, setStatus] = useState<VerificationStatus>("unknown");
  const [checking, setChecking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [message, setMessage] = useState("");

  const checkDomainStatus = async (action?: "verify") => {
    if (!domain) {
      toast.error("No domain to check");
      return;
    }

    setChecking(true);

    try {
      const { data, error } = await supabase.functions.invoke("resend-verify-domain", {
        body: { domain, action },
      });

      if (error) {
        console.error("Domain check error:", error);
        toast.error("Failed to check domain status");
        setStatus("unknown");
        return;
      }

      setStatus(data.status as VerificationStatus);
      setMessage(data.message || "");
      if (data.records) {
        setDnsRecords(data.records);
      }

      if (data.status === "verified") {
        toast.success("Domain is verified!");
      } else if (data.status === "pending") {
        toast.info("Domain verification pending - DNS records may take time to propagate");
      }
    } catch (error) {
      console.error("Domain check error:", error);
      toast.error("Failed to check domain status");
      setStatus("unknown");
    } finally {
      setChecking(false);
    }
  };

  const addDomainToResend = async () => {
    if (!domain) {
      toast.error("No domain to add");
      return;
    }

    setAdding(true);

    try {
      const { data, error } = await supabase.functions.invoke("resend-verify-domain", {
        body: { domain, action: "add" },
      });

      if (error) {
        console.error("Add domain error:", error);
        toast.error("Failed to add domain to Resend");
        return;
      }

      setStatus(data.status as VerificationStatus);
      setMessage(data.message || "");
      if (data.records) {
        setDnsRecords(data.records);
      }

      toast.success("Domain added to Resend! Please configure DNS records.");
    } catch (error) {
      console.error("Add domain error:", error);
      toast.error("Failed to add domain");
    } finally {
      setAdding(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Gmail doesn't need domain verification
  if (emailMethod === "gmail" && isGmailConnected) {
    return (
      <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <p className="font-medium text-green-700">Domain Verified via Gmail</p>
            <p className="text-sm text-green-600">
              Your emails are sent through Gmail's authenticated servers.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!domain) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No Domain Detected</AlertTitle>
        <AlertDescription>
          Enter a From Address above to check domain verification status.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <span className="font-medium">{domain}</span>
          </div>
          
          {status === "unknown" && (
            <Badge variant="outline">Not Checked</Badge>
          )}
          {status === "checking" && (
            <Badge variant="outline" className="text-blue-500 border-blue-500">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Checking
            </Badge>
          )}
          {status === "verified" && (
            <Badge className="bg-green-500">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          )}
          {(status === "pending" || status === "added") && (
            <Badge variant="outline" className="text-amber-500 border-amber-500">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Pending Verification
            </Badge>
          )}
          {status === "not_found" && (
            <Badge variant="outline" className="text-red-500 border-red-500">
              Not in Resend
            </Badge>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {status === "not_found" ? (
            <Button
              variant="default"
              size="sm"
              onClick={addDomainToResend}
              disabled={adding}
            >
              {adding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Domain to Resend
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkDomainStatus("verify")}
              disabled={checking}
            >
              {checking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Verify Now
                </>
              )}
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkDomainStatus()}
            disabled={checking}
          >
            Check Status
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("https://resend.com/domains", "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Resend
          </Button>
        </div>
      </div>

      {message && (
        <Alert className={status === "verified" ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}>
          {status === "verified" ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
          <AlertDescription className={status === "verified" ? "text-green-600" : "text-amber-600"}>
            {message}
          </AlertDescription>
        </Alert>
      )}

      {dnsRecords.length > 0 && status !== "verified" && (
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Required DNS Records from Resend:</h4>
          
          <div className="space-y-2">
            {dnsRecords.map((record, i) => (
              <div
                key={i}
                className="p-3 rounded border bg-background text-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">{record.type}</Badge>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          record.status === "verified" 
                            ? "text-green-500 border-green-500" 
                            : record.status === "pending"
                            ? "text-amber-500 border-amber-500"
                            : "text-muted-foreground"
                        }`}
                      >
                        {record.status}
                      </Badge>
                      {record.priority && (
                        <span className="text-xs text-muted-foreground">Priority: {record.priority}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      <div>
                        <p className="text-xs text-muted-foreground">Name:</p>
                        <p className="font-mono text-xs break-all">{record.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mt-1">Value:</p>
                        <p className="font-mono text-xs break-all">{record.value}</p>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => copyToClipboard(record.value)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            DNS changes can take up to 48 hours to propagate. Click "Verify Now" after adding records.
          </p>
        </div>
      )}

      {status === "verified" && (
        <Alert className="border-green-500/30 bg-green-500/5">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-700">Domain Verified</AlertTitle>
          <AlertDescription className="text-green-600">
            Your domain is properly configured. Emails from {domain} will have optimal deliverability.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default DomainVerificationHelper;
