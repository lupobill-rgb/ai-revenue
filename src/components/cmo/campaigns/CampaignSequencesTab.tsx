import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Mail, MessageSquare, Phone, Clock, ArrowRight, Play, Pause } from "lucide-react";

interface CampaignSequencesTabProps {
  campaignId: string;
  workspaceId: string;
}

interface Sequence {
  id: string;
  name: string;
  status: string;
  created_at: string;
  steps: SequenceStep[];
}

interface SequenceStep {
  id: string;
  step_order: number;
  channel: string;
  delay_days: number;
  subject?: string;
  template?: string;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  voice: <Phone className="h-4 w-4" />,
  linkedin: <MessageSquare className="h-4 w-4" />,
};

export default function CampaignSequencesTab({ campaignId, workspaceId }: CampaignSequencesTabProps) {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSequences = async () => {
      setIsLoading(true);
      try {
        // Fetch outbound sequences linked to this campaign
        const { data: seqData, error: seqError } = await supabase
          .from("outbound_sequences")
          .select("id, name, created_at")
          .eq("campaign_id", campaignId)
          .order("created_at", { ascending: false });

        if (seqError) throw seqError;

        // Fetch steps for each sequence
        const sequenceIds = (seqData || []).map((s) => s.id);
        
        let stepsData: any[] = [];
        if (sequenceIds.length > 0) {
          const { data, error: stepsError } = await supabase
            .from("outbound_sequence_steps")
            .select("id, sequence_id, step_order, channel, delay_days, subject, template")
            .in("sequence_id", sequenceIds)
            .order("step_order", { ascending: true });

          if (stepsError) throw stepsError;
          stepsData = data || [];
        }

        // Combine sequences with their steps
        const enriched: Sequence[] = (seqData || []).map((seq) => ({
          id: seq.id,
          name: seq.name,
          status: "active", // Default status since column doesn't exist
          created_at: seq.created_at,
          steps: stepsData.filter((step) => step.sequence_id === seq.id),
        }));

        setSequences(enriched);
      } catch (err) {
        console.error("Error fetching sequences:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSequences();
  }, [campaignId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (sequences.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No sequences yet</p>
          <p className="text-muted-foreground mt-1">
            Automation sequences will appear here when the campaign is built
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {sequences.map((sequence) => (
        <Card key={sequence.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{sequence.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant={sequence.status === "active" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {sequence.status}
                  </Badge>
                  <span className="text-xs">
                    {sequence.steps.length} steps
                  </span>
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                {sequence.status === "active" ? (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Activate
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Steps Timeline */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {sequence.steps.map((step, idx) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center min-w-[120px]">
                    <div className="p-3 bg-muted rounded-lg">
                      {CHANNEL_ICONS[step.channel] || <Mail className="h-4 w-4" />}
                    </div>
                    <p className="text-xs font-medium mt-2 capitalize">{step.channel}</p>
                    {step.delay_days > 0 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        +{step.delay_days}d
                      </p>
                    )}
                    {step.subject && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-[100px] truncate">
                        {step.subject}
                      </p>
                    )}
                  </div>
                  {idx < sequence.steps.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground mx-2 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
