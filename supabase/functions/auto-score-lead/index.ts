import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadActivity {
  activity_type: string;
  created_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Verify JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create service role client to verify the token
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Create client with user's token for RLS enforcement
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });

    console.log(`[auto-score-lead] User ${user.id} scoring lead ${leadId}`);

    // Fetch lead data - RLS will enforce tenant access
    const { data: lead, error: leadError } = await supabaseClient
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      console.error("Lead not found or access denied:", leadError);
      return new Response(JSON.stringify({ error: "Lead not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch lead activities for engagement scoring - RLS enforced
    const { data: activities } = await supabaseClient
      .from("lead_activities")
      .select("activity_type, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    // Calculate base score from profile data
    let score = 0;
    const scoreBreakdown: Record<string, number> = {};

    // Profile completeness scoring
    if (lead.email) {
      score += 10;
      scoreBreakdown.email = 10;
    }
    if (lead.phone) {
      score += 15;
      scoreBreakdown.phone = 15;
    }
    if (lead.company) {
      score += 10;
      scoreBreakdown.company = 10;
    }
    if (lead.job_title) {
      score += 10;
      scoreBreakdown.job_title = 10;
    }
    if (lead.vertical) {
      score += 10;
      scoreBreakdown.vertical = 10;
    }

    // Decision maker bonus
    const decisionMakerTitles = ["owner", "ceo", "director", "manager", "vp", "president", "founder", "chief"];
    if (lead.job_title && decisionMakerTitles.some(t => lead.job_title.toLowerCase().includes(t))) {
      score += 15;
      scoreBreakdown.decision_maker = 15;
    }

    // Enterprise company bonus
    const enterpriseSizes = ["51-200", "201-500", "501-1000", "1000+"];
    if (enterpriseSizes.includes(lead.company_size || "")) {
      score += 10;
      scoreBreakdown.enterprise = 10;
    }

    // Engagement scoring from activities
    const activityList = activities || [];
    const emailOpens = activityList.filter((a: LeadActivity) => a.activity_type === "email_opened").length;
    const emailClicks = activityList.filter((a: LeadActivity) => a.activity_type === "email_clicked").length;
    const emailsSent = activityList.filter((a: LeadActivity) => a.activity_type === "email_sent").length;
    const callsCompleted = activityList.filter((a: LeadActivity) => a.activity_type === "call_completed").length;
    const formSubmissions = activityList.filter((a: LeadActivity) => a.activity_type === "form_submission").length;

    // Email engagement (capped)
    const emailOpenScore = Math.min(emailOpens * 3, 15);
    const emailClickScore = Math.min(emailClicks * 5, 20);
    if (emailOpenScore > 0) scoreBreakdown.email_opens = emailOpenScore;
    if (emailClickScore > 0) scoreBreakdown.email_clicks = emailClickScore;
    score += emailOpenScore + emailClickScore;

    // Call engagement
    const callScore = Math.min(callsCompleted * 10, 20);
    if (callScore > 0) scoreBreakdown.calls = callScore;
    score += callScore;

    // Form submissions
    const formScore = Math.min(formSubmissions * 10, 20);
    if (formScore > 0) scoreBreakdown.forms = formScore;
    score += formScore;

    // Recency bonus - recent activity in last 7 days
    const recentActivities = activityList.filter((a: LeadActivity) => {
      const activityDate = new Date(a.created_at);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return activityDate > sevenDaysAgo;
    });

    if (recentActivities.length >= 3) {
      score += 10;
      scoreBreakdown.recency = 10;
    } else if (recentActivities.length >= 1) {
      score += 5;
      scoreBreakdown.recency = 5;
    }

    // Status-based scoring
    if (lead.status === "qualified") {
      score += 10;
      scoreBreakdown.status_qualified = 10;
    } else if (lead.status === "contacted") {
      score += 5;
      scoreBreakdown.status_contacted = 5;
    }

    // Cap at 100
    const finalScore = Math.min(score, 100);
    const previousScore = lead.score || 0;

    // Update lead score if changed - RLS enforced
    if (finalScore !== previousScore) {
      const { error: updateError } = await supabaseClient
        .from("leads")
        .update({ score: finalScore })
        .eq("id", leadId);

      if (updateError) {
        console.error("Error updating lead score:", updateError);
        throw updateError;
      }

      // Log the score change - RLS enforced
      await supabaseClient.from("lead_activities").insert({
        lead_id: leadId,
        activity_type: "score_updated",
        description: `Lead score auto-updated: ${previousScore} → ${finalScore}`,
        metadata: { 
          previous_score: previousScore, 
          new_score: finalScore,
          breakdown: scoreBreakdown 
        },
        tenant_id: lead.tenant_id,
      });

      console.log(`Lead ${leadId} score updated: ${previousScore} → ${finalScore}`);
    }

    return new Response(
      JSON.stringify({
        leadId,
        previousScore,
        newScore: finalScore,
        breakdown: scoreBreakdown,
        updated: finalScore !== previousScore,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in auto-score-lead:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
