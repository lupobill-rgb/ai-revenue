// CRO Dashboard - Revenue snapshot, pipeline, top recommendations

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  DollarSign, 
  TrendingUp, 
  Target, 
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Users,
  Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import NavBar from "@/components/NavBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DashboardMetrics {
  openPipeline: number;
  forecastCommit: number;
  targetArr: number;
  dealsAtRisk: number;
}

interface Recommendation {
  id: string;
  title: string;
  severity: string;
  source_type: string;
  status: string;
}

interface Deal {
  id: string;
  name: string;
  value: number;
  stage: string;
  probability: number;
}

export default function CRODashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    openPipeline: 0,
    forecastCommit: 0,
    targetArr: 0,
    dealsAtRisk: 0,
  });
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [topDeals, setTopDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Fetch open pipeline from deals
      const { data: deals } = await supabase
        .from("deals")
        .select("id, name, value, stage, probability")
        .neq("stage", "closed_won")
        .neq("stage", "closed_lost")
        .order("value", { ascending: false })
        .limit(10);

      const openPipeline = deals?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;
      setTopDeals(deals || []);

      // Fetch current period forecast
      const { data: forecasts } = await supabase
        .from("cro_forecasts")
        .select("forecast_new_arr, scenario")
        .eq("scenario", "commit")
        .limit(1);

      const forecastCommit = forecasts?.[0]?.forecast_new_arr || 0;

      // Fetch current target
      const { data: targets } = await supabase
        .from("cro_targets")
        .select("target_new_arr")
        .limit(1);

      const targetArr = targets?.[0]?.target_new_arr || 0;

      // Fetch deal reviews with low scores
      const { data: reviews } = await supabase
        .from("cro_deal_reviews")
        .select("id")
        .lt("score", 50);

      const dealsAtRisk = reviews?.length || 0;

      setMetrics({ openPipeline, forecastCommit, targetArr, dealsAtRisk });

      // Fetch top recommendations
      const { data: recs } = await supabase
        .from("cro_recommendations")
        .select("id, title, severity, source_type, status")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(5);

      setRecommendations(recs || []);
    } catch (error) {
      console.error("Error loading CRO dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  const attainmentPct = metrics.targetArr > 0 
    ? Math.round((metrics.forecastCommit / metrics.targetArr) * 100) 
    : 0;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "high": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default: return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">CRO Dashboard</h1>
          <p className="text-muted-foreground mt-1">Revenue operations at a glance</p>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Open Pipeline
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.openPipeline)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {topDeals.length} active deals
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Forecast (Commit)
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.forecastCommit)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                High confidence deals
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Target Attainment
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{attainmentPct}%</div>
              <Progress value={Math.min(attainmentPct, 100)} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Deals at Risk
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{metrics.dealsAtRisk}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Score below 50
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Deals */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Top Pipeline Deals</CardTitle>
              <Link to="/cro/pipeline">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : topDeals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No open deals found
                  </div>
                ) : (
                  topDeals.slice(0, 5).map((deal) => (
                    <Link 
                      key={deal.id} 
                      to={`/cro/deals/${deal.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium">{deal.name}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {deal.stage.replace("_", " ")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(deal.value || 0)}</p>
                        <Badge variant="outline" className="text-xs">
                          {deal.probability}% prob
                        </Badge>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Revenue Recommendations</CardTitle>
              <Link to="/cro/recommendations">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : recommendations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No open recommendations
                  </div>
                ) : (
                  recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-start gap-3 p-3 rounded-lg border"
                    >
                      <Badge className={getSeverityColor(rec.severity)}>
                        {rec.severity}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{rec.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {rec.source_type || "general"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/cro/forecast">
            <Button variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" /> View Forecast
            </Button>
          </Link>
          <Link to="/cro/pipeline">
            <Button variant="outline">
              <Users className="mr-2 h-4 w-4" /> Pipeline Review
            </Button>
          </Link>
          <Link to="/crm">
            <Button variant="outline">
              <DollarSign className="mr-2 h-4 w-4" /> CRM Deals
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}