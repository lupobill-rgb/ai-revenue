import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Brain,
  Mail,
  Clock,
  Target,
  TrendingUp,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  ThermometerSun,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company?: string;
  job_title?: string;
  status: string;
  score: number;
  vertical?: string;
}

interface EngagementAnalysis {
  engagement_level: "cold" | "warm" | "hot";
  interest_signals: string[];
  pain_points: string[];
  recommended_approach: string;
  urgency_score: number;
  best_channel: string;
  optimal_timing: string;
  talking_points: string[];
  raw_engagement: {
    emailOpens: number;
    emailClicks: number;
    daysSinceLastContact: number;
    totalTouchpoints: number;
  };
}

interface SequenceStep {
  step_number: number;
  delay_days: number;
  trigger_condition: string;
  subject_line: string;
  email_body: string;
  goal: string;
  cta: string;
}

interface LeadNurturingProps {
  lead: Lead;
  onUpdate?: () => void;
}

export function LeadNurturing({ lead, onUpdate }: LeadNurturingProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [executing, setExecuting] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<EngagementAnalysis | null>(null);
  const [sequence, setSequence] = useState<SequenceStep[]>([]);
  const [executedSteps, setExecutedSteps] = useState<number[]>([]);

  const analyzeEngagement = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-lead-nurturing", {
        body: { leadId: lead.id, action: "analyze" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAnalysis(data.analysis);
      toast.success("Engagement analysis complete");
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const generateSequence = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-lead-nurturing", {
        body: { leadId: lead.id, action: "generate_sequence" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSequence(data.sequence);
      setExecutedSteps([]);
      toast.success("Nurturing sequence generated");
    } catch (error) {
      console.error("Sequence generation error:", error);
      toast.error(error instanceof Error ? error.message : "Sequence generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const executeStep = async (stepIndex: number) => {
    if (executedSteps.includes(stepIndex)) {
      toast.info("This step has already been executed");
      return;
    }

    setExecuting(stepIndex);
    try {
      const step = sequence[stepIndex];
      const { data, error } = await supabase.functions.invoke("ai-lead-nurturing", {
        body: { leadId: lead.id, action: "execute_step", stepIndex, step },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setExecutedSteps([...executedSteps, stepIndex]);
      toast.success(`Step ${stepIndex + 1} executed - email sent!`);
      onUpdate?.();
    } catch (error) {
      console.error("Step execution error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to execute step");
    } finally {
      setExecuting(null);
    }
  };

  const getEngagementColor = (level: string) => {
    switch (level) {
      case "hot":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "warm":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  const getEngagementIcon = (level: string) => {
    switch (level) {
      case "hot":
        return <ThermometerSun className="h-4 w-4 text-red-500" />;
      case "warm":
        return <ThermometerSun className="h-4 w-4 text-amber-500" />;
      default:
        return <ThermometerSun className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Lead Nurturing
            </CardTitle>
            <CardDescription>
              Automated follow-up sequences based on engagement
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <Zap className="h-3 w-3" />
            AI-Powered
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="analyze" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="analyze" className="gap-2">
              <Brain className="h-4 w-4" />
              Analyze
            </TabsTrigger>
            <TabsTrigger value="sequence" className="gap-2">
              <Mail className="h-4 w-4" />
              Sequence
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analyze" className="space-y-4">
            <Button
              onClick={analyzeEngagement}
              disabled={analyzing}
              className="w-full"
              variant="outline"
            >
              {analyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Engagement...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Analyze Lead Engagement
                </>
              )}
            </Button>

            {analysis && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2">
                    {getEngagementIcon(analysis.engagement_level)}
                    <span className="font-medium">Engagement Level</span>
                  </div>
                  <Badge className={getEngagementColor(analysis.engagement_level)}>
                    {analysis.engagement_level.toUpperCase()}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border bg-card">
                    <div className="text-sm text-muted-foreground">Urgency Score</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={analysis.urgency_score * 10} className="flex-1" />
                      <span className="font-bold">{analysis.urgency_score}/10</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <div className="text-sm text-muted-foreground">Best Channel</div>
                    <div className="font-medium mt-1 capitalize">{analysis.best_channel}</div>
                  </div>
                </div>

                <div className="p-3 rounded-lg border bg-card space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4" />
                    Optimal Timing
                  </div>
                  <p className="text-sm text-muted-foreground">{analysis.optimal_timing}</p>
                </div>

                <div className="p-3 rounded-lg border bg-card space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Target className="h-4 w-4" />
                    Recommended Approach
                  </div>
                  <p className="text-sm text-muted-foreground">{analysis.recommended_approach}</p>
                </div>

                {analysis.interest_signals?.length > 0 && (
                  <div className="p-3 rounded-lg border bg-card space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <TrendingUp className="h-4 w-4" />
                      Interest Signals
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {analysis.interest_signals.map((signal, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {signal}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.talking_points?.length > 0 && (
                  <div className="p-3 rounded-lg border bg-card space-y-2">
                    <div className="text-sm font-medium">Talking Points</div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {analysis.talking_points.slice(0, 4).map((point, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sequence" className="space-y-4">
            <Button
              onClick={generateSequence}
              disabled={generating}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Sequence...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Nurturing Sequence
                </>
              )}
            </Button>

            {sequence.length > 0 && (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {sequence.map((step, index) => (
                    <Card
                      key={index}
                      className={`transition-all ${
                        executedSteps.includes(index)
                          ? "border-green-500/50 bg-green-500/5"
                          : ""
                      }`}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="gap-1">
                              Step {step.step_number}
                            </Badge>
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Clock className="h-3 w-3" />
                              +{step.delay_days} days
                            </Badge>
                          </div>
                          {executedSteps.includes(index) ? (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Sent
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => executeStep(index)}
                              disabled={executing === index}
                            >
                              {executing === index ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Play className="mr-1 h-3 w-3" />
                                  Send Now
                                </>
                              )}
                            </Button>
                          )}
                        </div>

                        <div>
                          <div className="font-medium text-sm">{step.subject_line}</div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {step.email_body.substring(0, 150)}...
                          </p>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="outline" className="gap-1">
                            <Target className="h-3 w-3" />
                            {step.goal}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {step.trigger_condition}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}

            {sequence.length === 0 && !generating && (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Generate a personalized nurturing sequence</p>
                <p className="text-sm">AI will create emails based on lead engagement</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
