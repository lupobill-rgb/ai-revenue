import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NurturingRequest {
  leadId: string;
  action: "analyze" | "generate_sequence" | "execute_step";
  stepIndex?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, action, stepIndex } = await req.json() as NurturingRequest;

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Fetch lead details
    const { data: lead, error: leadError } = await supabaseClient
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error("Lead not found");
    }

    // Fetch lead activities for engagement analysis
    const { data: activities } = await supabaseClient
      .from("lead_activities")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(50);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (action === "analyze") {
      // Analyze engagement signals
      const engagementAnalysis = analyzeEngagement(lead, activities || []);
      
      const prompt = `Analyze this lead's engagement and provide nurturing recommendations.

LEAD PROFILE:
- Name: ${lead.first_name} ${lead.last_name}
- Company: ${lead.company || "Unknown"}
- Title: ${lead.job_title || "Unknown"}
- Industry: ${lead.vertical || lead.industry || "Unknown"}
- Status: ${lead.status}
- Score: ${lead.score}/100
- Source: ${lead.source}

ENGAGEMENT SIGNALS:
${JSON.stringify(engagementAnalysis, null, 2)}

RECENT ACTIVITIES:
${(activities || []).slice(0, 10).map(a => `- ${a.activity_type}: ${a.description} (${new Date(a.created_at).toLocaleDateString()})`).join('\n')}

Provide a JSON response with:
1. engagement_level: "cold" | "warm" | "hot"
2. interest_signals: array of detected interest indicators
3. pain_points: likely pain points based on profile
4. recommended_approach: personalization strategy
5. urgency_score: 1-10 how urgent to follow up
6. best_channel: "email" | "phone" | "linkedin"
7. optimal_timing: best time/day to reach out
8. talking_points: key points to address`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are an expert sales intelligence analyst. Analyze lead engagement and provide actionable nurturing recommendations. Always respond with valid JSON." },
            { role: "user", content: prompt }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API error:", response.status, errorText);
        throw new Error("AI analysis failed");
      }

      const aiData = await response.json();
      const analysisText = aiData.choices[0].message.content;
      
      // Parse JSON from response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      return new Response(
        JSON.stringify({
          success: true,
          analysis: {
            ...analysis,
            raw_engagement: engagementAnalysis,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "generate_sequence") {
      // Generate personalized nurturing sequence
      const engagementAnalysis = analyzeEngagement(lead, activities || []);
      
      const prompt = `Create a personalized 5-step email nurturing sequence for this lead.

LEAD PROFILE:
- Name: ${lead.first_name} ${lead.last_name}
- Company: ${lead.company || "Unknown"}
- Title: ${lead.job_title || "Unknown"}
- Industry: ${lead.vertical || lead.industry || "Unknown"}
- Status: ${lead.status}
- Score: ${lead.score}/100

ENGAGEMENT DATA:
- Email opens: ${engagementAnalysis.emailOpens}
- Email clicks: ${engagementAnalysis.emailClicks}
- Days since last contact: ${engagementAnalysis.daysSinceLastContact}
- Total touchpoints: ${engagementAnalysis.totalTouchpoints}

Generate a JSON array with 5 email steps. Each step should have:
1. step_number: 1-5
2. delay_days: days to wait before sending (from previous step)
3. trigger_condition: engagement condition that triggers this step (e.g., "no_response", "opened_not_clicked", "clicked")
4. subject_line: compelling email subject
5. email_body: full email content with personalization
6. goal: what this email aims to achieve
7. cta: call to action

Make emails progressively more direct. First email = value-focused, last email = urgency/final reach.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are an expert email copywriter specializing in B2B nurturing sequences. Create compelling, personalized email sequences that drive engagement. Always respond with valid JSON array." },
            { role: "user", content: prompt }
          ],
        }),
      });

      if (!response.ok) {
        throw new Error("AI sequence generation failed");
      }

      const aiData = await response.json();
      const sequenceText = aiData.choices[0].message.content;
      
      // Parse JSON array from response
      const jsonMatch = sequenceText.match(/\[[\s\S]*\]/);
      const sequence = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

      // Log activity
      const { data: { user } } = await supabaseClient.auth.getUser();
      await supabaseClient.from("lead_activities").insert({
        lead_id: leadId,
        activity_type: "nurture_sequence_created",
        description: `AI-generated ${sequence.length}-step nurturing sequence`,
        created_by: user?.id,
        metadata: { sequence_length: sequence.length },
      });

      return new Response(
        JSON.stringify({
          success: true,
          sequence,
          lead_context: {
            name: `${lead.first_name} ${lead.last_name}`,
            company: lead.company,
            engagement_level: engagementAnalysis.engagementLevel,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "execute_step" && stepIndex !== undefined) {
      // Execute a specific step in the sequence (send email)
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        throw new Error("RESEND_API_KEY not configured");
      }

      // Get business profile for sender name
      const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
      let businessName = "Marketing";
      if (currentUser) {
        const { data: profile } = await supabaseClient
          .from("business_profiles")
          .select("business_name")
          .eq("user_id", currentUser.id)
          .single();
        if (profile?.business_name) {
          businessName = profile.business_name;
        }
      }

      // Get the sequence step from request body
      const { step } = await req.json();
      
      if (!step || !lead.email) {
        throw new Error("Missing step data or lead email");
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${businessName} <onboarding@resend.dev>`,
          to: [lead.email],
          subject: step.subject_line,
          html: step.email_body.replace(/\n/g, "<br>"),
          tags: [
            { name: "lead_id", value: leadId },
            { name: "sequence_step", value: String(stepIndex) },
            { name: "nurture_type", value: "ai_sequence" },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Email send failed: ${errorData.message}`);
      }

      const emailResult = await response.json();

      // Log activity
      const { data: { user } } = await supabaseClient.auth.getUser();
      await supabaseClient.from("lead_activities").insert({
        lead_id: leadId,
        activity_type: "nurture_email_sent",
        description: `Nurture sequence step ${stepIndex + 1}: ${step.subject_line}`,
        created_by: user?.id,
        metadata: {
          email_id: emailResult.id,
          step_number: stepIndex + 1,
          goal: step.goal,
        },
      });

      // Update lead last_contacted_at
      await supabaseClient
        .from("leads")
        .update({ last_contacted_at: new Date().toISOString() })
        .eq("id", leadId);

      return new Response(
        JSON.stringify({
          success: true,
          email_id: emailResult.id,
          step_executed: stepIndex + 1,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (error) {
    console.error("Error in ai-lead-nurturing:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function analyzeEngagement(lead: any, activities: any[]) {
  const now = new Date();
  const lastContactedAt = lead.last_contacted_at ? new Date(lead.last_contacted_at) : null;
  const daysSinceLastContact = lastContactedAt 
    ? Math.floor((now.getTime() - lastContactedAt.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const emailOpens = activities.filter(a => a.activity_type === "email_opened").length;
  const emailClicks = activities.filter(a => a.activity_type === "email_clicked").length;
  const emailsSent = activities.filter(a => a.activity_type === "email_sent" || a.activity_type === "nurture_email_sent").length;
  const calls = activities.filter(a => a.activity_type === "call").length;
  const meetings = activities.filter(a => a.activity_type === "meeting").length;

  const totalTouchpoints = emailsSent + calls + meetings;
  const openRate = emailsSent > 0 ? (emailOpens / emailsSent) * 100 : 0;
  const clickRate = emailsSent > 0 ? (emailClicks / emailsSent) * 100 : 0;

  let engagementLevel: "cold" | "warm" | "hot" = "cold";
  if (emailClicks > 0 || meetings > 0) {
    engagementLevel = "hot";
  } else if (emailOpens > 0 || calls > 0) {
    engagementLevel = "warm";
  }

  return {
    emailOpens,
    emailClicks,
    emailsSent,
    calls,
    meetings,
    totalTouchpoints,
    openRate: Math.round(openRate),
    clickRate: Math.round(clickRate),
    daysSinceLastContact,
    engagementLevel,
    recentActivity: activities.slice(0, 5).map(a => ({
      type: a.activity_type,
      date: a.created_at,
    })),
  };
}
