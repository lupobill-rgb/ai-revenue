import { useState } from "react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useActiveWorkspaceId } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SmsSendResponse = {
  status: "accepted" | "blocked" | "failed";
  reason: string | null;
  message_id: string | null;
};

export default function StandaloneSMS() {
  const workspaceId = useActiveWorkspaceId();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<SmsSendResponse | null>(null);

  const onSend = async () => {
    if (!workspaceId) return;
    setIsSending(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sms_send", {
        body: { phone, message, workspaceId },
      });

      if (error) {
        setResult({ status: "failed", reason: error.message, message_id: null });
      } else {
        setResult(data as SmsSendResponse);
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8">
          <WorkspaceGate feature="Standalone SMS Send">
            <Card>
              <CardHeader>
                <CardTitle>Standalone SMS Send</CardTitle>
                <CardDescription>Send one SMS and see the returned result.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sms-phone">Phone</Label>
                  <Input
                    id="sms-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+15551234567"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sms-message">Message</Label>
                  <Textarea
                    id="sms-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your SMS..."
                    rows={4}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={onSend} disabled={isSending || !phone.trim() || !message.trim()}>
                    {isSending ? "Sending..." : "Send SMS"}
                  </Button>
                </div>

                {result && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                    <div>
                      <strong>Status:</strong> {result.status}
                    </div>
                    <div>
                      <strong>Reason:</strong> {result.reason ?? "null"}
                    </div>
                    <div>
                      <strong>Message ID:</strong> {result.message_id ?? "null"}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </WorkspaceGate>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}

