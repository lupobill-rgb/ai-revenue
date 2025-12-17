// CRO Pipeline - Deal list by stage with risk flags

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Filter,
  ArrowUpRight,
  Building2 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResourceTable, Column, Action } from "@/components/cmo/shared/ResourceTable";
import NavBar from "@/components/NavBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Deal {
  id: string;
  name: string;
  value: number;
  stage: string;
  probability: number;
  expected_close_date: string | null;
  created_at: string;
  lead_id: string | null;
  notes: string | null;
}

interface DealReview {
  deal_id: string;
  score: number;
  risks: string | null;
}

const STAGES = [
  { value: "all", label: "All Stages" },
  { value: "prospecting", label: "Prospecting" },
  { value: "qualification", label: "Qualification" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Closed Won" },
  { value: "closed_lost", label: "Closed Lost" },
];

export default function CROPipeline() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [reviews, setReviews] = useState<Map<string, DealReview>>(new Map());
  const [stageFilter, setStageFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPipelineData();
  }, [user, stageFilter]);

  const loadPipelineData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      let query = supabase
        .from("deals")
        .select("*")
        .order("value", { ascending: false });

      if (stageFilter !== "all") {
        query = query.eq("stage", stageFilter);
      }

      const { data: dealsData } = await query;
      setDeals(dealsData || []);

      // Fetch reviews for deals
      if (dealsData && dealsData.length > 0) {
        const dealIds = dealsData.map((d) => d.id);
        const { data: reviewsData } = await supabase
          .from("cro_deal_reviews")
          .select("deal_id, score, risks")
          .in("deal_id", dealIds);

        const reviewMap = new Map<string, DealReview>();
        reviewsData?.forEach((r) => {
          reviewMap.set(r.deal_id, r);
        });
        setReviews(reviewMap);
      }
    } catch (error) {
      console.error("Error loading pipeline data:", error);
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

  const getRiskBadge = (dealId: string) => {
    const review = reviews.get(dealId);
    if (!review) return null;
    
    if (review.score < 40) {
      return (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
          <AlertTriangle className="h-3 w-3 mr-1" /> High Risk
        </Badge>
      );
    }
    if (review.score < 60) {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
          <Clock className="h-3 w-3 mr-1" /> At Risk
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
        <CheckCircle className="h-3 w-3 mr-1" /> Healthy
      </Badge>
    );
  };

  const getStageBadge = (stage: string) => {
    const colors: Record<string, string> = {
      prospecting: "bg-slate-500/10 text-slate-500",
      qualification: "bg-blue-500/10 text-blue-500",
      proposal: "bg-purple-500/10 text-purple-500",
      negotiation: "bg-orange-500/10 text-orange-500",
      closed_won: "bg-green-500/10 text-green-500",
      closed_lost: "bg-red-500/10 text-red-500",
    };
    return (
      <Badge className={colors[stage] || "bg-muted"}>
        {stage.replace("_", " ")}
      </Badge>
    );
  };

  const columns: Column<Deal>[] = [
    {
      key: "name",
      label: "Deal",
      sortable: true,
      render: (_, row) => (
        <Link 
          to={`/cro/deals/${row.id}`}
          className="font-medium hover:text-primary flex items-center gap-1"
        >
          {row.name}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      ),
    },
    {
      key: "value",
      label: "Value",
      sortable: true,
      render: (value) => (
        <span className="font-semibold">{formatCurrency(value as number || 0)}</span>
      ),
    },
    {
      key: "stage",
      label: "Stage",
      sortable: true,
      render: (value) => getStageBadge(value as string),
    },
    {
      key: "probability",
      label: "Probability",
      sortable: true,
      render: (value) => (
        <span className="text-muted-foreground">{value as number}%</span>
      ),
    },
    {
      key: "id",
      label: "Risk",
      render: (_, row) => getRiskBadge(row.id),
    },
    {
      key: "expected_close_date",
      label: "Close Date",
      sortable: true,
      render: (value) => value ? new Date(value as string).toLocaleDateString() : "—",
    },
  ];

  const actions: Action<Deal>[] = [
    {
      label: "View Deal",
      onClick: (row) => window.location.href = `/cro/deals/${row.id}`,
    },
    {
      label: "View in CRM",
      onClick: (row) => window.location.href = `/crm/${row.lead_id || row.id}`,
    },
  ];

  // Calculate stage summary
  const stageSummary = STAGES.filter((s) => s.value !== "all").map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage.value);
    const total = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    return {
      stage: stage.label,
      count: stageDeals.length,
      value: total,
    };
  });

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Pipeline</h1>
            <p className="text-muted-foreground mt-1">Deal list by stage with risk analysis</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by stage" />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((stage) => (
                  <SelectItem key={stage.value} value={stage.value}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stage Summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {stageSummary.map((summary) => (
            <Card key={summary.stage} className="p-4">
              <p className="text-xs text-muted-foreground capitalize">{summary.stage}</p>
              <p className="text-lg font-bold">{formatCurrency(summary.value)}</p>
              <p className="text-xs text-muted-foreground">{summary.count} deals</p>
            </Card>
          ))}
        </div>

        {/* Deals Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {stageFilter === "all" ? "All Deals" : STAGES.find((s) => s.value === stageFilter)?.label}
              <Badge variant="outline" className="ml-2">
                {deals.length} deals
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResourceTable
              data={deals}
              columns={columns}
              actions={actions}
              isLoading={isLoading}
              searchPlaceholder="Search deals..."
              onRefresh={loadPipelineData}
              emptyMessage="No deals found"
              emptyIcon={<Building2 className="h-8 w-8 text-muted-foreground" />}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}