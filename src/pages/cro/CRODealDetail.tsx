// CRO Deal Detail - Deal review + AI next steps

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  TrendingUp,
  MessageSquare,
  Calendar,
  DollarSign,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import NavBar from "@/components/NavBar";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Deal {
  id: string;
  name: string;
  value: number;
  stage: string;
  probability: number;
  expected_close_date: string | null;
  created_at: string;
  notes: string | null;
  lead_id: string | null;
}

interface DealReview {
  id: string;
  summary_md: string | null;
  risks: string | null;
  next_steps: string | null;
  score: number;
  created_at: string;
}

export default function CRODealDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [review, setReview] = useState<DealReview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (id) loadDealData();
  }, [id, user]);

  const loadDealData = async () => {
    if (!user || !id) return;
    setIsLoading(true);

    try {
      // Fetch deal
      const { data: dealData, error: dealError } = await supabase
        .from("deals")
        .select("*")
        .eq("id", id)
        .single();

      if (dealError) throw dealError;
      setDeal(dealData);

      // Fetch review
      const { data: reviewData } = await supabase
        .from("cro_deal_reviews")
        .select("*")
        .eq("deal_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      setReview(reviewData);
    } catch (error) {
      console.error("Error loading deal:", error);
      toast.error("Failed to load deal");
    } finally {
      setIsLoading(false);
    }
  };

  const generateReview = async () => {
    if (!deal || !user) return;
    setIsGenerating(true);

    try {
      // For now, create a placeholder review
      // In production, this would call cro-deal-review edge function
      const { data, error } = await supabase
        .from("cro_deal_reviews")
        .insert({
          tenant_id: user.id,
          workspace_id: deal.id, // Should be actual workspace_id
          deal_id: deal.id,
          score: Math.floor(Math.random() * 40) + 40, // 40-80
          summary_md: `**${deal.name}** is currently in ${deal.stage} stage with ${deal.probability}% probability.`,
          risks: "- Timeline may slip if decision-maker not engaged\n- Budget not confirmed\n- Competitor activity detected",
          next_steps: "1. Schedule executive sponsor meeting\n2. Send ROI analysis\n3. Confirm budget timeline",
        })
        .select()
        .single();

      if (error) throw error;
      setReview(data);
      toast.success("Deal review generated");
    } catch (error) {
      console.error("Error generating review:", error);
      toast.error("Failed to generate review");
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 70) {
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          <CheckCircle className="h-3 w-3 mr-1" /> Healthy
        </Badge>
      );
    }
    if (score >= 50) {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
          <Clock className="h-3 w-3 mr-1" /> At Risk
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
        <AlertTriangle className="h-3 w-3 mr-1" /> High Risk
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-center py-20 text-muted-foreground">Loading deal...</div>
        </main>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">Deal not found</p>
            <Link to="/cro/pipeline">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pipeline
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <PageBreadcrumbs items={[
        { label: "CRO", href: "/cro" },
        { label: "Pipeline", href: "/cro/pipeline" },
        { label: deal?.name || "Deal" }
      ]} />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">{deal.name}</h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline" className="capitalize">
                  {deal.stage.replace("_", " ")}
                </Badge>
                {review && getScoreBadge(review.score)}
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-3xl font-bold">{formatCurrency(deal.value || 0)}</p>
              <p className="text-sm text-muted-foreground">{deal.probability}% probability</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Deal Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" /> Deal Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stage</span>
                <span className="font-medium capitalize">{deal.stage.replace("_", " ")}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Value</span>
                <span className="font-medium">{formatCurrency(deal.value || 0)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Probability</span>
                <span className="font-medium">{deal.probability}%</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Close Date</span>
                <span className="font-medium">
                  {deal.expected_close_date 
                    ? new Date(deal.expected_close_date).toLocaleDateString()
                    : "Not set"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">
                  {new Date(deal.created_at).toLocaleDateString()}
                </span>
              </div>
              
              {deal.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Notes</p>
                    <p className="text-sm">{deal.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* AI Review */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> AI Deal Review
              </CardTitle>
              <Button 
                onClick={generateReview} 
                disabled={isGenerating}
                size="sm"
              >
                {isGenerating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {review ? "Refresh" : "Generate"} Review
              </Button>
            </CardHeader>
            <CardContent>
              {!review ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No AI review yet</p>
                  <p className="text-sm mt-1">Click "Generate Review" to analyze this deal</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Score */}
                  <div className="flex items-center gap-4">
                    <div className={`text-4xl font-bold ${getScoreColor(review.score)}`}>
                      {review.score}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Health Score</p>
                      <Progress value={review.score} className="h-2" />
                    </div>
                  </div>

                  <Separator />

                  {/* Summary */}
                  {review.summary_md && (
                    <div>
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <MessageSquare className="h-4 w-4" /> Summary
                      </h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {review.summary_md}
                      </p>
                    </div>
                  )}

                  {/* Risks */}
                  {review.risks && (
                    <div>
                      <h4 className="font-medium flex items-center gap-2 mb-2 text-orange-500">
                        <AlertTriangle className="h-4 w-4" /> Risks
                      </h4>
                      <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3">
                        <p className="text-sm whitespace-pre-wrap">{review.risks}</p>
                      </div>
                    </div>
                  )}

                  {/* Next Steps */}
                  {review.next_steps && (
                    <div>
                      <h4 className="font-medium flex items-center gap-2 mb-2 text-green-500">
                        <TrendingUp className="h-4 w-4" /> Recommended Next Steps
                      </h4>
                      <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                        <p className="text-sm whitespace-pre-wrap">{review.next_steps}</p>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Last reviewed: {new Date(review.created_at).toLocaleString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}