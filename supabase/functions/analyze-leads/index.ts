import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
}

interface BusinessProfile {
  business_name: string | null;
  industry: string | null;
  business_description: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leads, workspaceId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Get auth header for user context
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // ============================================================
    // TENANT VALIDATION: Get user from JWT and validate workspace access
    // This is the SINGLE SOURCE OF TRUTH for tenant identity
    // ============================================================
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("[analyze-leads] Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate workspaceId: user must have access to this workspace
    let validatedWorkspaceId: string | null = null;
    
    if (workspaceId) {
      // Check if user has access to this workspace (owner or member)
      const { data: workspaceAccess } = await supabase
        .from("workspaces")
        .select("id, owner_id")
        .eq("id", workspaceId)
        .single();

      if (!workspaceAccess) {
        // Also check workspace_members
        const { data: memberAccess } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("workspace_id", workspaceId)
          .eq("user_id", user.id)
          .single();

        if (!memberAccess) {
          console.warn(`[analyze-leads] User ${user.id} attempted access to unauthorized workspace ${workspaceId}`);
          return new Response(
            JSON.stringify({ error: "Workspace access denied" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        validatedWorkspaceId = workspaceId;
      } else {
        validatedWorkspaceId = workspaceId;
      }
    }
    // ============================================================

    // Fetch business profile using validated workspace/user context
    let businessContext = "your business";
    let industryContext = "";
    
    if (validatedWorkspaceId) {
      // Get business profile via workspace owner
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("owner_id")
        .eq("id", validatedWorkspaceId)
        .single();

      if (workspace?.owner_id) {
        const { data: profile } = await supabase
          .from("business_profiles")
          .select("business_name, industry, business_description")
          .eq("user_id", workspace.owner_id)
          .single();

        if (profile) {
          businessContext = profile.business_name || "your business";
          industryContext = profile.industry ? ` in the ${profile.industry} industry` : "";
        }
      }
    } else {
      // Fallback: use authenticated user's profile directly
      const { data: profile } = await supabase
        .from("business_profiles")
        .select("business_name, industry, business_description")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        businessContext = profile.business_name || "your business";
        industryContext = profile.industry ? ` in the ${profile.industry} industry` : "";
      }
    }

    // Calculate key metrics for AI context
    const totalLeads = leads.length;
    const newLeads = leads.filter((l: Lead) => l.status === "new").length;
    const contactedLeads = leads.filter((l: Lead) => l.status === "contacted").length;
    const qualifiedLeads = leads.filter((l: Lead) => l.status === "qualified").length;
    const convertedLeads = leads.filter((l: Lead) => l.status === "converted" || l.status === "won").length;
    const lostLeads = leads.filter((l: Lead) => l.status === "lost").length;
    const avgScore = totalLeads > 0 ? Math.round(leads.reduce((acc: number, l: Lead) => acc + (l.score || 0), 0) / totalLeads) : 0;
    const highScoreLeads = leads.filter((l: Lead) => l.score >= 80).length;
    
    const sourceBreakdown = leads.reduce((acc: Record<string, number>, l: Lead) => {
      acc[l.source] = (acc[l.source] || 0) + 1;
      return acc;
    }, {});

    const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : "0";
    const qualificationRate = totalLeads > 0 ? ((qualifiedLeads / totalLeads) * 100).toFixed(1) : "0";

    // Dynamic system prompt using tenant's business profile
    const systemPrompt = `You are a B2B sales optimization expert for ${businessContext}${industryContext}. Analyze lead data and provide actionable insights to:
1. DRIVE QUALIFIED LEADS - Improve lead quality and qualification rates
2. ADD NET NEW CUSTOMERS - Convert more leads to paying customers

Be specific, data-driven, and action-oriented. Focus on immediate, high-impact actions.
Write in plain text without markdown formatting. Keep responses concise and business-focused.`;

    const userPrompt = `Analyze this CRM data and provide optimization insights:

METRICS:
- Total Leads: ${totalLeads}
- New (uncontacted): ${newLeads}
- Contacted: ${contactedLeads}
- Qualified: ${qualifiedLeads}
- Converted: ${convertedLeads}
- Lost: ${lostLeads}
- Average Score: ${avgScore}/100
- High-Score Leads (80+): ${highScoreLeads}
- Conversion Rate: ${conversionRate}%
- Qualification Rate: ${qualificationRate}%

LEAD SOURCES: ${JSON.stringify(sourceBreakdown)}

TOP 5 HOTTEST LEADS:
${leads.filter((l: Lead) => l.score >= 80 && l.status !== "converted").slice(0, 5).map((l: Lead) => 
  `- ${l.first_name} ${l.last_name} (${l.company || 'No company'}) - Score: ${l.score}, Status: ${l.status}, Source: ${l.source}`
).join('\n')}

Provide a JSON response with this exact structure:
{
  "qualificationInsights": [
    {"title": "string", "description": "string", "impact": "high|medium|low", "action": "string"}
  ],
  "conversionInsights": [
    {"title": "string", "description": "string", "impact": "high|medium|low", "action": "string"}
  ],
  "nextBestActions": [
    {"leadId": "string or null for general actions", "action": "string", "reason": "string", "priority": 1-5}
  ],
  "pipelineHealth": {
    "score": 1-100,
    "bottleneck": "string describing main issue",
    "recommendation": "string"
  }
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }
    
    const insights = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-leads:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
