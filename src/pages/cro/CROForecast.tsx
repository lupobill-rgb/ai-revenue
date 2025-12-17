// CRO Forecast - Targets vs forecasts by period

import { useState, useEffect } from "react";
import { TrendingUp, Target, Calendar, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import NavBar from "@/components/NavBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Target {
  id: string;
  period: string;
  owner_type: string;
  owner_id: string;
  target_new_arr: number;
  target_pipeline: number;
}

interface Forecast {
  id: string;
  period: string;
  scenario: string;
  forecast_new_arr: number;
  confidence: number;
  notes: string | null;
}

export default function CROForecast() {
  const { user } = useAuth();
  const [targets, setTargets] = useState<Target[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadForecastData();
  }, [user]);

  const loadForecastData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const [targetsRes, forecastsRes] = await Promise.all([
        supabase
          .from("cro_targets")
          .select("*")
          .order("period", { ascending: false }),
        supabase
          .from("cro_forecasts")
          .select("*")
          .order("period", { ascending: false }),
      ]);

      setTargets(targetsRes.data || []);
      setForecasts(forecastsRes.data || []);
    } catch (error) {
      console.error("Error loading forecast data:", error);
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

  // Group forecasts by period for chart
  const chartData = [...new Set(forecasts.map((f) => f.period))].map((period) => {
    const periodForecasts = forecasts.filter((f) => f.period === period);
    const target = targets.find((t) => t.period === period);
    
    return {
      period,
      target: target?.target_new_arr || 0,
      commit: periodForecasts.find((f) => f.scenario === "commit")?.forecast_new_arr || 0,
      base: periodForecasts.find((f) => f.scenario === "base")?.forecast_new_arr || 0,
      stretch: periodForecasts.find((f) => f.scenario === "stretch")?.forecast_new_arr || 0,
    };
  });

  const getScenarioColor = (scenario: string) => {
    switch (scenario) {
      case "commit": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "base": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "stretch": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      default: return "bg-muted";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Revenue Forecast</h1>
            <p className="text-muted-foreground mt-1">Targets vs forecasts by period</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Forecast
          </Button>
        </div>

        {/* Forecast Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Forecast vs Target
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No forecast data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" className="text-xs" />
                  <YAxis 
                    tickFormatter={(value) => formatCurrency(value)}
                    className="text-xs"
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="target" name="Target" fill="hsl(var(--muted-foreground))" />
                  <Bar dataKey="commit" name="Commit" fill="hsl(142 76% 36%)" />
                  <Bar dataKey="base" name="Base" fill="hsl(221 83% 53%)" />
                  <Bar dataKey="stretch" name="Stretch" fill="hsl(262 83% 58%)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Targets Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Targets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : targets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No targets set
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead className="text-right">Target ARR</TableHead>
                      <TableHead className="text-right">Pipeline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targets.map((target) => (
                      <TableRow key={target.id}>
                        <TableCell className="font-medium">{target.period}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {target.owner_type}: {target.owner_id}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(target.target_new_arr || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(target.target_pipeline || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Forecasts Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Forecasts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : forecasts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No forecasts created
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Scenario</TableHead>
                      <TableHead className="text-right">Forecast</TableHead>
                      <TableHead className="text-right">Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forecasts.map((forecast) => (
                      <TableRow key={forecast.id}>
                        <TableCell className="font-medium">{forecast.period}</TableCell>
                        <TableCell>
                          <Badge className={getScenarioColor(forecast.scenario)}>
                            {forecast.scenario}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(forecast.forecast_new_arr || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress 
                              value={(forecast.confidence || 0) * 100} 
                              className="w-16 h-2"
                            />
                            <span className="text-sm text-muted-foreground">
                              {Math.round((forecast.confidence || 0) * 100)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}