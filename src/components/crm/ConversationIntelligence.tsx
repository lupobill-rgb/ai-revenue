import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Brain,
  Lightbulb,
  FileText,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  Users,
  DollarSign,
  Clock,
  Target,
  Quote,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  company?: string;
}

interface ConversationAnalysis {
  sentiment: "positive" | "neutral" | "negative";
  sentiment_score: number;
  buying_signals: string[];
  objections: string[];
  pain_points: string[];
  decision_makers: string[];
  budget_indicators: string[];
  timeline_indicators: string[];
  competitors_mentioned: string[];
  next_steps_discussed: string[];
  key_quotes: string[];
  relationship_strength: string;
  deal_stage_recommendation: string;
  follow_up_topics: string[];
}

interface LeadInsights {
  engagement_pattern: string;
  best_contact_times: string;
  preferred_channels: string;
  interest_level: number;
  decision_timeline: string;
  value_proposition_fit: string;
  conversation_starters: string[];
  success_predictors: string[];
}

interface ExecutiveSummary {
  executive_summary: string;
  opportunity_assessment: string;
  current_status: string;
  next_best_action: string;
  deal_probability: number;
}

interface ConversationIntelligenceProps {
  lead: Lead;
}

export function ConversationIntelligence({ lead }: ConversationIntelligenceProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [conversationText, setConversationText] = useState("");
  const [analysis, setAnalysis] = useState<ConversationAnalysis | null>(null);
  const [insights, setInsights] = useState<LeadInsights | null>(null);
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);

  const analyzeConversation = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("conversation-intelligence", {
        body: { action: "analyze_notes", leadId: lead.id, conversationText },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAnalysis(data.analysis);
      toast.success("Conversation analyzed");
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const extractInsights = async () => {
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("conversation-intelligence", {
        body: { action: "extract_insights", leadId: lead.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setInsights(data.insights);
      toast.success("Insights extracted");
    } catch (error) {
      console.error("Extraction error:", error);
      toast.error(error instanceof Error ? error.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const generateSummary = async () => {
    setSummarizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("conversation-intelligence", {
        body: { action: "generate_summary", leadId: lead.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSummary(data.summary);
      toast.success("Summary generated");
    } catch (error) {
      console.error("Summary error:", error);
      toast.error(error instanceof Error ? error.message : "Summary failed");
    } finally {
      setSummarizing(false);
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return <ThumbsUp className="h-4 w-4 text-green-500" />;
      case "negative": return <ThumbsDown className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-amber-500" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "negative": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Conversation Intelligence
            </CardTitle>
            <CardDescription>
              AI-powered analysis of sales conversations
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="analyze" className="gap-2">
              <Brain className="h-4 w-4" />
              Analyze
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-2">
              <FileText className="h-4 w-4" />
              Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analyze" className="space-y-4">
            <div className="space-y-2">
              <Textarea
                placeholder="Paste call notes, meeting transcripts, or conversation summaries here..."
                value={conversationText}
                onChange={(e) => setConversationText(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Optional: Add new conversation text to analyze along with existing notes
              </p>
            </div>

            <Button
              onClick={analyzeConversation}
              disabled={analyzing}
              className="w-full"
              variant="outline"
            >
              {analyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Conversation...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Analyze Conversation
                </>
              )}
            </Button>

            {analysis && (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-2">
                      {getSentimentIcon(analysis.sentiment)}
                      <span className="font-medium">Sentiment</span>
                    </div>
                    <Badge className={getSentimentColor(analysis.sentiment)}>
                      {analysis.sentiment.toUpperCase()} ({analysis.sentiment_score})
                    </Badge>
                  </div>

                  {analysis.buying_signals?.length > 0 && (
                    <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/5 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                        <Target className="h-4 w-4" />
                        Buying Signals Detected
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {analysis.buying_signals.map((signal, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {signal}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.objections?.length > 0 && (
                    <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        Objections Raised
                      </div>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {analysis.objections.map((obj, i) => (
                          <li key={i}>• {obj}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.pain_points?.length > 0 && (
                    <div className="p-3 rounded-lg border bg-card space-y-2">
                      <div className="text-sm font-medium">Pain Points Identified</div>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {analysis.pain_points.map((pain, i) => (
                          <li key={i}>• {pain}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {analysis.decision_makers?.length > 0 && (
                      <div className="p-3 rounded-lg border bg-card space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Users className="h-4 w-4" />
                          Decision Makers
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {analysis.decision_makers.join(", ")}
                        </div>
                      </div>
                    )}

                    {analysis.budget_indicators?.length > 0 && (
                      <div className="p-3 rounded-lg border bg-card space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <DollarSign className="h-4 w-4" />
                          Budget Signals
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {analysis.budget_indicators.slice(0, 2).join("; ")}
                        </div>
                      </div>
                    )}
                  </div>

                  {analysis.timeline_indicators?.length > 0 && (
                    <div className="p-3 rounded-lg border bg-card space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="h-4 w-4" />
                        Timeline Indicators
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {analysis.timeline_indicators.join("; ")}
                      </div>
                    </div>
                  )}

                  {analysis.key_quotes?.length > 0 && (
                    <div className="p-3 rounded-lg border bg-card space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Quote className="h-4 w-4" />
                        Key Quotes
                      </div>
                      <div className="space-y-2">
                        {analysis.key_quotes.slice(0, 3).map((quote, i) => (
                          <p key={i} className="text-sm text-muted-foreground italic">
                            "{quote}"
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                    <div className="text-sm font-medium mb-1">Recommended Deal Stage</div>
                    <Badge>{analysis.deal_stage_recommendation}</Badge>
                  </div>
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <Button
              onClick={extractInsights}
              disabled={extracting}
              className="w-full"
              variant="outline"
            >
              {extracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting Insights...
                </>
              ) : (
                <>
                  <Lightbulb className="mr-2 h-4 w-4" />
                  Extract Strategic Insights
                </>
              )}
            </Button>

            {insights && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg border bg-card space-y-2">
                  <div className="text-sm font-medium">Engagement Pattern</div>
                  <p className="text-sm text-muted-foreground">{insights.engagement_pattern}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border bg-card">
                    <div className="text-sm text-muted-foreground">Interest Level</div>
                    <div className="text-2xl font-bold">{insights.interest_level}/10</div>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <div className="text-sm text-muted-foreground">Best Contact Times</div>
                    <div className="text-sm font-medium mt-1">{insights.best_contact_times}</div>
                  </div>
                </div>

                <div className="p-3 rounded-lg border bg-card space-y-2">
                  <div className="text-sm font-medium">Decision Timeline</div>
                  <p className="text-sm text-muted-foreground">{insights.decision_timeline}</p>
                </div>

                <div className="p-3 rounded-lg border bg-card space-y-2">
                  <div className="text-sm font-medium">Value Proposition Fit</div>
                  <p className="text-sm text-muted-foreground">{insights.value_proposition_fit}</p>
                </div>

                {insights.conversation_starters?.length > 0 && (
                  <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
                    <div className="text-sm font-medium">Conversation Starters</div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {insights.conversation_starters.slice(0, 3).map((starter, i) => (
                        <li key={i}>• {starter}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {insights.success_predictors?.length > 0 && (
                  <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/5 space-y-2">
                    <div className="text-sm font-medium text-green-600">Success Predictors</div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {insights.success_predictors.slice(0, 3).map((pred, i) => (
                        <li key={i}>• {pred}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="summary" className="space-y-4">
            <Button
              onClick={generateSummary}
              disabled={summarizing}
              className="w-full"
            >
              {summarizing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Summary...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Executive Summary
                </>
              )}
            </Button>

            {summary && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg border bg-card">
                  <div className="text-sm font-medium mb-2">Executive Summary</div>
                  <p className="text-sm text-muted-foreground">{summary.executive_summary}</p>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <div className="text-sm font-medium mb-2">Opportunity Assessment</div>
                  <p className="text-sm text-muted-foreground">{summary.opportunity_assessment}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border bg-card">
                    <div className="text-sm text-muted-foreground">Current Status</div>
                    <p className="text-sm font-medium mt-1">{summary.current_status}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <div className="text-sm text-muted-foreground">Deal Probability</div>
                    <div className="text-2xl font-bold text-primary">{summary.deal_probability}%</div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                  <div className="text-sm font-medium mb-2">Next Best Action</div>
                  <p className="text-sm">{summary.next_best_action}</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
