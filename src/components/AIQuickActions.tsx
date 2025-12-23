import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Target, TrendingUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

interface TenantContext {
  businessName: string | null;
  industry: string | null;
  icpSegments: string[];
  activeCampaignCount: number;
  topCampaignName: string | null;
}

interface AIQuickActionsProps {
  onActionClick: (prompt: string) => void;
}

const AIQuickActions = ({ onActionClick }: AIQuickActionsProps) => {
  const { workspaceId } = useWorkspaceContext();
  const [tenantContext, setTenantContext] = useState<TenantContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workspaceId) {
      fetchTenantContext(workspaceId);
    } else {
      setLoading(false);
    }
  }, [workspaceId]);

  const fetchTenantContext = async (wsId: string) => {
    try {
      // Fetch business profile
      const { data: profile } = await supabase
        .from("business_profiles")
        .select("business_name, industry")
        .eq("workspace_id", wsId)
        .maybeSingle();

      // Fetch ICP segments
      const { data: segments } = await supabase
        .from("cmo_icp_segments")
        .select("segment_name")
        .eq("workspace_id", wsId)
        .limit(5);

      // Fetch active campaigns count and top performer
      const { data: campaigns, count } = await supabase
        .from("campaigns")
        .select("id, assets!inner(name)", { count: "exact" })
        .eq("workspace_id", wsId)
        .in("status", ["deployed", "running", "active"])
        .limit(1);

      setTenantContext({
        businessName: profile?.business_name || null,
        industry: profile?.industry || null,
        icpSegments: segments?.map((s) => s.segment_name).filter(Boolean) as string[] || [],
        activeCampaignCount: count || 0,
        topCampaignName: (campaigns?.[0]?.assets as any)?.name || null,
      });
    } catch (error) {
      console.error("Error fetching tenant context:", error);
    } finally {
      setLoading(false);
    }
  };

  // Build contextual prompts based on tenant data
  const buildPrompts = () => {
    const ctx = tenantContext;
    const hasContext = ctx && (ctx.businessName || ctx.industry || ctx.icpSegments.length > 0);

    const businessDesc = ctx?.businessName 
      ? `for ${ctx.businessName}` 
      : ctx?.industry 
        ? `for my ${ctx.industry} business`
        : "for my business";

    const icpContext = ctx?.icpSegments.length 
      ? ` targeting ${ctx.icpSegments.slice(0, 3).join(", ")}`
      : "";

    const campaignContext = ctx?.activeCampaignCount 
      ? ` (I have ${ctx.activeCampaignCount} active campaign${ctx.activeCampaignCount > 1 ? "s" : ""})`
      : "";

    return [
      {
        icon: Sparkles,
        label: "Generate Campaign Ideas",
        prompt: hasContext
          ? `Give me 3 creative campaign ideas ${businessDesc}${icpContext}. Focus on high-converting strategies for my specific market.`
          : "Give me 3 creative campaign ideas for my business vertical",
      },
      {
        icon: Target,
        label: "Optimize Targeting",
        prompt: hasContext
          ? `How can I improve my audience targeting strategy ${businessDesc}?${icpContext ? ` My current segments are: ${ctx?.icpSegments.join(", ")}.` : ""} Suggest specific improvements.`
          : "How can I improve my audience targeting strategy?",
      },
      {
        icon: TrendingUp,
        label: "Boost Performance",
        prompt: hasContext
          ? `What are the best practices to improve campaign performance ${businessDesc}${campaignContext}? Give me actionable tips based on my industry.`
          : "What are the best practices to improve my campaign performance?",
      },
      {
        icon: Zap,
        label: "Quick Tips",
        prompt: hasContext
          ? `Give me 5 quick marketing tips ${businessDesc}${icpContext}. Make them specific and immediately actionable.`
          : "Give me 5 quick tips to make my marketing more effective",
      },
    ];
  };

  const actions = buildPrompts();

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">AI Quick Actions</h3>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {tenantContext?.businessName && (
          <span className="text-xs text-muted-foreground ml-auto">
            Personalized for {tenantContext.businessName}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {actions.map((action, i) => (
          <Button
            key={i}
            variant="outline"
            onClick={() => onActionClick(action.prompt)}
            className="justify-start gap-3 h-auto py-3 px-4 hover:bg-primary/10 hover:border-primary transition-all"
          >
            <action.icon className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm text-left">{action.label}</span>
          </Button>
        ))}
      </div>
    </Card>
  );
};

export default AIQuickActions;
