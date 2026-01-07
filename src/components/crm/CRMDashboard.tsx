import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, TrendingUp, Zap, ArrowRight, Star, Phone, Mail, Brain, Sparkles, AlertCircle, CheckCircle2, Loader2, Tags, Database } from "lucide-react";
import { usePipelineMetrics } from "@/hooks/usePipelineMetrics";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo, useEffect } from "react";
import { subDays, isAfter, parseISO, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmailOutreachDialog } from "./EmailOutreachDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenantSegments } from "@/hooks/useTenantSegments";
import { SegmentBadge } from "./SegmentBadge";

interface AIInsight {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  action: string;
}

interface NextBestAction {
  leadId: string | null;
  action: string;
  reason: string;
  priority: number;
}

interface PipelineHealth {
  score: number;
  bottleneck: string;
  recommendation: string;
}

interface AIAnalysis {
  qualificationInsights: AIInsight[];
  conversionInsights: AIInsight[];
  nextBestActions: NextBestAction[];
  pipelineHealth: PipelineHealth;
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  status: string;
  score: number;
  source: string;
  created_at: string;
  segment_code?: string;
}

interface CRMDashboardProps {
  leads: Lead[];
  showSampleData: boolean;
  onToggleSampleData?: (show: boolean) => void;
  workspaceId?: string | null;
}

const SAMPLE_LEADS: Lead[] = [
  { id: "s1", first_name: "John", last_name: "Smith", email: "john@example.com", phone: "555-0101", company: "Fitness First", status: "new", score: 92, source: "google_maps", created_at: new Date().toISOString() },
  { id: "s2", first_name: "Jane", last_name: "Doe", email: "jane@example.com", phone: "555-0102", company: "Peak Performance", status: "contacted", score: 78, source: "landing_page", created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "s3", first_name: "Mike", last_name: "Johnson", email: "mike@example.com", phone: "555-0103", company: "Elite Training", status: "qualified", score: 95, source: "manual", created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: "s4", first_name: "Sarah", last_name: "Williams", email: "sarah@example.com", phone: "555-0104", company: "Wellness Hub", status: "converted", score: 88, source: "google_maps", created_at: new Date(Date.now() - 259200000).toISOString() },
  { id: "s5", first_name: "Tom", last_name: "Brown", email: "tom@example.com", company: "Active Life", status: "lost", score: 45, source: "csv_import", created_at: new Date(Date.now() - 345600000).toISOString() },
  { id: "s6", first_name: "Emily", last_name: "Davis", email: "emily@example.com", phone: "555-0106", company: "Sport Center", status: "new", score: 85, source: "landing_page", created_at: new Date(Date.now() - 432000000).toISOString() },
  { id: "s7", first_name: "Chris", last_name: "Miller", email: "chris@example.com", phone: "555-0107", company: "Gym Pro", status: "qualified", score: 91, source: "google_maps", created_at: new Date(Date.now() - 518400000).toISOString() },
  { id: "s8", first_name: "Lisa", last_name: "Anderson", email: "lisa@example.com", phone: "555-0108", company: "Health Plus", status: "converted", score: 96, source: "landing_page", created_at: new Date(Date.now() - 604800000).toISOString() },
];

const FUNNEL_COLORS = {
  new: { bg: "hsl(217 91% 60%)", badge: "bg-blue-500", text: "text-blue-500", glow: "0 0 20px hsl(217 91% 60% / 0.5)" },
  contacted: { bg: "hsl(271 91% 65%)", badge: "bg-purple-500", text: "text-purple-500", glow: "0 0 20px hsl(271 91% 65% / 0.5)" },
  qualified: { bg: "hsl(142 71% 45%)", badge: "bg-green-500", text: "text-green-500", glow: "0 0 20px hsl(142 71% 45% / 0.5)" },
  converted: { bg: "hsl(142 76% 36%)", badge: "bg-emerald-500", text: "text-emerald-500", glow: "0 0 20px hsl(142 76% 36% / 0.5)" },
  lost: { bg: "hsl(var(--muted))", badge: "bg-muted-foreground/50", text: "text-muted-foreground", glow: "none" },
};

