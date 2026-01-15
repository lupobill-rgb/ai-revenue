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

type VoicemailDropResponse = {
  status: "accepted" | "failed";
  audio_fetch_status: number;
  job_id: null;
};

export default function VoicemailDrop() {
  const workspaceId = useActiveWorkspaceId();
  const [phone, setPhone] = useState("");
  const [audioUrl, setAudioUrl] = useState("https://demo.twilio.com/docs/classic.mp3");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<VoicemailDropResponse | null>(null);

  const onDrop = async () => {
    if (!workspaceId) return;
    setIsSending(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("voicemail_drop", {
        body: { phone, audioUrl, workspaceId },
      });

      if (error) {
        setResult({ status: "failed", audio_fetch_status: 0, job_id: null });
      } else {
        setResult(data as VoicemailDropResponse);
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
          <WorkspaceGate feature="Standalone Voicemail Drop">
            <Card>
              <CardHeader>
                <CardTitle>Standalone Voicemail Drop</CardTitle>
                <CardDescription>Drop one voicemail (plays audio) and see the returned result.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vm-phone">Phone</Label>
                  <Input
                    id="vm-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+15551234567"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vm-audio">Audio URL</Label>
                  <Input
                    id="vm-audio"
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    placeholder="https://..."
                    inputMode="url"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={onDrop} disabled={isSending || !phone.trim()}>
                    {isSending ? "Submitting..." : "Drop Voicemail"}
                  </Button>
                </div>

                {result && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                    <div>
                      <strong>Status:</strong> {result.status}
                    </div>
                    <div>
                      <strong>Audio fetch status:</strong> {result.audio_fetch_status}
                    </div>
                    <div>
                      <strong>Job ID:</strong> null
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

