import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  Target,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Brain,
  BarChart3,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  score: number;
}

interface LeadPrediction {
  predicted_score: number;
  conversion_probability: number;
  expected_deal_size: number;
  days_to_close: number;
  confidence_level: "low" | "medium" | "high";
  scoring_factors: Array<{ factor: string; weight: number; impact: string }>;
  risk_factors: string[];
  recommended_actions: string[];
  ideal_customer_fit: number;
}

interface PipelineForecast {
  predicted_conversions: number;
  predicted_revenue: number;
  conversion_rate: number;
  confidence_interval: { low: number; mid: number; high: number };
  recommendations: string[];
  trends: string[];
}

interface PredictiveAnalyticsProps {
  lead?: Lead;
  onUpdate?: () => void;
}

export function PredictiveAnalytics({ lead, onUpdate }: PredictiveAnalyticsProps) {
  const [scoring, setScoring] = useState(false);
  const [forecasting, setForecasting] = useState(false);
  const [prediction, setPrediction] = useState<LeadPrediction | null>(null);
  const [forecast, setForecast] = useState<PipelineForecast | null>(null);

  const scoreLead = async () => {
    if (!lead) return;
    setScoring(true);
    try {
      const { data, error } = await supabase.functions.invoke("predictive-analytics", {
        body: { action: "score_lead", leadId: lead.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPrediction(data.prediction);
      toast.success("Lead scored successfully");
      onUpdate?.();
    } catch (error) {
      console.error("Scoring error:", error);
      toast.error(error instanceof Error ? error.message : "Scoring failed");
    } finally {
      setScoring(false);
    }
  };

  const forecastConversions = async () => {
    setForecasting(true);
    try {
      const { data, error } = await supabase.functions.invoke("predictive-analytics", {
        body: { action: "forecast_conversions", timeframe: "month" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setForecast(data.forecast);
      toast.success("Forecast generated");
    } catch (error) {
      console.error("Forecast error:", error);
      toast.error(error instanceof Error ? error.message : "Forecasting failed");
    } finally {
      setForecasting(false);
    }
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case "high": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "medium": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default: return "bg-red-500/10 text-red-500 border-red-500/20";
    }
  };

  const getProbabilityColor = (prob: number) => {
    if (prob >= 70) return "text-green-500";
    if (prob >= 40) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Predictive Analytics
            </CardTitle>
            <CardDescription>
              AI-powered scoring and conversion forecasting
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <Zap className="h-3 w-3" />
            ML-Powered
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={lead ? "scoring" : "forecast"} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scoring" className="gap-2" disabled={!lead}>
              <Target className="h-4 w-4" />
              Lead Scoring
            </TabsTrigger>
            <TabsTrigger value="forecast" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Forecast
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scoring" className="space-y-4">
            {lead && (
              <>
                <Button
                  onClick={scoreLead}
                  disabled={scoring}
                  className="w-full"
                  variant="outline"
                >
                  {scoring ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing Lead...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      Calculate Conversion Score
                    </>
                  )}
                </Button>

                {prediction && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="text-sm text-muted-foreground mb-1">Conversion Probability</div>
                        <div className={`text-3xl font-bold ${getProbabilityColor(prediction.conversion_probability)}`}>
                          {prediction.conversion_probability}%
                        </div>
                        <Progress value={prediction.conversion_probability} className="mt-2" />
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="text-sm text-muted-foreground mb-1">Predicted Score</div>
                        <div className="text-3xl font-bold">{prediction.predicted_score}</div>
                        <Badge className={`mt-2 ${getConfidenceColor(prediction.confidence_level)}`}>
                          {prediction.confidence_level} confidence
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <DollarSign className="h-4 w-4" />
                          Expected Deal Size
                        </div>
                        <div className="font-semibold mt-1">
                          ${prediction.expected_deal_size?.toLocaleString() || "N/A"}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          Days to Close
                        </div>
                        <div className="font-semibold mt-1">{prediction.days_to_close} days</div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Target className="h-4 w-4" />
                        ICP Fit Score
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={prediction.ideal_customer_fit} className="flex-1" />
                        <span className="font-semibold">{prediction.ideal_customer_fit}%</span>
                      </div>
                    </div>

                    {prediction.scoring_factors?.length > 0 && (
                      <div className="p-3 rounded-lg border bg-card space-y-2">
                        <div className="text-sm font-medium">Scoring Factors</div>
                        <div className="space-y-1">
                          {prediction.scoring_factors.slice(0, 4).map((factor, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{factor.factor}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {factor.impact === "positive" ? (
                                    <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                                  ) : (
                                    <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                                  )}
                                  {factor.weight}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {prediction.risk_factors?.length > 0 && (
                      <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                          <AlertTriangle className="h-4 w-4" />
                          Risk Factors
                        </div>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {prediction.risk_factors.slice(0, 3).map((risk, i) => (
                            <li key={i}>• {risk}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {prediction.recommended_actions?.length > 0 && (
                      <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/5 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          Recommended Actions
                        </div>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {prediction.recommended_actions.slice(0, 3).map((action, i) => (
                            <li key={i}>• {action}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="forecast" className="space-y-4">
            <Button
              onClick={forecastConversions}
              disabled={forecasting}
              className="w-full"
            >
              {forecasting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Forecast...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Forecast Monthly Conversions
                </>
              )}
            </Button>

            {forecast && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="text-sm text-muted-foreground mb-1">Predicted Conversions</div>
                    <div className="text-3xl font-bold text-primary">
                      {forecast.predicted_conversions}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Range: {forecast.confidence_interval?.low} - {forecast.confidence_interval?.high}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="text-sm text-muted-foreground mb-1">Predicted Revenue</div>
                    <div className="text-3xl font-bold text-green-500">
                      ${(forecast.predicted_revenue / 1000).toFixed(0)}K
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {forecast.conversion_rate}% conversion rate
                    </div>
                  </div>
                </div>

                {forecast.trends?.length > 0 && (
                  <div className="p-3 rounded-lg border bg-card space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <TrendingUp className="h-4 w-4" />
                      Observed Trends
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {forecast.trends.slice(0, 4).map((trend, i) => (
                        <li key={i}>• {trend}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {forecast.recommendations?.length > 0 && (
                  <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Recommendations
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {forecast.recommendations.slice(0, 3).map((rec, i) => (
                        <li key={i}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