export default function CRMDashboard({ leads, showSampleData, onToggleSampleData, workspaceId }: CRMDashboardProps) {
  const [dateRange, setDateRange] = useState<string>("all");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [analyzingLeads, setAnalyzingLeads] = useState(false);
  const { segments, getSegmentByCode } = useTenantSegments();
  const baseLeads = showSampleData && leads.length === 0 ? SAMPLE_LEADS : leads;
  
  // CRM TRUTH: Use authoritative view for conversion metrics
  const { metrics: pipelineMetrics } = usePipelineMetrics(workspaceId ?? null);

  // Auto-analyze leads when data changes (only if workspaceId is available)
  useEffect(() => {
    if (baseLeads.length > 0 && !aiAnalysis && !analyzingLeads && workspaceId) {
      analyzeLeads();
    }
  }, [baseLeads.length, workspaceId]);

  const analyzeLeads = async () => {
    if (baseLeads.length === 0) return;
    
    setAnalyzingLeads(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-leads", {
        body: { leads: baseLeads, workspaceId },
      });
      
      if (error) throw error;
      setAiAnalysis(data);
    } catch (err) {
      console.error("Error analyzing leads:", err);
      toast.error("Failed to analyze leads");
    } finally {
      setAnalyzingLeads(false);
    }
  };

  const displayLeads = useMemo(() => {
    return baseLeads.filter(lead => {
      if (dateRange !== "all") {
        const days = parseInt(dateRange);
        const cutoffDate = subDays(new Date(), days);
        if (!isAfter(parseISO(lead.created_at), cutoffDate)) {
          return false;
        }
      }
      if (segmentFilter !== "all" && lead.segment_code !== segmentFilter) {
        return false;
      }
      return true;
    });
  }, [baseLeads, dateRange, segmentFilter]);

  // Core metrics
  const totalLeadsInDatabase = baseLeads.length; // Total in database (unfiltered)
  const totalLeads = displayLeads.length; // Filtered count
  const newLeads = displayLeads.filter(l => l.status === "new").length;
  const contactedLeads = displayLeads.filter(l => l.status === "contacted").length;
  const qualifiedLeads = displayLeads.filter(l => l.status === "qualified").length;
  const convertedLeads = displayLeads.filter(l => l.status === "converted" || l.status === "won").length;
  const lostLeads = displayLeads.filter(l => l.status === "lost" || l.status === "unqualified").length;

  // CRM TRUTH: Conversion rate comes from authoritative view, NOT local calculation
  const conversionRate = pipelineMetrics?.conversion_rate ?? 0;
  const avgScore = displayLeads.length > 0 
    ? Math.round(displayLeads.reduce((acc, l) => acc + (l.score || 0), 0) / displayLeads.length) 
    : 0;

  // Hot leads (high score, not yet converted)
  const hotLeads = displayLeads
    .filter(l => l.score >= 80 && l.status !== "converted" && l.status !== "lost")
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Funnel data
  const funnelStages = [
    { stage: "New", count: newLeads, colorKey: "new" as const },
    { stage: "Contacted", count: contactedLeads, colorKey: "contacted" as const },
    { stage: "Qualified", count: qualifiedLeads, colorKey: "qualified" as const },
    { stage: "Converted", count: convertedLeads, colorKey: "converted" as const },
  ];

  // Activity trend (last 7 days)
  const activityData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayLeads = baseLeads.filter(l => {
        const leadDate = parseISO(l.created_at);
        return format(leadDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
      }).length;
      days.push({
        day: format(date, 'EEE'),
        leads: dayLeads,
      });
    }
    return days;
  }, [baseLeads]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 75) return "text-yellow-500";
    return "text-orange-500";
  };

  return (
    <div className="space-y-6">
      {/* CRM TRUTH GUARDRAIL - Non-negotiable transparency */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground">
        <Database className="h-3 w-3 flex-shrink-0" />
        <span>Metrics are driven from CRM deal outcomes. No inferred or estimated revenue.</span>
      </div>

      {/* Header with filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[130px] bg-card">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          {segments.length > 0 && (
            <Select value={segmentFilter} onValueChange={setSegmentFilter}>
              <SelectTrigger className="w-[150px] bg-card">
                <Tags className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Segments</SelectItem>
                {segments.map((seg) => (
                  <SelectItem key={seg.code} value={seg.code}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: seg.color }}
                      />
                      {seg.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="sample-data"
            checked={showSampleData}
            onCheckedChange={onToggleSampleData}
          />
          <Label htmlFor="sample-data" className="text-sm text-muted-foreground">
            Demo Data
          </Label>
        </div>
      </div>

      {/* KPI Cards - Modern design */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full -mr-10 -mt-10" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalLeadsInDatabase}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalLeads !== totalLeadsInDatabase ? (
                <>
                  <span className="text-blue-500 font-medium">{totalLeads}</span> shown ({dateRange !== "all" ? "filtered" : segmentFilter !== "all" ? "segment filtered" : "all"}) • {" "}
                  <span className="text-green-500 font-medium">+{newLeads}</span> new
                </>
              ) : (
                <>
                  <span className="text-green-500 font-medium">+{newLeads}</span> new this period
                </>
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full -mr-10 -mt-10" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{conversionRate.toFixed(1)}%</div>
            <Progress value={conversionRate} className="h-1.5 mt-2" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-500/10 rounded-full -mr-10 -mt-10" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Lead Score</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgScore}</div>
            <p className="text-xs text-muted-foreground mt-1">Out of 100</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full -mr-10 -mt-10" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ready to Close</CardTitle>
            <Zap className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{qualifiedLeads}</div>
            <p className="text-xs text-muted-foreground mt-1">Qualified leads</p>
          </CardContent>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Conversion Funnel */}
        <Card className="lg:col-span-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <TrendingUp className="h-5 w-5 text-primary" />
              Lead → Customer Journey
            </CardTitle>
            <CardDescription className="text-muted-foreground/80">Track your conversion funnel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {funnelStages.map((stage, index) => {
                const percentage = totalLeads > 0 ? (stage.count / totalLeads) * 100 : 0;
                const prevCount = index > 0 ? funnelStages[index - 1].count : totalLeads;
                const dropoff = prevCount > 0 && index > 0 
                  ? Math.round(((prevCount - stage.count) / prevCount) * 100) 
                  : 0;
                const colors = FUNNEL_COLORS[stage.colorKey];
                const barWidth = Math.max(percentage, 8);

                return (
                  <div key={stage.stage} className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`${colors.badge} text-white border-0`}>
                          {stage.stage}
                        </Badge>
                        {index > 0 && dropoff > 0 && (
                          <Badge variant="outline" className="text-xs bg-red-500/10 text-red-500 border-red-500/30">
                            -{dropoff}% dropoff
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${colors.text}`}>{stage.count}</span>
                        <span className="text-sm text-muted-foreground">({percentage.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="h-10 bg-muted/30 rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg transition-all duration-700 ease-out flex items-center justify-end pr-3 animate-[scale-in_0.5s_ease-out]"
                        style={{ 
                          width: `${barWidth}%`,
                          backgroundColor: colors.bg,
                          boxShadow: colors.glow,
                        }}
                      >
                        {percentage >= 20 && (
                          <span className="text-sm font-bold text-white drop-shadow-md">
                            {stage.count}
                          </span>
                        )}
                      </div>
                    </div>
                    {index < funnelStages.length - 1 && (
                      <div className="flex justify-center my-2">
                        <div className="flex flex-col items-center">
                          <div className="w-0.5 h-2 bg-muted-foreground/30" />
                          <ArrowRight className="h-4 w-4 text-muted-foreground/50 rotate-90" />
                          <div className="w-0.5 h-2 bg-muted-foreground/30" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Hot Leads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-500" />
              Hot Leads
            </CardTitle>
            <CardDescription>Ready for outreach</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {hotLeads.length > 0 ? (
              hotLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">
                        {lead.first_name} {lead.last_name}
                      </p>
                      {lead.segment_code && (() => {
                        const seg = getSegmentByCode(lead.segment_code);
                        return seg ? <SegmentBadge code={seg.code} name={seg.name} color={seg.color} size="sm" /> : null;
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {lead.company || lead.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className={`text-sm font-bold ${getScoreColor(lead.score)}`}>
                      {lead.score}
                    </span>
                    <div className="flex gap-1">
                      {lead.phone && (
                        <Button size="icon" variant="ghost" className="h-7 w-7">
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7"
                        onClick={() => {
                          setSelectedLead(lead);
                          setEmailDialogOpen(true);
                        }}
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hot leads yet. Import leads to get started.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Activity</CardTitle>
          <CardDescription>New leads over the past week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))", 
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))" 
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="leads" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fill="url(#leadGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* AI-Powered Insights */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline Health */}
        <Card className="relative overflow-hidden border-primary/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Pipeline Health
              {analyzingLeads && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            </CardTitle>
            <CardDescription>AI-powered pipeline analysis</CardDescription>
          </CardHeader>
          <CardContent>
            {aiAnalysis?.pipelineHealth ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20">
                    <svg className="transform -rotate-90 h-20 w-20">
                      <circle
                        cx="40"
                        cy="40"
                        r="36"
                        stroke="hsl(var(--muted))"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="36"
                        stroke={aiAnalysis.pipelineHealth.score >= 70 ? "hsl(142 76% 36%)" : aiAnalysis.pipelineHealth.score >= 40 ? "hsl(48 96% 53%)" : "hsl(0 84% 60%)"}
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${(aiAnalysis.pipelineHealth.score / 100) * 226} 226`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold">{aiAnalysis.pipelineHealth.score}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Main Bottleneck</p>
                    <p className="text-sm font-semibold">{aiAnalysis.pipelineHealth.bottleneck}</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-sm"><span className="font-medium">Recommendation:</span> {aiAnalysis.pipelineHealth.recommendation}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                {analyzingLeads ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">Analyzing your leads...</p>
                  </>
                ) : (
                  <>
                    <Brain className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">Get AI insights on your pipeline</p>
                    <Button size="sm" onClick={analyzeLeads} disabled={baseLeads.length === 0}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyze Leads
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Next Best Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  Next Best Actions
                </CardTitle>
                <CardDescription>AI-recommended actions to drive conversions</CardDescription>
              </div>
              {aiAnalysis && (
                <Button size="sm" variant="ghost" onClick={analyzeLeads} disabled={analyzingLeads}>
                  {analyzingLeads ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiAnalysis?.nextBestActions && aiAnalysis.nextBestActions.length > 0 ? (
              aiAnalysis.nextBestActions.slice(0, 4).map((action, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    action.priority <= 2 ? "bg-red-500/20 text-red-500" : action.priority <= 3 ? "bg-yellow-500/20 text-yellow-500" : "bg-blue-500/20 text-blue-500"
                  }`}>
                    {action.priority}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{action.action}</p>
                    <p className="text-xs text-muted-foreground">{action.reason}</p>
                  </div>
                </div>
              ))
            ) : analyzingLeads ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Click "Analyze Leads" to get AI recommendations
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Insights Cards */}
      {aiAnalysis && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Drive Qualified Leads */}
          <Card className="border-green-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-500">
                <Target className="h-5 w-5" />
                Drive Qualified Leads
              </CardTitle>
              <CardDescription>AI insights to improve lead quality</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiAnalysis.qualificationInsights?.slice(0, 3).map((insight, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-green-500/10 bg-green-500/5">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold">{insight.title}</p>
                    <Badge variant={insight.impact === "high" ? "destructive" : insight.impact === "medium" ? "default" : "secondary"} className="text-xs">
                      {insight.impact}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{insight.description}</p>
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    <span className="font-medium">{insight.action}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Add Net New Customers */}
          <Card className="border-blue-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-500">
                <Users className="h-5 w-5" />
                Add Net New Customers
              </CardTitle>
              <CardDescription>AI insights to boost conversions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiAnalysis.conversionInsights?.slice(0, 3).map((insight, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-blue-500/10 bg-blue-500/5">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold">{insight.title}</p>
                    <Badge variant={insight.impact === "high" ? "destructive" : insight.impact === "medium" ? "default" : "secondary"} className="text-xs">
                      {insight.impact}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{insight.description}</p>
                  <div className="flex items-center gap-2 text-xs text-blue-600">
                    <CheckCircle2 className="h-3 w-3" />
                    <span className="font-medium">{insight.action}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {showSampleData && leads.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Showing demo data. Import real leads to see your actual metrics.
        </p>
      )}

      <EmailOutreachDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        lead={selectedLead}
      />
    </div>
  );
}
